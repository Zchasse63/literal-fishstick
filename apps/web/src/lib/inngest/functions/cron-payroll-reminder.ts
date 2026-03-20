/**
 * Inngest Cron Function: Payroll Reminder
 *
 * Runs every Monday at 9 AM ET (14:00 UTC) to check for open payroll periods
 * that have ended but not yet been processed. Sends a reminder email to
 * studio owners and managers via Resend.
 */
import { inngest } from '@/lib/inngest/client';
import { getAdminClient } from '@/lib/inngest/helpers';
import { Resend } from 'resend';

const STUDIO_ID = '11111111-1111-1111-1111-111111111111';

export const cronPayrollReminder = inngest.createFunction(
  {
    id: 'cron-payroll-reminder',
    name: 'Weekly Payroll Reminder',
    retries: 2,
    concurrency: [{ limit: 1 }],
    triggers: [{ cron: '0 14 * * 1' }], // Monday 9 AM ET = 14:00 UTC
  },
  async ({ step }) => {
    const db = getAdminClient();

    // ── Find open payroll periods past their end date ─────────
    const openPeriods = await step.run('find-open-periods', async () => {
      const now = new Date().toISOString();

      const { data, error } = await db
        .from('payroll_periods')
        .select('id, period_start, period_end, status')
        .eq('studio_id', STUDIO_ID)
        .eq('status', 'open')
        .lt('period_end', now);

      if (error) {
        console.error('[payroll-reminder] Failed to query payroll periods:', error);
        return [];
      }

      return data ?? [];
    });

    if (openPeriods.length === 0) {
      return { status: 'no_open_periods', reminders_sent: 0 };
    }

    // ── Find owners/managers to notify ───────────────────────
    const recipients = await step.run('find-recipients', async () => {
      const { data, error } = await db
        .from('profiles')
        .select('id, email, full_name, roles')
        .eq('studio_id', STUDIO_ID)
        .or('roles.cs.{admin},roles.cs.{manager}');

      if (error) {
        console.error('[payroll-reminder] Failed to query recipients:', error);
        return [];
      }

      return (data ?? []).filter(
        (p: { roles: string[] }) =>
          p.roles?.includes('admin') || p.roles?.includes('manager'),
      );
    });

    if (recipients.length === 0) {
      return { status: 'no_recipients', periods_found: openPeriods.length };
    }

    // ── Send reminder emails ─────────────────────────────────
    const sendResult = await step.run('send-reminders', async () => {
      const resend = new Resend(process.env.RESEND_API_KEY!);
      const from = process.env.RESEND_FROM_ADDRESS ?? 'Meridian <noreply@thesaunaguys.com>';
      let sent = 0;
      let failed = 0;

      const periodSummary = openPeriods
        .map(
          (p: { period_start: string; period_end: string }) =>
            `${p.period_start} to ${p.period_end}`,
        )
        .join(', ');

      for (const recipient of recipients) {
        try {
          await resend.emails.send({
            from,
            to: recipient.email,
            subject: `[Meridian] ${openPeriods.length} payroll period(s) need processing`,
            html: `
              <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #111827;">Payroll Reminder</h2>
                <p style="color: #6B7280;">
                  Hi ${recipient.full_name?.split(' ')[0] ?? 'there'},
                </p>
                <p style="color: #6B7280;">
                  You have <strong>${openPeriods.length}</strong> payroll period(s) that have
                  ended but are still open and need to be processed:
                </p>
                <p style="color: #374151; font-weight: 500;">${periodSummary}</p>
                <p style="color: #6B7280;">
                  Please review and finalize payroll in the Meridian Operations module.
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
            `[payroll-reminder] Failed to send to ${recipient.email}:`,
            err,
          );
          failed++;
        }
      }

      return { sent, failed };
    });

    return {
      status: 'completed',
      open_periods: openPeriods.length,
      reminders_sent: sendResult.sent,
      reminders_failed: sendResult.failed,
    };
  },
);
