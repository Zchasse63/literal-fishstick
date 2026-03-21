import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── Mock resend package ─────────────────────────────────────

const mockSendEmail = vi.fn()
const mockBatchSend = vi.fn()

// We need to dynamically import after mocking because the module reads
// DRY_RUN at import time from process.env.
async function loadModule() {
  // Reset the module registry so each import reads fresh env vars
  vi.resetModules()
  // Re-apply the mock after resetModules clears it.
  // Use a regular function (not arrow) so it can be called with `new`.
  vi.doMock('resend', () => ({
    Resend: function Resend() {
      return {
        emails: { send: mockSendEmail },
        batch: { send: mockBatchSend },
      }
    },
  }))
  return import('@/lib/resend')
}

describe('sendTransactionalEmail', () => {
  let originalDryRun: string | undefined

  beforeEach(() => {
    originalDryRun = process.env.RESEND_DRY_RUN
    mockSendEmail.mockReset()
  })

  afterEach(() => {
    if (originalDryRun === undefined) {
      delete process.env.RESEND_DRY_RUN
    } else {
      process.env.RESEND_DRY_RUN = originalDryRun
    }
  })

  it('returns synthetic ID in dry run mode', async () => {
    process.env.RESEND_DRY_RUN = 'true'
    const { sendTransactionalEmail } = await loadModule()

    const result = await sendTransactionalEmail('test@example.com', 'Hello', '<p>Hi</p>')
    expect(result.dryRun).toBe(true)
    expect(result.id).toMatch(/^dry_run_/)
    expect(result.error).toBeNull()
    expect(mockSendEmail).not.toHaveBeenCalled()
  })

  it('returns id from Resend on success', async () => {
    delete process.env.RESEND_DRY_RUN
    const { sendTransactionalEmail } = await loadModule()

    mockSendEmail.mockResolvedValueOnce({ data: { id: 'msg_123' }, error: null })
    const result = await sendTransactionalEmail('test@example.com', 'Hello', '<p>Hi</p>')
    expect(result.id).toBe('msg_123')
    expect(result.error).toBeNull()
    expect(result.dryRun).toBe(false)
  })

  it('returns error message on failure', async () => {
    delete process.env.RESEND_DRY_RUN
    const { sendTransactionalEmail } = await loadModule()

    mockSendEmail.mockResolvedValueOnce({ data: null, error: { message: 'Rate limited' } })
    const result = await sendTransactionalEmail('test@example.com', 'Hello', '<p>Hi</p>')
    expect(result.id).toBeNull()
    expect(result.error).toBe('Rate limited')
    expect(result.dryRun).toBe(false)
  })
})

describe('sendCampaignEmail', () => {
  let originalDryRun: string | undefined

  beforeEach(() => {
    originalDryRun = process.env.RESEND_DRY_RUN
    mockSendEmail.mockReset()
  })

  afterEach(() => {
    if (originalDryRun === undefined) {
      delete process.env.RESEND_DRY_RUN
    } else {
      process.env.RESEND_DRY_RUN = originalDryRun
    }
  })

  it('generates Message-ID with correct format', async () => {
    delete process.env.RESEND_DRY_RUN
    const { sendCampaignEmail } = await loadModule()

    mockSendEmail.mockResolvedValueOnce({ data: { id: 'msg_456' }, error: null })
    const result = await sendCampaignEmail(
      'user@example.com', 'Promo', '<p>Deal</p>', 'camp-1', 'mem-1'
    )
    expect(result.messageId).toMatch(/^<campaign-camp-1-member-mem-1-\d+@meridian\.app>$/)
  })

  it('sets campaign headers in the send call', async () => {
    delete process.env.RESEND_DRY_RUN
    const { sendCampaignEmail } = await loadModule()

    mockSendEmail.mockResolvedValueOnce({ data: { id: 'msg_789' }, error: null })
    await sendCampaignEmail('user@example.com', 'Promo', '<p>Deal</p>', 'camp-2', 'mem-2')

    expect(mockSendEmail).toHaveBeenCalledOnce()
    const callArgs = mockSendEmail.mock.calls[0][0]
    expect(callArgs.headers['X-Campaign-ID']).toBe('camp-2')
    expect(callArgs.headers['X-Member-ID']).toBe('mem-2')
    expect(callArgs.headers['Message-ID']).toMatch(/^<campaign-camp-2/)
  })

  it('works in dry run mode', async () => {
    process.env.RESEND_DRY_RUN = 'true'
    const { sendCampaignEmail } = await loadModule()

    const result = await sendCampaignEmail(
      'user@example.com', 'Promo', '<p>Deal</p>', 'camp-3', 'mem-3'
    )
    expect(result.dryRun).toBe(true)
    expect(result.id).toMatch(/^dry_run_/)
    expect(result.messageId).toMatch(/^<campaign-camp-3/)
    expect(mockSendEmail).not.toHaveBeenCalled()
  })
})

