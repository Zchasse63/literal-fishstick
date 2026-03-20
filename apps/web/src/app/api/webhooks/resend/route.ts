import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { createServerClient } from '@/lib/supabase/server'

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

  try {
    switch (payload.type) {
      case 'email.delivered': {
        await supabase
          .from('email_send_log')
          .update({
            status: 'delivered',
            delivered_at: payload.created_at,
          })
          .eq('resend_id', resendId)
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
        break
      }

      case 'email.bounced': {
        await supabase
          .from('email_send_log')
          .update({ status: 'bounced' })
          .eq('resend_id', resendId)
        break
      }

      case 'email.complained': {
        await supabase
          .from('email_send_log')
          .update({ status: 'complained' })
          .eq('resend_id', resendId)
        break
      }

      case 'email.received': {
        // Reply detection — match In-Reply-To header against stored Message-IDs
        const headers = payload.data.headers ?? []
        const inReplyTo = headers.find((h) => h.name.toLowerCase() === 'in-reply-to')?.value
        const references = headers.find((h) => h.name.toLowerCase() === 'references')?.value

        // Try In-Reply-To first, then first reference
        const replyToMessageId = inReplyTo ?? references?.split(/\s+/)?.[0]

        if (replyToMessageId) {
          // Find the original send log by message_id
          const { data: originalLog } = await supabase
            .from('email_send_log')
            .select('id, campaign_id, member_id')
            .eq('message_id', replyToMessageId)
            .maybeSingle()

          if (originalLog) {
            // Update the send log with replied_at
            await supabase
              .from('email_send_log')
              .update({ replied_at: payload.created_at })
              .eq('id', originalLog.id)

            // If this was a campaign email, update campaign_members status
            if (originalLog.campaign_id) {
              await supabase
                .from('campaign_members')
                .update({
                  status: 'responded',
                  replied_at: payload.created_at,
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
