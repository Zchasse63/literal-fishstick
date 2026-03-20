/**
 * Inngest Cron Function: Report Scheduler
 *
 * Runs daily at 7 AM ET (12:00 UTC) to find saved reports with a schedule
 * that are due for sending. Generates the report data, formats it, and
 * sends via Resend to the configured recipients.
 *
 * After sending, updates last_sent_at and calculates the next send time
 * based on the schedule_frequency.
 */
import { inngest } from '@/lib/inngest/client';
import { getAdminClient } from '@/lib/inngest/helpers';

const STUDIO_ID = '11111111-1111-1111-1111-111111111111';

interface ScheduledReport {
  id: string;
  studio_id: string;
  name: string;
  report_type: string;
  filters: Record<string, unknown> | null;
  columns: string[] | null;
  sort_by: string | null;
  sort_direction: string | null;
  group_by: string | null;
  schedule_frequency: string;
  schedule_recipients: string[];
  next_send_at: string;
}

export const cronReportScheduler = inngest.createFunction(
  {
    id: 'cron-report-scheduler',
    name: 'Scheduled Report Sender',
    retries: 2,
    concurrency: [{ limit: 5 }],
    triggers: [{ cron: '0 12 * * *' }],
  },
  async ({ step }) => {
    const db = getAdminClient();
    const now = new Date().toISOString();

    // ── Find due reports ───────────────────────────────────────
    const dueReports = await step.run('find-due-reports', async () => {
      const { data, error } = await db
        .from('saved_reports')
        .select('id, studio_id, name, report_type, filters, columns, sort_by, sort_direction, group_by, schedule_frequency, schedule_recipients, next_send_at')
        .eq('studio_id', STUDIO_ID)
        .not('schedule_frequency', 'is', null)
        .not('schedule_recipients', 'is', null)
        .lte('next_send_at', now);

      if (error) {
        console.error('[report-scheduler] Failed to load due reports:', error);
        return [];
      }

      return (data ?? []) as ScheduledReport[];
    });

    if (dueReports.length === 0) {
      return { status: 'no_reports_due', reports_sent: 0 };
    }

    let reportsSent = 0;
    let reportsFailed = 0;

    // ── Process each due report ────────────────────────────────
    for (const report of dueReports) {
      const result = await step.run(`send-report-${report.id}`, async () => {
        try {
          // Generate report data based on report_type
          const reportData = await generateReportData(db, report);

          if (!reportData || reportData.rows.length === 0) {
            console.warn(`[report-scheduler] Report ${report.id} generated no data`);
            // Still update next_send_at so we don't retry empty reports endlessly
            await updateNextSendAt(db, report);
            return { sent: false, reason: 'no_data' };
          }

          // Format as CSV for email attachment
          const csvContent = formatCSV(reportData.headers, reportData.rows);

          // Send via Resend to each recipient
          const { Resend } = await import('resend');
          const resend = new Resend(process.env.RESEND_API_KEY!);
          const fromAddress = process.env.RESEND_FROM_ADDRESS ?? 'Meridian <noreply@thesaunaguys.com>';

          const dateStr = new Date().toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });

          await resend.emails.send({
            from: fromAddress,
            to: report.schedule_recipients,
            subject: `${report.name} — ${dateStr}`,
            html: `
              <div style="font-family: Inter, -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #4F46E5;">${report.name}</h2>
                <p>Your scheduled <strong>${report.report_type.replace(/_/g, ' ')}</strong> report is attached.</p>
                <p style="color: #6B7280; font-size: 14px;">
                  ${reportData.rows.length} row${reportData.rows.length !== 1 ? 's' : ''} &middot;
                  Generated ${dateStr}
                </p>
                <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
                <p style="color: #9CA3AF; font-size: 12px;">
                  This is an automated report from Meridian. Manage your report schedules in Analytics &rarr; Saved Reports.
                </p>
              </div>
            `,
            attachments: [
              {
                filename: `${report.name.replace(/[^a-zA-Z0-9]/g, '_')}_${dateStr.replace(/[^a-zA-Z0-9]/g, '_')}.csv`,
                content: Buffer.from(csvContent).toString('base64'),
                contentType: 'text/csv',
              },
            ],
          });

          // Update timestamps
          await updateNextSendAt(db, report);

          return { sent: true };
        } catch (err) {
          console.error(`[report-scheduler] Failed to send report ${report.id}:`, err);
          return { sent: false, reason: 'error' };
        }
      });

      if (result.sent) {
        reportsSent++;
      } else {
        reportsFailed++;
      }
    }

    return {
      status: 'completed',
      reports_due: dueReports.length,
      reports_sent: reportsSent,
      reports_failed: reportsFailed,
    };
  },
);

