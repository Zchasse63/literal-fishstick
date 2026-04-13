import { NextRequest } from 'next/server'
import { sendCampaignEmail } from '@/lib/resend'
import { resolveTemplate, textToHtml, wrapEmailLayout } from '@/lib/email-templates'
import { randomInt } from 'crypto'
import { requireRole } from '@/lib/auth/require-role'

const DEFAULT_BATCH_SIZE = 10
const SEND_DELAY_MS = 200
const DUPLICATE_WINDOW_MINUTES = 5

/**
 * POST /api/campaigns/send
 *
 * Send campaign emails in batches with SSE streaming for progress.
 * Body: { campaignId, templateId?, memberIds, subject, bodyTemplate, batchSize? }
 *
 * Enhancements over Phase 1:
 * - Checks email_preferences table (skip marketing_email=false OR hard_bounced=true)
 * - Re-checks preferences at each batch boundary
 * - Writes to campaign_recipients table (per-member status tracking)
 * - On retry: checks for existing campaign_recipients with status='sent' and skips (resumable)
 * - Updates denormalized counts on campaigns table after send completes
 * - Supports A/B test variant splitting
 */
export async function POST(request: NextRequest) {
  // ─── Auth (fail-closed) ────────────────────────────────────
  const auth = await requireRole(['owner', 'manager'])
  if (auth.error) return auth.error
  const { user, supabase, studioId } = auth

  // Fail-closed: if no studio_id on the profile, deny the request
  if (!studioId) {
    return new Response(JSON.stringify({ error: 'No studio_id on profile. Access denied.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const STUDIO_ID = studioId

  // ─── Parse Body ────────────────────────────────────────────
  const body = await request.json()
  const {
    campaignId,
    memberIds,
    subject,
    bodyTemplate,
    batchSize = DEFAULT_BATCH_SIZE,
  } = body as {
    campaignId: string
    templateId?: string
    memberIds: string[]
    subject: string
    bodyTemplate: string
    batchSize?: number
  }

  if (!campaignId || !memberIds?.length || !subject || !bodyTemplate) {
    return new Response(JSON.stringify({ error: 'campaignId, memberIds, subject, and bodyTemplate are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ─── Concurrent Send Protection ───────────────────────────
  const windowStart = new Date(Date.now() - DUPLICATE_WINDOW_MINUTES * 60 * 1000).toISOString()
  const { count: recentSends } = await supabase
    .from('email_send_log')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .gte('sent_at', windowStart)

  if (recentSends && recentSends > 0) {
    // Check if this is a retry (some recipients already sent, but campaign not completed)
    const { data: campaignState } = await supabase
      .from('campaigns')
      .select('status')
      .eq('id', campaignId)
      .single()

    // Allow retry if campaign is paused or still sending (resumable)
    if (campaignState?.status !== 'paused' && campaignState?.status !== 'sending') {
      return new Response(JSON.stringify({
        error: `Campaign ${campaignId} was already sent within the last ${DUPLICATE_WINDOW_MINUTES} minutes. Wait before retrying.`,
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  // ─── Fetch Campaign for A/B Test Config ───────────────────
  // B12 FIX: real schema uses ab_variants jsonb instead of per-variant
  // columns. Shape: { a: { subject, body_html }, b: { subject, body_html },
  // split_percentage?: number, auto_select_winner?: boolean }
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('ab_test_enabled, ab_variants, name')
    .eq('id', campaignId)
    .eq('studio_id', STUDIO_ID)
    .single()

  // Mark campaign as sending
  await supabase
    .from('campaigns')
    .update({
      status: 'sending',
      sent_at: new Date().toISOString(),
      send_started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId)
    .eq('studio_id', STUDIO_ID)

  // ─── SSE Stream ────────────────────────────────────────────
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      let sent = 0
      let failed = 0
      let skippedPrefs = 0
      let skippedAlreadySent = 0
      const total = memberIds.length

      sendEvent({ type: 'start', total })

      // Process in batches
      for (let i = 0; i < memberIds.length; i += batchSize) {
        const batch = memberIds.slice(i, i + batchSize)

        // Check if campaign was paused during send
        const { data: currentState } = await supabase
          .from('campaigns')
          .select('status')
          .eq('id', campaignId)
          .single()

        if (currentState?.status === 'paused') {
          sendEvent({ type: 'paused', sent, failed, skippedPrefs, skippedAlreadySent, total })
          break
        }

        // ─── Re-check email preferences at each batch boundary ─
        const { data: preferences } = await supabase
          .from('email_preferences')
          .select('member_id')
          .in('member_id', batch)
          .or('marketing_email.eq.false,hard_bounced.eq.true')

        const excludedByPrefs = new Set(
          (preferences ?? []).map((p: { member_id: string }) => p.member_id)
        )

        // ─── Check for already-sent recipients (resumable) ─────
        const { data: alreadySentRecords } = await supabase
          .from('campaign_recipients')
          .select('member_id')
          .eq('campaign_id', campaignId)
          .in('member_id', batch)
          .eq('status', 'sent')

        const alreadySentIds = new Set(
          (alreadySentRecords ?? []).map((r: { member_id: string }) => r.member_id)
        )

        // Filter batch to eligible members
        const eligibleIds = batch.filter((mid: string) => {
          if (excludedByPrefs.has(mid)) {
            skippedPrefs++
            return false
          }
          if (alreadySentIds.has(mid)) {
            skippedAlreadySent++
            return false
          }
          return true
        })

        if (eligibleIds.length === 0) {
          sendEvent({
            type: 'batch_skipped',
            batchIndex: Math.floor(i / batchSize),
            skippedPrefs: excludedByPrefs.size,
            skippedAlreadySent: alreadySentIds.size,
          })
          continue
        }

        // Fetch member data for this batch
        const { data: members, error: membersError } = await supabase
          .from('profiles')
          .select('id, email, full_name, phone')
          .in('id', eligibleIds)
          .eq('studio_id', STUDIO_ID)

        if (membersError || !members) {
          sendEvent({ type: 'error', message: `Failed to fetch members: ${membersError?.message}` })
          continue
        }

        // Fetch membership + credits for merge tags
        const { data: memberships } = await supabase
          .from('members')
          .select('profile_id, membership_tier, membership_status')
          .in('profile_id', eligibleIds)
          .eq('membership_status', 'active')

        const { data: creditPacks } = await supabase
          .from('credit_packs')
          .select('member_id, credits_remaining')
          .in('member_id', (memberships ?? []).map((m: { profile_id: string }) => m.profile_id))
          .gt('credits_remaining', 0)

        // Build lookup maps
        const membershipMap = new Map(
          (memberships ?? []).map((m: { profile_id: string; membership_tier: string; membership_status: string }) => [m.profile_id, m])
        )
        const creditsMap = new Map<string, number>()
        for (const pack of creditPacks ?? []) {
          creditsMap.set(
            pack.member_id,
            (creditsMap.get(pack.member_id) ?? 0) + pack.credits_remaining
          )
        }

        for (const member of members) {
          // Determine A/B variant
          let variant: 'A' | 'B' | null = null
          let resolvedSubjectTemplate = subject
          let resolvedBodyTemplate = bodyTemplate

          if (campaign?.ab_test_enabled) {
            // B12 FIX: real schema uses ab_variants jsonb
            const variants = campaign.ab_variants as {
              a?: { subject?: string; body_html?: string }
              b?: { subject?: string; body_html?: string }
              split_percentage?: number
            } | null
            const splitPct = variants?.split_percentage ?? 50
            variant = randomInt(100) < splitPct ? 'A' : 'B'
            const chosen = variant === 'A' ? variants?.a : variants?.b
            resolvedSubjectTemplate = chosen?.subject ?? subject
            resolvedBodyTemplate = chosen?.body_html ?? bodyTemplate
          }

          const nameParts = (member.full_name ?? '').split(' ')
          const firstName = nameParts[0] ?? ''
          const lastName = nameParts.slice(1).join(' ')
          const membership = membershipMap.get(member.id) as { profile_id: string; membership_tier: string; membership_status: string } | undefined
          const credits = creditsMap.get(member.id) ?? 0

          const mergeData = {
            first_name: firstName,
            last_name: lastName,
            credits_remaining: credits,
            membership_name: membership?.membership_tier ?? 'No active membership',
            total_visits: 0,
            campaign_name: campaign?.name ?? campaignId,
          }

          // Resolve template
          const resolvedBody = resolveTemplate(resolvedBodyTemplate, mergeData)
          const bodyHtml = textToHtml(resolvedBody)
          const html = wrapEmailLayout(bodyHtml)
          const resolvedSubject = resolveTemplate(resolvedSubjectTemplate, mergeData)

          // Send
          const result = await sendCampaignEmail(
            member.email,
            resolvedSubject,
            html,
            campaignId,
            member.id
          )

          if (result.error) {
            failed++

            // Write to campaign_recipients
            await supabase.from('campaign_recipients').insert({
              campaign_id: campaignId,
              member_id: member.id,
              studio_id: STUDIO_ID,
              ab_variant: variant,
              status: 'failed',
              sent_at: null,
            })

            // Log to email_send_log (backward compat)
            await supabase.from('email_send_log').insert({
              studio_id: STUDIO_ID,
              campaign_id: campaignId,
              member_id: member.id,
              subject: resolvedSubject,
              status: 'failed',
              error_message: result.error,
            })

            sendEvent({ type: 'failed', memberId: member.id, error: result.error, variant })
          } else {
            sent++

            // Write to campaign_recipients
            await supabase.from('campaign_recipients').insert({
              campaign_id: campaignId,
              member_id: member.id,
              studio_id: STUDIO_ID,
              ab_variant: variant,
              status: 'sent',
              resend_message_id: result.id,
              sent_at: new Date().toISOString(),
            })

            // Log to email_send_log (backward compat)
            await supabase.from('email_send_log').insert({
              studio_id: STUDIO_ID,
              campaign_id: campaignId,
              member_id: member.id,
              resend_message_id: result.id,
              message_id: result.messageId,
              subject: resolvedSubject,
              status: 'sent',
            })

            sendEvent({ type: 'sent', memberId: member.id, resendId: result.id, variant })
          }

          // Rate limit delay
          await new Promise((resolve) => setTimeout(resolve, SEND_DELAY_MS))
        }
      }

      // ─── Update Denormalized Counts on Campaign ─────────────
      const { data: currentState } = await supabase
        .from('campaigns')
        .select('status')
        .eq('id', campaignId)
        .single()

      const finalStatus = currentState?.status === 'paused' ? 'paused' : 'sent'

      // B12 FIX: real schema uses `send_completed_at`, not `completed_at`.
      // There is no `failed_count` column — failures are tracked via
      // `email_send_log.status='failed'` rows and can be counted on demand.
      // The `failed` local counter is still included in the final SSE
      // payload so the client UI sees it.
      await supabase
        .from('campaigns')
        .update({
          status: finalStatus,
          sent_count: sent,
          send_completed_at: finalStatus === 'sent' ? new Date().toISOString() : null,
          recipient_count: total,
          updated_at: new Date().toISOString(),
        })
        .eq('id', campaignId)
        .eq('studio_id', STUDIO_ID)

      // Log activity
      await supabase.from('activity_log').insert({
        studio_id: STUDIO_ID,
        actor_id: user.id,
        type: 'campaign_sent',
        subject_type: 'campaign',
        subject_id: campaignId,
        metadata: { sent, failed, skippedPrefs, skippedAlreadySent, total, status: finalStatus },
      })

      sendEvent({
        type: 'complete',
        sent,
        failed,
        skippedPrefs,
        skippedAlreadySent,
        total,
        status: finalStatus,
      })
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
