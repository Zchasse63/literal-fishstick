import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

const RESEND_WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET!

interface ResendWebhookPayload {
  type: string
  created_at: string
  data: {
    email_id: string
    from: string
    to: string[]
    subject: string
    headers?: { name: string; value: string }[]
    tags?: { name: string; value: string }[]
    click?: { link: string }
    bounce?: { type: 'hard' | 'soft' }
  }
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const svixId = request.headers.get('svix-id')
  const svixTimestamp = request.headers.get('svix-timestamp')
  const svixSignature = request.headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 })
  }

  let payload: ResendWebhookPayload

  try {
    const wh = new Webhook(RESEND_WEBHOOK_SECRET)
    payload = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ResendWebhookPayload
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`Resend webhook verification failed: ${message}`)
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 })
  }

  const supabase = await createServerClient()
  const resendId = payload.data.email_id

  // Extract campaign_id and member_id from tags (set during campaign/automation sends)
  const tags = payload.data.tags ?? []
  const campaignId = tags.find((t) => t.name === 'campaign_id')?.value
  const memberId = tags.find((t) => t.name === 'member_id')?.value

  try {
    switch (payload.type) {
      case 'email.delivered': {
        // Update email_send_log
        await supabase
          .from('email_send_log')
          .update({
            status: 'delivered',
            delivered_at: payload.created_at,
          })
          .eq('resend_id', resendId)

        // Update campaign_recipients if this is a campaign email
        if (campaignId && memberId) {
          await supabase
            .from('campaign_recipients')
            .update({
              status: 'delivered',
              delivered_at: payload.created_at,
            })
            .eq('resend_message_id', resendId)

          // Increment delivered_count on campaigns
          await supabase.rpc('increment_campaign_metric', {
            p_campaign_id: campaignId,
            p_metric: 'delivered_count',
          })
        }
        break
      }

      case 'email.opened': {
        await supabase
          .from('email_send_log')
          .update({
            status: 'opened',
            opened_at: payload.created_at,
          })
          .eq('resend_id', resendId)

        if (campaignId && memberId) {
          // Only update if not already opened (first open)
          const { data: existing } = await supabase
            .from('campaign_recipients')
            .select('opened_at')
            .eq('resend_message_id', resendId)
            .single()

          if (existing && !existing.opened_at) {
            await supabase
              .from('campaign_recipients')
              .update({
                status: 'opened',
                opened_at: payload.created_at,
              })
              .eq('resend_message_id', resendId)

            await supabase.rpc('increment_campaign_metric', {
              p_campaign_id: campaignId,
              p_metric: 'open_count',
            })
          }
        }
        break
      }

      case 'email.clicked': {
        const clickedUrl = payload.data.click?.link ?? null
        await supabase
          .from('email_send_log')
          .update({
            status: 'clicked',
            clicked_at: payload.created_at,
            clicked_url: clickedUrl,
          })
          .eq('resend_id', resendId)

        if (campaignId && memberId) {
          const { data: existing } = await supabase
            .from('campaign_recipients')
            .select('clicked_at, click_urls')
            .eq('resend_message_id', resendId)
            .single()

          const isFirstClick = existing && !existing.clicked_at
          const updatedUrls = [
            ...((existing?.click_urls as string[]) ?? []),
            ...(clickedUrl ? [clickedUrl] : []),
          ]

          await supabase
            .from('campaign_recipients')
            .update({
              status: 'clicked',
              clicked_at: existing?.clicked_at ?? payload.created_at,
              click_urls: updatedUrls,
            })
            .eq('resend_message_id', resendId)

          if (isFirstClick) {
            await supabase.rpc('increment_campaign_metric', {
              p_campaign_id: campaignId,
              p_metric: 'click_count',
            })
          }
        }
        break
      }

      case 'email.bounced': {
        const bounceType = payload.data.bounce?.type ?? 'soft'

        await supabase
          .from('email_send_log')
          .update({ status: 'bounced' })
          .eq('resend_id', resendId)

        if (campaignId && memberId) {
          await supabase
            .from('campaign_recipients')
            .update({ status: 'bounced' })
            .eq('resend_message_id', resendId)

          await supabase.rpc('increment_campaign_metric', {
            p_campaign_id: campaignId,
            p_metric: 'bounce_count',
          })

          // Hard bounce: suppress future sends by updating email_preferences
          if (bounceType === 'hard' && memberId) {
            await supabase
              .from('email_preferences')
              .upsert(
                {
                  member_id: memberId,
                  studio_id: tags.find((t) => t.name === 'studio_id')?.value ?? DEFAULT_STUDIO_ID,
                  hard_bounced: true,
                  hard_bounced_at: payload.created_at,
                  marketing_email: false,
                },
                { onConflict: 'member_id,studio_id' }
              )
          }
        }
        break
      }

      case 'email.complained': {
        await supabase
          .from('email_send_log')
          .update({ status: 'complained' })
          .eq('resend_id', resendId)

        // Auto-unsubscribe on complaint
        if (memberId) {
          await supabase
            .from('email_preferences')
            .upsert(
              {
                member_id: memberId,
                studio_id: tags.find((t) => t.name === 'studio_id')?.value ?? DEFAULT_STUDIO_ID,
                marketing_email: false,
                unsubscribed_at: payload.created_at,
                unsubscribe_reason: 'spam_complaint',
              },
              { onConflict: 'member_id,studio_id' }
            )
        }

        if (campaignId) {
          await supabase.rpc('increment_campaign_metric', {
            p_campaign_id: campaignId,
            p_metric: 'unsubscribe_count',
          })
        }
        break
      }

      case 'email.received': {
        // Reply detection — match In-Reply-To header against stored Message-IDs
        const headers = payload.data.headers ?? []
        const inReplyTo = headers.find((h) => h.name.toLowerCase() === 'in-reply-to')?.value
        const references = headers.find((h) => h.name.toLowerCase() === 'references')?.value
        const replyToMessageId = inReplyTo ?? references?.split(/\s+/)?.[0]

        if (replyToMessageId) {
          const { data: originalLog } = await supabase
            .from('email_send_log')
            .select('id, campaign_id, member_id')
            .eq('message_id', replyToMessageId)
            .maybeSingle()

          if (originalLog) {
            await supabase
              .from('email_send_log')
              .update({ replied_at: payload.created_at })
              .eq('id', originalLog.id)

            if (originalLog.campaign_id) {
              // campaign_recipients has no `replied_at` — just flip status.
              // The reply timestamp lives on email_send_log.replied_at above.
              await supabase
                .from('campaign_recipients')
                .update({
                  status: 'responded',
                })
                .eq('campaign_id', originalLog.campaign_id)
                .eq('member_id', originalLog.member_id)
            }
          }
        }
        break
      }

      default:
        console.log(`Unhandled Resend event type: ${payload.type}`)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`Error processing Resend webhook ${payload.type}: ${message}`)
    return NextResponse.json({ error: 'Webhook processing error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
