import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { sendCampaignEmail } from '@/lib/resend'
import { resolveTemplate, textToHtml, wrapEmailLayout } from '@/lib/email-templates'
import { randomInt } from 'crypto'

const STUDIO_ID = '11111111-1111-1111-1111-111111111111'
const AUTO_CANCEL_WINDOW_MS = 2 * 60 * 60 * 1000 // 2 hours
const BATCH_SIZE = 10
const SEND_DELAY_MS = 200

/**
 * POST /api/campaigns/process-scheduled
 *
 * Netlify scheduled function endpoint. Finds campaigns where
 * status='scheduled' AND scheduled_at <= NOW().
 *
 * - If scheduled_at is more than 2 hours past, auto-cancel with reason.
 * - Otherwise, trigger the send flow (respecting email preferences, writing
 *   to campaign_recipients, updating denormalized counts).
 *
 * This is designed to be called by a cron trigger, but includes auth
 * checks for manual invocation via the dashboard.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    // ─── Auth (optional — allow cron secret OR authenticated admin) ─
    const cronSecret = request.headers.get('x-cron-secret')
    const expectedSecret = process.env.CRON_SECRET

    if (cronSecret && expectedSecret && cronSecret === expectedSecret) {
      // Authenticated via cron secret — proceed
    } else {
      // Fall back to user auth
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('roles')
        .eq('id', user.id)
        .single()

      const roles: string[] = profile?.roles ?? []
      if (!roles.some((r: string) => ['owner', 'manager'].includes(r))) {
        return NextResponse.json(
          { error: 'Insufficient permissions. Owner or manager role required.' },
          { status: 403 }
        )
      }
    }

    // ─── Find Due Campaigns ────────────────────────────────────
    const now = new Date()
    const { data: campaigns, error: fetchError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('studio_id', STUDIO_ID)
      .eq('status', 'scheduled')
      .lte('scheduled_at', now.toISOString())
      .is('deleted_at', null)
      .order('scheduled_at', { ascending: true })

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!campaigns || campaigns.length === 0) {
      return NextResponse.json({ processed: 0, message: 'No scheduled campaigns due' })
    }

    const results: Array<{
      campaign_id: string
      name: string
      action: 'sent' | 'auto_cancelled'
      sent?: number
      failed?: number
      reason?: string
    }> = []

    for (const campaign of campaigns) {
      const scheduledAt = new Date(campaign.scheduled_at)
      const msSinceScheduled = now.getTime() - scheduledAt.getTime()

      // ─── Auto-Cancel if >2 Hours Past ──────────────────────
      if (msSinceScheduled > AUTO_CANCEL_WINDOW_MS) {
        await supabase
          .from('campaigns')
          .update({
            status: 'cancelled',
            updated_at: now.toISOString(),
          })
          .eq('id', campaign.id)

        await supabase.from('activity_log').insert({
          studio_id: STUDIO_ID,
          actor_id: null,
          type: 'campaign_auto_cancelled',
          subject_type: 'campaign',
          subject_id: campaign.id,
          metadata: {
            reason: 'Scheduled time exceeded 2-hour auto-cancel window',
            scheduled_at: campaign.scheduled_at,
            detected_at: now.toISOString(),
          },
        })

        results.push({
          campaign_id: campaign.id,
          name: campaign.name,
          action: 'auto_cancelled',
          reason: 'Exceeded 2-hour window',
        })
        continue
      }

      // ─── Send the Campaign ─────────────────────────────────
      // Mark as sending
      await supabase
        .from('campaigns')
        .update({
          status: 'sending',
          sent_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq('id', campaign.id)

      // Resolve recipients from the segment
      let memberIds: string[] = []

      if (campaign.segment_id) {
        // Fetch segment to get its filter criteria
        const { data: segment } = await supabase
          .from('segments')
          .select('member_ids')
          .eq('id', campaign.segment_id)
          .single()

        memberIds = segment?.member_ids ?? []
      }

      if (memberIds.length === 0) {
        // No recipients — mark completed
        await supabase
          .from('campaigns')
          .update({
            status: 'completed',
            completed_at: now.toISOString(),
            updated_at: now.toISOString(),
          })
          .eq('id', campaign.id)

        results.push({
          campaign_id: campaign.id,
          name: campaign.name,
          action: 'sent',
          sent: 0,
          failed: 0,
        })
        continue
      }

      let sent = 0
      let failed = 0

      // Process in batches
      for (let i = 0; i < memberIds.length; i += BATCH_SIZE) {
        const batchIds = memberIds.slice(i, i + BATCH_SIZE)

        // Check if campaign was paused during send
        const { data: currentState } = await supabase
          .from('campaigns')
          .select('status')
          .eq('id', campaign.id)
          .single()

        if (currentState?.status === 'paused') {
          break
        }

        // Re-check email preferences at each batch boundary
        const { data: preferences } = await supabase
          .from('email_preferences')
          .select('member_id')
          .in('member_id', batchIds)
          .or('marketing_email.eq.false,hard_bounced.eq.true')

        const excludedIds = new Set((preferences ?? []).map((p: { member_id: string }) => p.member_id))
        const eligibleIds = batchIds.filter((mid: string) => !excludedIds.has(mid))

        if (eligibleIds.length === 0) continue

        // Check for already-sent recipients (resumable sends)
        const { data: alreadySent } = await supabase
          .from('campaign_recipients')
          .select('member_id')
          .eq('campaign_id', campaign.id)
          .in('member_id', eligibleIds)
          .eq('status', 'sent')

        const alreadySentIds = new Set((alreadySent ?? []).map((r: { member_id: string }) => r.member_id))
        const toSendIds = eligibleIds.filter((mid: string) => !alreadySentIds.has(mid))

        if (toSendIds.length === 0) continue

        // Fetch member data
        const { data: members } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', toSendIds)
          .eq('studio_id', STUDIO_ID)

        if (!members || members.length === 0) continue

        // Fetch membership data for merge tags
        const { data: memberships } = await supabase
          .from('members')
          .select('profile_id, membership_tier')
          .in('profile_id', toSendIds)
          .eq('membership_status', 'active')

        const membershipMap = new Map(
          (memberships ?? []).map((m: { profile_id: string; membership_tier: string }) => [m.profile_id, m])
        )

        for (const member of members) {
          // Determine variant for A/B tests
          let variant: 'A' | 'B' | null = null
          let subjectTemplate = campaign.subject
          let bodyTemplate = campaign.body_template

          if (campaign.ab_test_enabled) {
            const splitPct = campaign.ab_split_percentage ?? 50
            variant = randomInt(100) < splitPct ? 'A' : 'B'
            subjectTemplate = variant === 'A' ? campaign.variant_a_subject : campaign.variant_b_subject
            bodyTemplate = variant === 'A' ? campaign.variant_a_body : campaign.variant_b_body
          }

          const nameParts = (member.full_name ?? '').split(' ')
          const membership = membershipMap.get(member.id) as { profile_id: string; membership_tier: string } | undefined

          const mergeData = {
            first_name: nameParts[0] ?? '',
            last_name: nameParts.slice(1).join(' '),
            membership_name: membership?.membership_tier ?? 'No active membership',
            campaign_name: campaign.name,
          }

          const resolvedBody = resolveTemplate(bodyTemplate ?? '', mergeData)
          const bodyHtml = textToHtml(resolvedBody)
          const html = wrapEmailLayout(bodyHtml)
          const resolvedSubject = resolveTemplate(subjectTemplate ?? '', mergeData)

          const result = await sendCampaignEmail(
            member.email,
            resolvedSubject,
            html,
            campaign.id,
            member.id
          )

          // Write to campaign_recipients
          await supabase.from('campaign_recipients').insert({
            campaign_id: campaign.id,
            member_id: member.id,
            studio_id: STUDIO_ID,
            variant,
            status: result.error ? 'failed' : 'sent',
            resend_message_id: result.id ?? null,
            message_id: result.messageId ?? null,
            sent_at: result.error ? null : new Date().toISOString(),
            error_message: result.error ?? null,
          })

          // Also log to email_send_log for backward compatibility
          await supabase.from('email_send_log').insert({
            studio_id: STUDIO_ID,
            campaign_id: campaign.id,
            member_id: member.id,
            resend_message_id: result.id,
            message_id: result.messageId,
            subject: resolvedSubject,
            status: result.error ? 'failed' : 'sent',
            error_message: result.error ?? null,
          })

          if (result.error) {
            failed++
          } else {
            sent++
          }

          await new Promise((resolve) => setTimeout(resolve, SEND_DELAY_MS))
        }
      }

      // ─── Update Denormalized Counts ────────────────────────
      const { data: currentState } = await supabase
        .from('campaigns')
        .select('status')
        .eq('id', campaign.id)
        .single()

      const finalStatus = currentState?.status === 'paused' ? 'paused' : 'completed'

      await supabase
        .from('campaigns')
        .update({
          status: finalStatus,
          sent_count: sent,
          failed_count: failed,
          completed_at: finalStatus === 'completed' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', campaign.id)

      await supabase.from('activity_log').insert({
        studio_id: STUDIO_ID,
        actor_id: null,
        type: 'campaign_sent_by_scheduler',
        subject_type: 'campaign',
        subject_id: campaign.id,
        metadata: { sent, failed, status: finalStatus },
      })

      results.push({
        campaign_id: campaign.id,
        name: campaign.name,
        action: 'sent',
        sent,
        failed,
      })
    }

    return NextResponse.json({
      processed: results.length,
      results,
    })
  } catch (err) {
    console.error('POST /api/campaigns/process-scheduled error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