// ---------------------------------------------------------------------------
// Report data generation
// ---------------------------------------------------------------------------

interface ReportData {
  headers: string[];
  rows: Record<string, unknown>[];
}

async function generateReportData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  report: ScheduledReport,
): Promise<ReportData> {
  const filters = report.filters ?? {};
  const dateFrom = (filters.date_from as string) ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const dateTo = (filters.date_to as string) ?? new Date().toISOString().split('T')[0];

  switch (report.report_type) {
    case 'attendance': {
      const { data } = await db
        .from('daily_metrics')
        .select('metric_date, total_bookings, total_check_ins, total_no_shows, total_cancellations, avg_class_utilization, classes_held')
        .eq('studio_id', report.studio_id)
        .gte('metric_date', dateFrom)
        .lte('metric_date', dateTo)
        .order('metric_date', { ascending: true });

      return {
        headers: ['Date', 'Bookings', 'Check-Ins', 'No-Shows', 'Cancellations', 'Utilization %', 'Classes Held'],
        rows: data ?? [],
      };
    }

    case 'revenue': {
      const { data } = await db
        .from('daily_metrics')
        .select('metric_date, total_revenue, membership_revenue, credit_pack_revenue, drop_in_revenue, merch_revenue, gift_card_revenue, refund_total')
        .eq('studio_id', report.studio_id)
        .gte('metric_date', dateFrom)
        .lte('metric_date', dateTo)
        .order('metric_date', { ascending: true });

      return {
        headers: ['Date', 'Total Revenue', 'Membership', 'Credit Packs', 'Drop-In', 'Merch', 'Gift Cards', 'Refunds'],
        rows: data ?? [],
      };
    }

    case 'membership': {
      const { data } = await db
        .from('daily_metrics')
        .select('metric_date, active_members, new_members, churned_members, total_members')
        .eq('studio_id', report.studio_id)
        .gte('metric_date', dateFrom)
        .lte('metric_date', dateTo)
        .order('metric_date', { ascending: true });

      return {
        headers: ['Date', 'Active Members', 'New Members', 'Churned Members', 'Total Members'],
        rows: data ?? [],
      };
    }

    case 'trainer_payroll': {
      const { data } = await db
        .from('trainer_metric_snapshots')
        .select('trainer_id, period_month, total_classes, base_pay, bonus_pay, commission_pay, total_compensation')
        .eq('studio_id', report.studio_id)
        .order('period_month', { ascending: false })
        .limit(100);

      return {
        headers: ['Trainer ID', 'Period', 'Classes', 'Base Pay', 'Bonus Pay', 'Commission', 'Total'],
        rows: data ?? [],
      };
    }

    case 'trainer_performance': {
      const { data } = await db
        .from('trainer_metric_snapshots')
        .select('trainer_id, period_month, total_classes, total_check_ins, avg_attendance, classes_above_bonus_threshold, max_attendance')
        .eq('studio_id', report.studio_id)
        .order('period_month', { ascending: false })
        .limit(100);

      return {
        headers: ['Trainer ID', 'Period', 'Classes', 'Check-Ins', 'Avg Attendance', 'Above Threshold', 'Max Attendance'],
        rows: data ?? [],
      };
    }

    case 'churn_risk': {
      const { data } = await db
        .from('members')
        .select('id, membership_status, membership_tier, last_visit, total_visits, lifetime_value, credits_remaining')
        .eq('studio_id', report.studio_id)
        .eq('membership_status', 'active')
        .order('last_visit', { ascending: true, nullsFirst: true })
        .limit(500);

      return {
        headers: ['Member ID', 'Status', 'Tier', 'Last Visit', 'Total Visits', 'LTV', 'Credits Left'],
        rows: data ?? [],
      };
    }

    case 'class_performance': {
      const { data } = await db
        .from('classes')
        .select('id, name, class_type, date, start_time, capacity, booked_count, checked_in_count, trainer_id, status')
        .eq('studio_id', report.studio_id)
        .gte('date', dateFrom)
        .lte('date', dateTo)
        .order('date', { ascending: true });

      return {
        headers: ['Class ID', 'Name', 'Type', 'Date', 'Time', 'Capacity', 'Booked', 'Checked In', 'Trainer ID', 'Status'],
        rows: data ?? [],
      };
    }

    case 'transaction_log': {
      const { data } = await db
        .from('transactions')
        .select('id, member_id, amount, payment_type, status, created_at')
        .eq('studio_id', report.studio_id)
        .gte('created_at', `${dateFrom}T00:00:00.000Z`)
        .lte('created_at', `${dateTo}T23:59:59.999Z`)
        .order('created_at', { ascending: false })
        .limit(1000);

      return {
        headers: ['Transaction ID', 'Member ID', 'Amount', 'Type', 'Status', 'Date'],
        rows: data ?? [],
      };
    }

    case 'failed_payments': {
      const { data } = await db
        .from('transactions')
        .select('id, member_id, amount, payment_type, status, created_at')
        .eq('studio_id', report.studio_id)
        .eq('status', 'failed')
        .gte('created_at', `${dateFrom}T00:00:00.000Z`)
        .lte('created_at', `${dateTo}T23:59:59.999Z`)
        .order('created_at', { ascending: false });

      return {
        headers: ['Transaction ID', 'Member ID', 'Amount', 'Type', 'Status', 'Date'],
        rows: data ?? [],
      };
    }

    case 'member_movement': {
      const { data } = await db
        .from('daily_metrics')
        .select('metric_date, new_members, churned_members, active_members, new_leads, leads_converted')
        .eq('studio_id', report.studio_id)
        .gte('metric_date', dateFrom)
        .lte('metric_date', dateTo)
        .order('metric_date', { ascending: true });

      return {
        headers: ['Date', 'New Members', 'Churned', 'Active', 'New Leads', 'Converted Leads'],
        rows: data ?? [],
      };
    }

    case 'campaign_performance': {
      const { data } = await db
        .from('campaigns')
        .select('id, name, status, recipient_count, delivered_count, open_count, unique_click_count, conversion_count, revenue_attributed, created_at')
        .eq('studio_id', report.studio_id)
        .order('created_at', { ascending: false })
        .limit(100);

      return {
        headers: ['Campaign ID', 'Name', 'Status', 'Recipients', 'Delivered', 'Opens', 'Clicks', 'Conversions', 'Revenue', 'Created'],
        rows: data ?? [],
      };
    }

    case 'lead_pipeline': {
      const { data } = await db
        .from('leads')
        .select('id, first_name, last_name, email, status, source, score, assigned_to, created_at')
        .eq('studio_id', report.studio_id)
        .order('created_at', { ascending: false })
        .limit(500);

      return {
        headers: ['Lead ID', 'First Name', 'Last Name', 'Email', 'Status', 'Source', 'Score', 'Assigned To', 'Created'],
        rows: data ?? [],
      };
    }

    case 'credit_pack_usage': {
      const { data } = await db
        .from('credit_packs')
        .select('id, member_id, pack_type, credits_total, credits_remaining, expires_at, purchased_at')
        .eq('studio_id', report.studio_id)
        .order('purchased_at', { ascending: false })
        .limit(500);

      return {
        headers: ['Pack ID', 'Member ID', 'Type', 'Total Credits', 'Remaining', 'Expires', 'Purchased'],
        rows: data ?? [],
      };
    }

    default:
      return { headers: [], rows: [] };
  }
}