describe('sendBatchEmails', () => {
  let originalDryRun: string | undefined

  beforeEach(() => {
    originalDryRun = process.env.RESEND_DRY_RUN
    mockBatchSend.mockReset()
  })

  afterEach(() => {
    if (originalDryRun === undefined) {
      delete process.env.RESEND_DRY_RUN
    } else {
      process.env.RESEND_DRY_RUN = originalDryRun
    }
  })

  function makeEmails(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      to: `user${i}@example.com`,
      subject: `Subject ${i}`,
      html: `<p>Email ${i}</p>`,
    }))
  }

  it('returns empty ids for empty array', async () => {
    delete process.env.RESEND_DRY_RUN
    const { sendBatchEmails } = await loadModule()

    const result = await sendBatchEmails([])
    expect(result.ids).toEqual([])
    expect(result.error).toBeNull()
    expect(result.dryRun).toBe(false)
  })

  it('sends a single email without chunking', async () => {
    delete process.env.RESEND_DRY_RUN
    const { sendBatchEmails } = await loadModule()

    mockBatchSend.mockResolvedValueOnce({
      data: { data: [{ id: 'b_1' }] },
      error: null,
    })
    const result = await sendBatchEmails(makeEmails(1))
    expect(result.ids).toEqual(['b_1'])
    expect(result.error).toBeNull()
    expect(mockBatchSend).toHaveBeenCalledTimes(1)
  })

  it('sends exactly 100 emails in 1 chunk', async () => {
    delete process.env.RESEND_DRY_RUN
    const { sendBatchEmails } = await loadModule()

    const ids100 = Array.from({ length: 100 }, (_, i) => ({ id: `b_${i}` }))
    mockBatchSend.mockResolvedValueOnce({
      data: { data: ids100 },
      error: null,
    })
    const result = await sendBatchEmails(makeEmails(100))
    expect(result.ids).toHaveLength(100)
    expect(mockBatchSend).toHaveBeenCalledTimes(1)
  })

  it('sends 101 emails in 2 chunks (100 + 1)', async () => {
    delete process.env.RESEND_DRY_RUN
    const { sendBatchEmails } = await loadModule()

    const ids100 = Array.from({ length: 100 }, (_, i) => ({ id: `c1_${i}` }))
    const ids1 = [{ id: 'c2_0' }]
    mockBatchSend
      .mockResolvedValueOnce({ data: { data: ids100 }, error: null })
      .mockResolvedValueOnce({ data: { data: ids1 }, error: null })

    const result = await sendBatchEmails(makeEmails(101))
    expect(result.ids).toHaveLength(101)
    expect(mockBatchSend).toHaveBeenCalledTimes(2)
    expect(result.error).toBeNull()
  })

  it('sends 250 emails in 3 chunks (100 + 100 + 50)', async () => {
    delete process.env.RESEND_DRY_RUN
    const { sendBatchEmails } = await loadModule()

    const chunk1 = Array.from({ length: 100 }, (_, i) => ({ id: `d1_${i}` }))
    const chunk2 = Array.from({ length: 100 }, (_, i) => ({ id: `d2_${i}` }))
    const chunk3 = Array.from({ length: 50 }, (_, i) => ({ id: `d3_${i}` }))
    mockBatchSend
      .mockResolvedValueOnce({ data: { data: chunk1 }, error: null })
      .mockResolvedValueOnce({ data: { data: chunk2 }, error: null })
      .mockResolvedValueOnce({ data: { data: chunk3 }, error: null })

    const result = await sendBatchEmails(makeEmails(250))
    expect(result.ids).toHaveLength(250)
    expect(mockBatchSend).toHaveBeenCalledTimes(3)
    expect(result.error).toBeNull()
  })

  it('returns error on first chunk failure with no partial ids', async () => {
    delete process.env.RESEND_DRY_RUN
    const { sendBatchEmails } = await loadModule()

    mockBatchSend.mockResolvedValueOnce({
      data: null,
      error: { message: 'Server error' },
    })
    const result = await sendBatchEmails(makeEmails(50))
    expect(result.ids).toEqual([])
    expect(result.error).toBe('Server error')
  })

  it('returns partial ids when second chunk fails', async () => {
    delete process.env.RESEND_DRY_RUN
    const { sendBatchEmails } = await loadModule()

    const chunk1Ids = Array.from({ length: 100 }, (_, i) => ({ id: `ok_${i}` }))
    mockBatchSend
      .mockResolvedValueOnce({ data: { data: chunk1Ids }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'Chunk 2 failed' } })

    const result = await sendBatchEmails(makeEmails(150))
    expect(result.ids).toHaveLength(100)
    expect(result.error).toBe('Chunk 2 failed')
  })

  it('returns synthetic ids for all emails in dry run mode', async () => {
    process.env.RESEND_DRY_RUN = 'true'
    const { sendBatchEmails } = await loadModule()

    const result = await sendBatchEmails(makeEmails(5))
    expect(result.dryRun).toBe(true)
    expect(result.ids).toHaveLength(5)
    result.ids.forEach((id) => {
      expect(id).toMatch(/^dry_run_batch_/)
    })
    expect(mockBatchSend).not.toHaveBeenCalled()
  })
})
