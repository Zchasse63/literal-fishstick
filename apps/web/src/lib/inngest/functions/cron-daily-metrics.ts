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
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

// TODO: Multi-tenancy — query `studios` table and iterate all active studios
// instead of hardcoding a single studio ID. See MED-001.
const STUDIO_ID = process.env.DEFAULT_STUDIO_ID || DEFAULT_STUDIO_ID;

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
          .gte('starts_at', dayStart)
          .lte('starts_at', dayEnd);

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
          .select('id, amount, type, status')
          .eq('studio_id', STUDIO_ID)
          .eq('status', 'completed')
          .gte('created_at', dayStart)
          .lte('created_at', dayEnd);

        const txRows = transactions ?? [];
        const revenueTotal = txRows.reduce((sum, t) => sum + (t.amount ?? 0), 0);
        const revenueMemberships = txRows
          .filter((t) => t.type === 'membership')
          .reduce((sum, t) => sum + (t.amount ?? 0), 0);
        const revenueCreditPacks = txRows
          .filter((t) => t.type === 'credit_pack')
          .reduce((sum, t) => sum + (t.amount ?? 0), 0);
        const revenueDropIns = txRows
          .filter((t) => t.type === 'drop_in')
          .reduce((sum, t) => sum + (t.amount ?? 0), 0);
        const revenueMerch = txRows
          .filter((t) => t.type === 'merch' || t.type === 'merchandise')
          .reduce((sum, t) => sum + (t.amount ?? 0), 0);
        const revenueGiftCards = txRows
          .filter((t) => t.type === 'gift_card')
          .reduce((sum, t) => sum + (t.amount ?? 0), 0);
        const revenueCorporate = txRows
          .filter((t) => t.type === 'corporate')
          .reduce((sum, t) => sum + (t.amount ?? 0), 0);
        const revenueEvents = txRows
          .filter((t) => t.type === 'event')
          .reduce((sum, t) => sum + (t.amount ?? 0), 0);

        // Refunds
        const { data: refunds } = await db
          .from('transactions')
          .select('amount')
          .eq('studio_id', STUDIO_ID)
          .in('status', ['refunded', 'partially_refunded'])
          .gte('created_at', dayStart)
          .lte('created_at', dayEnd);

        const refundsTotal = (refunds ?? []).reduce((sum, r) => sum + (r.amount ?? 0), 0);

        // --- Member metrics ---
        const [
          { count: newMembers },
          { count: churnedMembers },
          { count: activeMembers },
          { count: pausedMembers },
        ] = await Promise.all([
          db.from('members').select('*', { count: 'exact', head: true })
            .eq('studio_id', STUDIO_ID).gte('created_at', dayStart).lte('created_at', dayEnd),
          db.from('members').select('*', { count: 'exact', head: true })
            .eq('studio_id', STUDIO_ID).eq('membership_status', 'cancelled').gte('updated_at', dayStart).lte('updated_at', dayEnd),
          db.from('members').select('*', { count: 'exact', head: true })
            .eq('studio_id', STUDIO_ID).eq('membership_status', 'active'),
          db.from('members').select('*', { count: 'exact', head: true })
            .eq('studio_id', STUDIO_ID).eq('membership_status', 'paused'),
        ]);

        // At-risk: members with health_score <= 40
        const { count: atRiskMembers } = await db
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('studio_id', STUDIO_ID)
          .not('health_score', 'is', null)
          .lte('health_score', 40);

        // MRR: sum of plan_price for all active recurring members
        const { data: mrrData } = await db
          .from('members')
          .select('plan_price')
          .eq('studio_id', STUDIO_ID)
          .eq('membership_status', 'active')
          .not('plan_price', 'is', null);

        const mrr = (mrrData ?? []).reduce((sum, m) => sum + ((m.plan_price as number) ?? 0), 0);
        const activeMemberCount = activeMembers ?? 0;
        const arpm = activeMemberCount > 0 ? Math.round((mrr / activeMemberCount) * 100) / 100 : 0;

        // Total capacity for all classes held
        const totalCapacity = classRows
          .filter((c) => c.status === 'completed' || c.status === 'in_progress')
          .reduce((sum, c) => sum + (c.capacity ?? 12), 0);

        // Trainer metrics: classes with a trainer assigned
        const { data: trainerClasses } = await db
          .from('classes')
          .select('id, trainer_id, checked_in_count')
          .eq('studio_id', STUDIO_ID)
          .gte('starts_at', dayStart)
          .lte('starts_at', dayEnd)
          .not('trainer_id', 'is', null)
          .in('status', ['completed', 'in_progress']);

        const trainerClassRows = trainerClasses ?? [];
        const trainerClassesLed = trainerClassRows.length;

        // Bonus classes: classes where checked_in_count >= 7 (default threshold)
        const trainerBonusClasses = trainerClassRows.filter((c) => (c.checked_in_count ?? 0) >= 7).length;

        // --- Upsert into daily_metrics ---
        const now = new Date().toISOString();
        await db.from('daily_metrics').upsert(
          {
            studio_id: STUDIO_ID,
            metric_date: date,
            // Booking metrics
            total_bookings: totalBookings,
            total_check_ins: totalCheckIns,
            total_no_shows: totalNoShows,
            total_late_cancellations: totalLateCancellations,
            total_walk_ins: totalWalkIns,
            unique_members_visited: uniqueMembersBooked,
            // Class metrics
            classes_held: classesHeld,
            total_capacity: totalCapacity,
            avg_class_fill_rate: Math.round(avgClassUtilization * 100) / 100,
            // Revenue metrics
            revenue_total: revenueTotal,
            revenue_memberships: revenueMemberships,
            revenue_credit_packs: revenueCreditPacks,
            revenue_drop_ins: revenueDropIns,
            revenue_merch: revenueMerch,
            revenue_gift_cards: revenueGiftCards,
            revenue_corporate: revenueCorporate,
            revenue_events: revenueEvents,
            refunds_total: refundsTotal,
            // Member metrics
            new_members: newMembers ?? 0,
            churned_members: churnedMembers ?? 0,
            active_members: activeMemberCount,
            paused_members: pausedMembers ?? 0,
            at_risk_members: atRiskMembers ?? 0,
            mrr: mrr,
            arpm: arpm,
            // Trainer metrics
            trainer_classes_led: trainerClassesLed,
            trainer_bonus_classes: trainerBonusClasses,
            created_at: now,
          },
          { onConflict: 'studio_id,metric_date' },
        );
      });
    }

    return { status: 'completed', dates_processed: datesToProcess.length, dates: datesToProcess };
  },
);
