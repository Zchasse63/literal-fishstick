import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { sendTransactionalEmail } from '@/lib/resend'

const STUDIO_ID = '11111111-1111-1111-1111-111111111111'
const ALLOWED_ROLES = ['owner', 'manager']

/**
 * POST /api/invoices/[id]/send
 *
 * Send an invoice via Resend email.
 * Sets status to 'sent' and sent_at to now.
 * Sends to company's billing_email or contact_email.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient()
    const { id } = await params

    // ─── Auth ──────────────────────────────────────────────────
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, roles, studio_id')
      .eq('id', user.id)
      .single()

    const roles: string[] = profile?.roles ?? []
    if (!roles.some((r: string) => ALLOWED_ROLES.includes(r))) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Owner or manager role required.' },
        { status: 403 }
      )
    }

    const studioId = profile?.studio_id || STUDIO_ID

    // ─── Fetch Invoice with Company ──────────────────────────
    const { data: invoice, error: invoiceError } = await supabase
      .from('corporate_invoices')
      .select('*, company_accounts(name, contact_name, contact_email, billing_email)')
      .eq('id', id)
      .eq('studio_id', studioId)
      .single()

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    if (!['draft', 'sent'].includes(invoice.status)) {
      return NextResponse.json(
        { error: `Cannot send invoice with status "${invoice.status}". Must be "draft" or "sent".` },
        { status: 409 }
      )
    }

    // ─── Determine Recipient ──────────────────────────────────
    const company = invoice.company_accounts as {
      name: string
      contact_name: string
      contact_email: string
      billing_email: string | null
    } | null

    const recipientEmail = company?.billing_email || company?.contact_email

    if (!recipientEmail) {
      return NextResponse.json(
        { error: 'No billing or contact email found for this company.' },
        { status: 400 }
      )
    }

    // ─── Build Email HTML ─────────────────────────────────────
    const lineItemsHtml = (invoice.line_items as { description: string; quantity: number; unit_price: number; total: number }[])
      .map((item) =>
        `<tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.description}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${item.unit_price.toFixed(2)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${item.total.toFixed(2)}</td>
        </tr>`
      )
      .join('')

    const html = `
      <div style="font-family: Inter, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1f;">
        <div style="background: #4F46E5; padding: 24px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Meridian</h1>
          <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0;">Invoice ${invoice.invoice_number}</p>
        </div>
        <div style="padding: 24px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none;">
          <p>Hi ${company?.contact_name ?? 'there'},</p>
          <p>Please find your invoice details below.</p>

          <div style="background: #f5f5f4; padding: 16px; border-radius: 6px; margin: 16px 0;">
            <p style="margin: 0; font-size: 14px; color: #6b7280;">Invoice Number</p>
            <p style="margin: 4px 0 0; font-size: 18px; font-weight: bold;">${invoice.invoice_number}</p>
            <p style="margin: 12px 0 0; font-size: 14px; color: #6b7280;">Due Date</p>
            <p style="margin: 4px 0 0; font-size: 16px;">${invoice.due_date}</p>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <thead>
              <tr style="background: #f5f5f4;">
                <th style="padding: 8px; text-align: left; font-size: 12px; color: #6b7280;">Description</th>
                <th style="padding: 8px; text-align: center; font-size: 12px; color: #6b7280;">Qty</th>
                <th style="padding: 8px; text-align: right; font-size: 12px; color: #6b7280;">Unit Price</th>
                <th style="padding: 8px; text-align: right; font-size: 12px; color: #6b7280;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${lineItemsHtml}
            </tbody>
          </table>

          <div style="text-align: right; margin-top: 16px;">
            <p style="margin: 4px 0; color: #6b7280;">Subtotal: <strong>$${invoice.subtotal.toFixed(2)}</strong></p>
            ${invoice.discount_amount > 0 ? `<p style="margin: 4px 0; color: #6b7280;">Discount: <strong>-$${invoice.discount_amount.toFixed(2)}</strong></p>` : ''}
            ${invoice.tax_amount > 0 ? `<p style="margin: 4px 0; color: #6b7280;">Tax (${invoice.tax_rate}%): <strong>$${invoice.tax_amount.toFixed(2)}</strong></p>` : ''}
            <p style="margin: 8px 0 0; font-size: 20px; font-weight: bold; color: #4F46E5;">Total: $${invoice.total.toFixed(2)}</p>
          </div>

          ${invoice.notes ? `<div style="margin-top: 16px; padding: 12px; background: #fefce8; border-radius: 6px; font-size: 14px;"><strong>Notes:</strong> ${invoice.notes}</div>` : ''}
        </div>
        <div style="padding: 16px; text-align: center; font-size: 12px; color: #9ca3af;">
          Sent via Meridian — Fitness Studio Operating System
        </div>
      </div>
    `

    // ─── Send Email ───────────────────────────────────────────
    const result = await sendTransactionalEmail(
      recipientEmail,
      `Invoice ${invoice.invoice_number} from The Sauna Guys`,
      html,
      { tags: [{ name: 'type', value: 'invoice' }, { name: 'invoice_id', value: id }] }
    )

    if (result.error) {
      return NextResponse.json(
        { error: `Failed to send email: ${result.error}` },
        { status: 500 }
      )
    }

    // ─── Update Invoice Status ────────────────────────────────
    const now = new Date().toISOString()
    const { data: updated, error: updateError } = await supabase
      .from('corporate_invoices')
      .update({
        status: 'sent',
        sent_at: now,
        updated_at: now,
      })
      .eq('id', id)
      .eq('studio_id', studioId)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Log activity
    await supabase.from('activity_log').insert({
      studio_id: studioId,
      actor_id: user.id,
      action: 'invoice_sent',
      entity_type: 'corporate_invoice',
      entity_id: id,
      metadata: {
        invoice_number: invoice.invoice_number,
        sent_to: recipientEmail,
        resend_message_id: result.id,
      },
    })

    return NextResponse.json({ data: updated, sent_to: recipientEmail })
  } catch (err) {
    console.error('POST /api/invoices/[id]/send error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