// ---------------------------------------------------------------------------
// CSV formatting
// ---------------------------------------------------------------------------

function formatCSV(headers: string[], rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return headers.join(',') + '\n';

  const keys = Object.keys(rows[0]);
  const lines = [headers.join(',')];

  for (const row of rows) {
    const values = keys.map((key) => {
      const val = row[key];
      if (val === null || val === undefined) return '';
      const str = String(val);
      // Escape commas and quotes in CSV
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    lines.push(values.join(','));
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Next send time calculation
// ---------------------------------------------------------------------------

async function updateNextSendAt(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  report: ScheduledReport,
): Promise<void> {
  const now = new Date();
  let nextSend: Date;

  switch (report.schedule_frequency) {
    case 'daily':
      nextSend = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      break;
    case 'weekly':
      nextSend = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      break;
    case 'monthly':
      nextSend = new Date(now);
      nextSend.setUTCMonth(nextSend.getUTCMonth() + 1);
      break;
    case 'quarterly':
      nextSend = new Date(now);
      nextSend.setUTCMonth(nextSend.getUTCMonth() + 3);
      break;
    default:
      nextSend = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }

  await db
    .from('saved_reports')
    .update({
      last_sent_at: now.toISOString(),
      next_send_at: nextSend.toISOString(),
    })
    .eq('id', report.id);
}
