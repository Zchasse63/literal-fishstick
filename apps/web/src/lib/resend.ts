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

export async function sendBatchEmails(
  emails: BatchEmail[]
): Promise<{ ids: (string | null)[]; error: string | null; dryRun: boolean }> {
  if (emails.length === 0) {
    return { ids: [], error: null, dryRun: false }
  }

  if (DRY_RUN) {
    console.log(`[RESEND DRY RUN] Batch sending ${emails.length} emails`)
    const ids = emails.map((_, i) => `dry_run_batch_${Date.now()}_${i}`)
    return { ids, error: null, dryRun: true }
  }

  const resend = getResend()
  const allIds: (string | null)[] = []

  // Chunk into batches of 100 (Resend API limit)
  for (let i = 0; i < emails.length; i += RESEND_BATCH_LIMIT) {
    const chunk = emails.slice(i, i + RESEND_BATCH_LIMIT)

    const { data, error } = await resend.batch.send(
      chunk.map((email) => ({
        from: FROM_ADDRESS,
        to: email.to,
        subject: email.subject,
        html: email.html,
        replyTo: email.replyTo,
        headers: email.headers,
        tags: email.tags,
      }))
    )

    if (error) {
      console.error(`[RESEND] Batch email error (chunk ${Math.floor(i / RESEND_BATCH_LIMIT) + 1}):`, error)
      return { ids: allIds, error: error.message, dryRun: false }
    }

    const chunkIds = data?.data?.map((d) => d.id) ?? []
    allIds.push(...chunkIds)
  }

  return { ids: allIds, error: null, dryRun: false }
}
