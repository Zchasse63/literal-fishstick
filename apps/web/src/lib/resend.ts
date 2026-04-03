/**
 * Resend email client for Meridian
 *
 * Handles transactional emails, campaign sends, and batch operations.
 * Server-side only — never expose the API key to the client.
 */
import { Resend } from 'resend'

// Lazy-init to avoid build-time errors when env vars aren't set
let _resend: Resend | null = null

function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY!)
  }
  return _resend
}

const DRY_RUN = process.env.RESEND_DRY_RUN === 'true'
const FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS || process.env.RESEND_FROM_ADDRESS || 'The Sauna Guys <noreply@thesaunaguys.com>'

// ─── Types ───────────────────────────────────────────────────

interface SendResult {
  id: string | null
  error: string | null
  dryRun: boolean
}

interface TransactionalEmailOptions {
  replyTo?: string
  from?: string
  tags?: { name: string; value: string }[]
}

interface CampaignEmail {
  to: string
  subject: string
  html: string
  campaignId: string
  memberId: string
  replyTo?: string
}

interface BatchEmail {
  to: string
  subject: string
  html: string
  replyTo?: string
  headers?: Record<string, string>
  tags?: { name: string; value: string }[]
}

// ─── Transactional Email ─────────────────────────────────────

export async function sendTransactionalEmail(
  to: string,
  subject: string,
  html: string,
  options?: TransactionalEmailOptions
): Promise<SendResult> {
  if (DRY_RUN) {
    console.log(`[RESEND DRY RUN] Transactional email to: ${to}, subject: ${subject}`)
    return { id: `dry_run_${Date.now()}`, error: null, dryRun: true }
  }

  const resend = getResend()

  const { data, error } = await resend.emails.send({
    from: options?.from ?? FROM_ADDRESS,
    to,
    subject,
    html,
    replyTo: options?.replyTo,
    tags: options?.tags,
  })

  if (error) {
    console.error('[RESEND] Transactional email error:', error)
    return { id: null, error: error.message, dryRun: false }
  }

  return { id: data?.id ?? null, error: null, dryRun: false }
}

// ─── Campaign Email ──────────────────────────────────────────

export async function sendCampaignEmail(
  to: string,
  subject: string,
  html: string,
  campaignId: string,
  memberId: string,
  replyTo?: string
): Promise<SendResult & { messageId: string | null }> {
  // Generate a deterministic Message-ID for reply threading
  const messageId = `<campaign-${campaignId}-member-${memberId}-${Date.now()}@meridian.app>`

  if (DRY_RUN) {
    console.log(`[RESEND DRY RUN] Campaign email to: ${to}, campaign: ${campaignId}, member: ${memberId}`)
    return { id: `dry_run_${Date.now()}`, error: null, dryRun: true, messageId }
  }

  const resend = getResend()

  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject,
    html,
    replyTo,
    headers: {
      'Message-ID': messageId,
      'X-Campaign-ID': campaignId,
      'X-Member-ID': memberId,
    },
    tags: [
      { name: 'campaign_id', value: campaignId },
      { name: 'member_id', value: memberId },
    ],
  })

  if (error) {
    console.error('[RESEND] Campaign email error:', error)
    return { id: null, error: error.message, dryRun: false, messageId: null }
  }

  return { id: data?.id ?? null, error: null, dryRun: false, messageId }
}

// ─── Batch Email ─────────────────────────────────────────────

const RESEND_BATCH_LIMIT = 100
const BATCH_RETRY_ATTEMPTS = 3
const BATCH_RETRY_BASE_MS = 1000

/**
 * Retry a chunk with exponential backoff.
 * Returns the Resend response or throws after all retries are exhausted.
 */
async function sendChunkWithRetry(
  resend: Resend,
  chunk: BatchEmail[],
  chunkIndex: number
): Promise<{ ids: string[] }> {
  const payload = chunk.map((email) => ({
    from: FROM_ADDRESS,
    to: email.to,
    subject: email.subject,
    html: email.html,
    replyTo: email.replyTo,
    headers: email.headers,
    tags: email.tags,
  }))

  let lastError: string | null = null

  for (let attempt = 0; attempt < BATCH_RETRY_ATTEMPTS; attempt++) {
    const { data, error } = await resend.batch.send(payload)

    if (!error) {
      const ids = data?.data?.map((d) => d.id) ?? []
      return { ids }
    }

    lastError = error.message
    console.warn(
      `[RESEND] Batch chunk ${chunkIndex + 1} failed (attempt ${attempt + 1}/${BATCH_RETRY_ATTEMPTS}): ${error.message}`
    )

    // Don't retry on the last attempt
    if (attempt < BATCH_RETRY_ATTEMPTS - 1) {
      const delayMs = BATCH_RETRY_BASE_MS * Math.pow(2, attempt)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  // All retries exhausted — throw so the caller can handle it
  throw new Error(lastError ?? 'Batch send failed after retries')
}

export async function sendBatchEmails(
  emails: BatchEmail[]
): Promise<{ ids: (string | null)[]; errors: string[]; error: string | null; dryRun: boolean }> {
  if (emails.length === 0) {
    return { ids: [], errors: [], error: null, dryRun: false }
  }

  if (DRY_RUN) {
    console.log(`[RESEND DRY RUN] Batch sending ${emails.length} emails`)
    const ids = emails.map((_, i) => `dry_run_batch_${Date.now()}_${i}`)
    return { ids, errors: [], error: null, dryRun: true }
  }

  const resend = getResend()
  const allIds: (string | null)[] = []
  const chunkErrors: string[] = []

  // Chunk into batches of 100 (Resend API limit)
  for (let i = 0; i < emails.length; i += RESEND_BATCH_LIMIT) {
    const chunkIndex = Math.floor(i / RESEND_BATCH_LIMIT)
    const chunk = emails.slice(i, i + RESEND_BATCH_LIMIT)

    try {
      const { ids } = await sendChunkWithRetry(resend, chunk, chunkIndex)
      allIds.push(...ids)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown batch error'
      console.error(`[RESEND] Batch chunk ${chunkIndex + 1} failed permanently:`, message)
      chunkErrors.push(`Chunk ${chunkIndex + 1}: ${message}`)
      // Fill with nulls for the failed chunk so index mapping stays aligned
      allIds.push(...chunk.map(() => null))
      // Continue with remaining chunks instead of aborting
    }
  }

  return {
    ids: allIds,
    errors: chunkErrors,
    error: chunkErrors.length > 0 ? `${chunkErrors.length} chunk(s) failed: ${chunkErrors.join('; ')}` : null,
    dryRun: false,
  }
}
