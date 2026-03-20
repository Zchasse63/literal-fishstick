import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { sendCampaignEmail } from '@/lib/resend'
import { resolveTemplate, textToHtml, wrapEmailLayout } from '@/lib/email-templates'

const STUDIO_ID = '11111111-1111-1111-1111-111111111111'
const ALLOWED_ROLES = ['admin', 'manager']
const DEFAULT_BATCH_SIZE = 10
const SEND_DELAY_MS = 200
const DUPLICATE_WINDOW_MINUTES = 5

/**
 * POST /api/campaigns/send
 *
 * Send campaign emails in batches with SSE streaming for progress.
 * Body: { campaignId, templateId?, memberIds, subject, bodyTemplate, batchSize? }
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerClient()

  // ─── Auth ──────────────────────────────────────────────────
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Check role
  const { data: profile } = await supabase
    .from('profiles')
    .select('roles')
    .eq('id', user.id)
    .single()

  const roles: string[] = profile?.roles ?? []
  const hasPermission = roles.some((r: string) => ALLOWED_ROLES.includes(r))
  if (!hasPermission) {
    return new Response(JSON.stringify({ error: 'Insufficient permissions. Admin or manager role required.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

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
    return new Response(JSON.stringify({
      error: `Campaign ${campaignId} was already sent within the last ${DUPLICATE_WINDOW_MINUTES} minutes. Wait before retrying.`,
    }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ─── SSE Stream ────────────────────────────────────────────
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      let sent = 0
      let failed = 0
      const total = memberIds.length

      sendEvent({ type: 'start', total })

      // Process in batches
      for (let i = 0; i < memberIds.length; i += batchSize) {
        const batch = memberIds.slice(i, i + batchSize)

        // Fetch member data for this batch
        const { data: members, error: membersError } = await supabase
          .from('profiles')
          .select('id, email, full_name, phone')
          .in('id', batch)
          .eq('studio_id', STUDIO_ID)

        if (membersError || !members) {
          sendEvent({ type: 'error', message: `Failed to fetch members: ${membersError?.message}` })
          continue
        }

        // Fetch membership + credits for merge tags
        const { data: memberships } = await supabase
          .from('memberships')
          .select('member_id, type, status')
          .in('member_id', batch)
          .eq('status', 'active')

        const { data: creditPacks } = await supabase
          .from('credit_packs')
          .select('member_id, remaining_credits')
          .in('member_id', batch)
          .gt('remaining_credits', 0)

        // Build lookup maps
        const membershipMap = new Map(
          (memberships ?? []).map((m: { member_id: string; type: string; status: string }) => [m.member_id, m])
        )
        const creditsMap = new Map<string, number>()
        for (const pack of creditPacks ?? []) {
          creditsMap.set(
            pack.member_id,
            (creditsMap.get(pack.member_id) ?? 0) + pack.remaining_credits
          )
        }

        for (const member of members) {
          const nameParts = (member.full_name ?? '').split(' ')
          const firstName = nameParts[0] ?? ''
          const lastName = nameParts.slice(1).join(' ')
          const membership = membershipMap.get(member.id) as { member_id: string; type: string; status: string } | undefined
          const credits = creditsMap.get(member.id) ?? 0

          const mergeData = {
            first_name: firstName,
            last_name: lastName,
            credits_remaining: credits,
            membership_name: membership?.type ?? 'No active membership',
            total_visits: 0, // Would come from check-ins table
            campaign_name: campaignId,
          }

          // Resolve template
          const resolvedBody = resolveTemplate(bodyTemplate, mergeData)
          const bodyHtml = textToHtml(resolvedBody)
          const html = wrapEmailLayout(bodyHtml)
          const resolvedSubject = resolveTemplate(subject, mergeData)

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
            // Log failure
            await supabase.from('email_send_log').insert({
              studio_id: STUDIO_ID,
              campaign_id: campaignId,
              member_id: member.id,
              subject: resolvedSubject,
              status: 'failed',
              error_message: result.error,
            })
            sendEvent({ type: 'failed', memberId: member.id, error: result.error })
          } else {
            sent++
            // Log success
            await supabase.from('email_send_log').insert({
              studio_id: STUDIO_ID,
              campaign_id: campaignId,
              member_id: member.id,
              resend_id: result.id,
              message_id: result.messageId,
              subject: resolvedSubject,
              status: 'sent',
            })
            sendEvent({ type: 'sent', memberId: member.id, resendId: result.id })
          }

          // Rate limit delay
          await new Promise((resolve) => setTimeout(resolve, SEND_DELAY_MS))
        }
      }

      sendEvent({ type: 'complete', sent, failed, total })
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
