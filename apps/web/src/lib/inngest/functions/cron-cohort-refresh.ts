/**
 * Inngest Cron Function: Cohort Retention Refresh
 *
 * Runs on the 1st of each month at 3 AM ET (8:00 UTC) to build cohort
 * retention snapshots. Groups members by their join month and measures
 * what percentage are still active in each subsequent month.
 *
 * "Active" = any booking with status 'checked_in' in the measurement month
 * OR an active membership during that month.
 */
import { inngest } from '@/lib/inngest/client';
import { getAdminClient } from '@/lib/inngest/helpers';

const STUDIO_ID = '11111111-1111-1111-1111-111111111111';

export const cronCohortRefresh = inngest.createFunction(
  {
    id: 'cron-cohort-refresh',
    name: 'Cohort Retention Refresh',
    retries: 2,
    concurrency: [{ limit: 1 }],
    triggers: [{ cron: '0 8 1 * *' }],
  },
  async ({ step }) => {
    const db = getAdminClient();

    // We're running on the 1st, so we measure through the end of the prior month
    const now = new Date();
    const measurementYear = now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
    const measurementMonth = now.getUTCMonth() === 0 ? 12 : now.getUTCMonth(); // 1-indexed
    const measurementMonthStr = `${measurementYear}-${String(measurementMonth).padStart(2, '0')}`;

    // ── Find all cohort months ─────────────────────────────────
    const cohortMonths = await step.run('find-cohort-months', async () => {
      // Get the earliest member join date
      const { data: earliest } = await db
        .from('members')
        .select('join_date')
        .eq('studio_id', STUDIO_ID)
        .order('join_date', { ascending: true })
        .limit(1)
        .single();

      if (!earliest?.join_date) return [];

      const startDate = new Date(earliest.join_date + 'T00:00:00Z');
      const startYear = startDate.getUTCFullYear();
      const startMonth = startDate.getUTCMonth() + 1; // 1-indexed

      const months: string[] = [];
      let y = startYear;
      let m = startMonth;

      while (y < measurementYear || (y === measurementYear && m <= measurementMonth)) {
        months.push(`${y}-${String(m).padStart(2, '0')}`);
        m++;
        if (m > 12) {
          m = 1;
          y++;
        }
      }

      return months;
    });

    if (cohortMonths.length === 0) {
      return { status: 'no_members', snapshots_created: 0 };
    }

    let totalSnapshots = 0;

    // ── Process each cohort month ──────────────────────────────
    for (const cohortMonth of cohortMonths) {
      const snapshotCount = await step.run(`cohort-${cohortMonth}`, async () => {
        const [cohortYear, cohortMo] = cohortMonth.split('-').map(Number);
        const cohortStart = `${cohortMonth}-01T00:00:00.000Z`;
        const cohortEndDate = new Date(Date.UTC(cohortYear, cohortMo, 1)); // 1st of next month
        const cohortEnd = cohortEndDate.toISOString();

        // Get members who joined in this cohort month
        const { data: cohortMembers } = await db
          .from('members')
          .select('id')
          .eq('studio_id', STUDIO_ID)
          .gte('join_date', cohortStart.split('T')[0])
          .lt('join_date', cohortEnd.split('T')[0]);

        const memberIds = (cohortMembers ?? []).map((m) => m.id);
        const cohortSize = memberIds.length;

        if (cohortSize === 0) return 0;

        // For each measurement month from cohort month to measurement month
        let mYear = cohortYear;
        let mMonth = cohortMo;
        let monthsSinceJoin = 0;
        let count = 0;

        while (
          mYear < measurementYear ||
          (mYear === measurementYear && mMonth <= measurementMonth)
        ) {
          const mMonthStr = `${mYear}-${String(mMonth).padStart(2, '0')}`;
          const mStart = `${mMonthStr}-01T00:00:00.000Z`;
          const mEndDate = new Date(Date.UTC(mYear, mMonth, 1));
          const mEnd = mEndDate.toISOString();

          // Find active members: had a check-in OR active membership in this month
          // Process in batches to avoid query limits
          const activeMemberIds = new Set<string>();
          const batchSize = 100;

          for (let i = 0; i < memberIds.length; i += batchSize) {
            const batch = memberIds.slice(i, i + batchSize);

            // Check for check-ins
            const { data: checkedIn } = await db
              .from('bookings')
              .select('member_id')
              .eq('studio_id', STUDIO_ID)
              .in('member_id', batch)
              .eq('status', 'checked_in')
              .gte('checked_in_at', mStart)
              .lt('checked_in_at', mEnd);

            for (const b of checkedIn ?? []) {
              activeMemberIds.add(b.member_id);
            }

            // Check for active memberships (members not yet in the set)
            const remaining = batch.filter((id) => !activeMemberIds.has(id));
            if (remaining.length > 0) {
              const { data: activeMembers } = await db
                .from('members')
                .select('id')
                .eq('studio_id', STUDIO_ID)
                .in('id', remaining)
                .eq('membership_status', 'active');

              for (const m of activeMembers ?? []) {
                activeMemberIds.add(m.id);
              }
            }
          }

          const activeCount = activeMemberIds.size;
          const retentionRate = Math.round((activeCount / cohortSize) * 10000) / 100; // 2 decimal places

          await db.from('cohort_snapshots').upsert(
            {
              studio_id: STUDIO_ID,
              cohort_month: cohortMonth,
              measurement_month: mMonthStr,
              months_since_join: monthsSinceJoin,
              cohort_size: cohortSize,
              active_count: activeCount,
              retention_rate: retentionRate,
              created_at: new Date().toISOString(),
            },
            { onConflict: 'studio_id,cohort_month,measurement_month' },
          );

          count++;
          monthsSinceJoin++;
          mMonth++;
          if (mMonth > 12) {
            mMonth = 1;
            mYear++;
          }
        }

        return count;
      });

      totalSnapshots += snapshotCount;
    }

    return {
      status: 'completed',
      cohort_months_processed: cohortMonths.length,
      snapshots_upserted: totalSnapshots,
      measurement_month: measurementMonthStr,
    };
  },
);
