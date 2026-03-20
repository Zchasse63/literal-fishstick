/**
 * Inngest Cron Function: Daily Metrics Aggregation
 *
 * Runs daily at 2 AM ET (7:00 UTC) to aggregate the previous day's booking,
 * revenue, member, and class metrics into the daily_metrics table.
 *
 * Automatically backfills any gaps if a day was missed.
 */
import { inngest } from '@/lib/inngest/client';
import { getAdminClient } from '@/lib/inngest/helpers';

const STUDIO_ID = '11111111-1111-1111-1111-111111111111';

export const cronDailyMetrics = inngest.createFunction(
  {
    id: 'cron-daily-metrics',
    name: 'Daily Metrics Aggregation',
    retries: 3,
    concurrency: [{ limit: 1 }],
    triggers: [{ cron: '0 7 * * *' }],
  },
  async ({ step }) => {
    const db = getAdminClient();

    // ── Determine which dates need aggregation ─────────────────
    const datesToProcess = await step.run('find-missing-dates', async () => {
      // Find the last aggregated date
      const { data: lastRow } = await db
        .from('daily_metrics')
        .select('metric_date')
        .eq('studio_id', STUDIO_ID)
        .order('metric_date', { ascending: false })
        .limit(1)
        .single();

      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (!lastRow) {
        // No data yet — just do yesterday
        return [yesterdayStr];
      }

      const lastDate = new Date(lastRow.metric_date + 'T00:00:00Z');
      const dates: string[] = [];

      // Walk forward from lastDate + 1 day to yesterday (inclusive)
      const cursor = new Date(lastDate);
      cursor.setUTCDate(cursor.getUTCDate() + 1);

      while (cursor.toISOString().split('T')[0] <= yesterdayStr) {
        dates.push(cursor.toISOString().split('T')[0]);
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }

      return dates;
    });

    if (datesToProcess.length === 0) {
      return { status: 'up_to_date', dates_processed: 0 };
    }

    // ── Aggregate each missing date ────────────────────────────
    for (const date of datesToProcess) {
      await step.run(`aggregate-${date}`, async () => {
        const dayStart = `${date}T00:00:00.000Z`;
        const dayEnd = `${date}T23:59:59.999Z`;

        // --- Booking metrics ---
        const { data: bookings } = await db
          .from('bookings')
          .select('id, status, member_id, is_walk_in, checked_in_at')
          .eq('studio_id', STUDIO_ID)
          .gte('created_at', dayStart)
          .lte('created_at', dayEnd);

        const bookingRows = bookings ?? [];
        const totalBookings = bookingRows.length;
        const totalCheckIns = bookingRows.filter((b) => b.status === 'checked_in').length;
        const totalNoShows = bookingRows.filter((b) => b.status === 'no_show').length;
        const totalCancellations = bookingRows.filter((b) => b.status === 'cancelled').length;
        const totalLateCancellations = bookingRows.filter((b) => b.status === 'late_cancelled').length;
        const totalWalkIns = bookingRows.filter((b) => b.is_walk_in).length;
        const uniqueMembersBooked = new Set(bookingRows.map((b) => b.member_id)).size;

        // --- Class metrics ---
        const { data: classes } = await db
          .from('classes')
          .select('id, status, capacity, checked_in_count')
          .eq('studio_id', STUDIO_ID)
          .eq('date', date);

        const classRows = classes ?? [];
        const classesHeld = classRows.filter((c) => c.status === 'completed' || c.status === 'in_progress').length;
        const classesCancelled = classRows.filter((c) => c.status === 'cancelled').length;
        const avgAttendance =
          classesHeld > 0
            ? classRows
                .filter((c) => c.status === 'completed' || c.status === 'in_progress')
                .reduce((sum, c) => sum + (c.checked_in_count ?? 0), 0) / classesHeld
            : 0;
        const avgClassUtilization =
          classesHeld > 0
            ? classRows
                .filter((c) => c.status === 'completed' || c.status === 'in_progress')
                .reduce((sum, c) => {
                  const cap = c.capacity ?? 12;
                  return sum + ((c.checked_in_count ?? 0) / cap) * 100;
                }, 0) / classesHeld
            : 0;

        // --- Revenue metrics ---
        const { data: transactions } = await db
          .from('transactions')
          .select('id, amount, payment_type, status, refund_amount')
          .eq('studio_id', STUDIO_ID)
          .eq('status', 'completed')
          .gte('created_at', dayStart)
          .lte('created_at', dayEnd);

        const txRows = transactions ?? [];
        const totalRevenue = txRows.reduce((sum, t) => sum + (t.amount ?? 0), 0);
        const membershipRevenue = txRows
          .filter((t) => t.payment_type === 'membership')
          .reduce((sum, t) => sum + (t.amount ?? 0), 0);
        const creditPackRevenue = txRows
          .filter((t) => t.payment_type === 'credit_pack')
          .reduce((sum, t) => sum + (t.amount ?? 0), 0);
        const dropInRevenue = txRows
          .filter((t) => t.payment_type === 'drop_in')
          .reduce((sum, t) => sum + (t.amount ?? 0), 0);
        const merchRevenue = txRows
          .filter((t) => t.payment_type === 'merch')
          .reduce((sum, t) => sum + (t.amount ?? 0), 0);
        const giftCardRevenue = txRows
          .filter((t) => t.payment_type === 'gift_card')
          .reduce((sum, t) => sum + (t.amount ?? 0), 0);
        const eventRevenue = txRows
          .filter((t) => t.payment_type === 'event')
          .reduce((sum, t) => sum + (t.amount ?? 0), 0);

        // Refunds (look at all statuses for refund amounts)
        const { data: refunds } = await db
          .from('transactions')
          .select('refund_amount')
          .eq('studio_id', STUDIO_ID)
          .in('status', ['refunded', 'partially_refunded'])
          .gte('updated_at', dayStart)
          .lte('updated_at', dayEnd);

        const refundTotal = (refunds ?? []).reduce((sum, r) => sum + (r.refund_amount ?? 0), 0);

        // --- Member metrics ---
        const { count: newMembers } = await db
          .from('members')
          .select('*', { count: 'exact', head: true })
          .eq('studio_id', STUDIO_ID)
          .gte('created_at', dayStart)
          .lte('created_at', dayEnd);

        const { count: churnedMembers } = await db
          .from('members')
          .select('*', { count: 'exact', head: true })
          .eq('studio_id', STUDIO_ID)
          .eq('membership_status', 'cancelled')
          .gte('updated_at', dayStart)
          .lte('updated_at', dayEnd);

        const { count: activeMembers } = await db
          .from('members')
          .select('*', { count: 'exact', head: true })
          .eq('studio_id', STUDIO_ID)
          .eq('membership_status', 'active');

        const { count: totalMembers } = await db
          .from('members')
          .select('*', { count: 'exact', head: true })
          .eq('studio_id', STUDIO_ID);

        // --- Lead metrics ---
        const { count: newLeads } = await db
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .eq('studio_id', STUDIO_ID)
          .gte('created_at', dayStart)
          .lte('created_at', dayEnd);

        const { count: leadsConverted } = await db
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .eq('studio_id', STUDIO_ID)
          .eq('status', 'converted')
          .gte('converted_at', dayStart)
          .lte('converted_at', dayEnd);

        // --- Upsert into daily_metrics ---
        const now = new Date().toISOString();
        await db.from('daily_metrics').upsert(
          {
            studio_id: STUDIO_ID,
            metric_date: date,
            total_bookings: totalBookings,
            total_check_ins: totalCheckIns,
            total_no_shows: totalNoShows,
            total_cancellations: totalCancellations,
            total_late_cancellations: totalLateCancellations,
            total_walk_ins: totalWalkIns,
            unique_members_booked: uniqueMembersBooked,
            avg_class_utilization: Math.round(avgClassUtilization * 100) / 100,
            total_revenue: totalRevenue,
            membership_revenue: membershipRevenue,
            credit_pack_revenue: creditPackRevenue,
            drop_in_revenue: dropInRevenue,
            merch_revenue: merchRevenue,
            gift_card_revenue: giftCardRevenue,
            event_revenue: eventRevenue,
            refund_total: refundTotal,
            new_members: newMembers ?? 0,
            churned_members: churnedMembers ?? 0,
            active_members: activeMembers ?? 0,
            total_members: totalMembers ?? 0,
            classes_held: classesHeld,
            classes_cancelled: classesCancelled,
            avg_attendance: Math.round(avgAttendance * 100) / 100,
            new_leads: newLeads ?? 0,
            leads_converted: leadsConverted ?? 0,
            created_at: now,
            updated_at: now,
          },
          { onConflict: 'studio_id,metric_date' },
        );
      });
    }

    return { status: 'completed', dates_processed: datesToProcess.length, dates: datesToProcess };
  },
);
