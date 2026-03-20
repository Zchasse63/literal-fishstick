/**
 * Inngest Cron Function: Invoice Overdue Check
 *
 * Runs daily at 8 AM ET (13:00 UTC) to find corporate invoices that are
 * past their due date. Marks them as overdue and sends a payment reminder
 * email to the company's billing contact via Resend.
 */
import { inngest } from '@/lib/inngest/client';
import { getAdminClient } from '@/lib/inngest/helpers';
import { Resend } from 'resend';

const STUDIO_ID = '11111111-1111-1111-1111-111111111111';

export const cronInvoiceOverdue = inngest.createFunction(
  {
    id: 'cron-invoice-overdue',
    name: 'Daily Invoice Overdue Check',
    retries: 2,
    concurrency: [{ limit: 1 }],
    triggers: [{ cron: '0 13 * * *' }], // Daily 8 AM ET = 13:00 UTC
  },
  async ({ step }) => {
    const db = getAdminClient();
    const today = new Date().toISOString().split('T')[0];

    // ── Find overdue invoices ────────────────────────────────
    const overdueInvoices = await step.run('find-overdue-invoices', async () => {
      const { data, error } = await db
        .from('corporate_invoices')
        .select(
          'id, invoice_number, company_id, amount, due_date, status',
        )
        .eq('studio_id', STUDIO_ID)
        .eq('status', 'sent')
        .lt('due_date', today);

      if (error) {
        console.error('[invoice-overdue] Failed to query invoices:', error);
        return [];
      }

      return data ?? [];
    });

    if (overdueInvoices.length === 0) {
      return { status: 'no_overdue_invoices', updated: 0, emails_sent: 0 };
    }

    // ── Mark invoices as overdue ─────────────────────────────
    const updateResult = await step.run('mark-overdue', async () => {
      const now = new Date().toISOString();
      let updated = 0;

      for (const invoice of overdueInvoices) {
        const { error } = await db
          .from('corporate_invoices')
          .update({ status: 'overdue', updated_at: now })
          .eq('id', invoice.id);

        if (error) {
          console.error(
            `[invoice-overdue] Failed to update invoice ${invoice.id}:`,
            error,
          );
        } else {
          updated++;
        }
      }

      return updated;
    });

    // ── Fetch company billing details ────────────────────────
    const companyIds = [...new Set(overdueInvoices.map((i: { company_id: string }) => i.company_id))];

    const companies = await step.run('fetch-companies', async () => {
      const { data, error } = await db
        .from('company_accounts')
        .select('id, company_name, billing_email')
        .in('id', companyIds);

      if (error) {
        console.error('[invoice-overdue] Failed to query companies:', error);
        return [];
      }

      return data ?? [];
    });

    const companyMap = new Map(
      companies.map((c: { id: string; company_name: string; billing_email: string }) => [c.id, c]),
    );

    // ── Send payment reminder emails ─────────────────────────
    const emailResult = await step.run('send-reminders', async () => {
      const resend = new Resend(process.env.RESEND_API_KEY!);
      const from = process.env.RESEND_FROM_ADDRESS ?? 'Meridian <noreply@thesaunaguys.com>';
      let sent = 0;
      let failed = 0;

      for (const invoice of overdueInvoices) {
        const company = companyMap.get(invoice.company_id) as
          | { company_name: string; billing_email: string }
          | undefined;
        if (!company?.billing_email) {
          console.warn(
            `[invoice-overdue] No billing email for company ${invoice.company_id}`,
          );
          failed++;
          continue;
        }

        try {
          const amount = (invoice.amount / 100).toFixed(2);
          await resend.emails.send({
            from,
            to: company.billing_email,
            subject: `[Action Required] Invoice ${invoice.invoice_number ?? invoice.id} is overdue`,
            html: `
              <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #111827;">Payment Reminder</h2>
                <p style="color: #6B7280;">
                  Dear ${company.company_name} team,
                </p>
                <p style="color: #6B7280;">
                  Invoice <strong>${invoice.invoice_number ?? invoice.id}</strong> for
                  <strong>$${amount}</strong> was due on
                  <strong>${invoice.due_date}</strong> and is now overdue.
                </p>
                <p style="color: #6B7280;">
                  Please arrange payment at your earliest convenience. If you have
                  already made payment, please disregard this notice.
                </p>
                <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
                <p style="color: #9CA3AF; font-size: 12px;">
                  This is an automated reminder from Meridian.
                </p>
              </div>
            `,
          });
          sent++;
        } catch (err) {
          console.error(
            `[invoice-overdue] Failed to email ${company.billing_email}:`,
            err,
          );
          failed++;
        }
      }

      return { sent, failed };
    });

    return {
      status: 'completed',
      overdue_found: overdueInvoices.length,
      invoices_updated: updateResult,
      emails_sent: emailResult.sent,
      emails_failed: emailResult.failed,
    };
  },
);
