/**
 * Inngest Cron Function: Trainer Metrics Aggregation
 *
 * Runs on the 1st of each month at 4 AM ET (9:00 UTC) to aggregate
 * the prior month's trainer performance data: classes led, check-ins,
 * bonus eligibility, and total compensation.
 *
 * The `trainers` table has `profile_id`, `base_pay_per_class`, `bonus_amount`,
 * `bonus_threshold`, `commission_rate`. `classes.trainer_id` references `trainers.id`.
 */
import { inngest } from '@/lib/inngest/client';
import { getAdminClient } from '@/lib/inngest/helpers';

// TODO: Multi-tenancy — query `studios` table and iterate all active studios
// instead of hardcoding a single studio ID. See MED-001.
const STUDIO_ID = process.env.DEFAULT_STUDIO_ID || '11111111-1111-1111-1111-111111111111';

interface TrainerRow {
  id: string;
  profile_id: string;
  base_pay_per_class: number; // cents
  bonus_amount: number; // cents
  bonus_threshold: number;
  commission_rate: number; // 0.10 = 10%
}

interface ClassRow {
  id: string;
  trainer_id: string;
  checked_in_count: number;
  capacity: number;
  status: string;
}

export const cronTrainerMetrics = inngest.createFunction(
  {
    id: 'cron-trainer-metrics',
    name: 'Trainer Metrics Aggregation',
    retries: 2,
    concurrency: [{ limit: 1 }],
    triggers: [{ cron: '0 9 1 * *' }],
  },
  async ({ step }) => {
    const db = getAdminClient();

    // Prior month range
    const now = new Date();
    const priorYear = now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
    const priorMonth = now.getUTCMonth() === 0 ? 12 : now.getUTCMonth(); // 1-indexed
    const periodMonth = `${priorYear}-${String(priorMonth).padStart(2, '0')}`;
    const monthStart = `${periodMonth}-01`;
    const monthEndDate = new Date(Date.UTC(priorYear, priorMonth, 1)); // 1st of current month
    const monthEnd = monthEndDate.toISOString().split('T')[0];

    // ── Load all active trainers ───────────────────────────────
    const trainers = await step.run('load-trainers', async () => {
      const { data, error } = await db
        .from('trainers')
        .select('id, profile_id, base_pay_per_class, bonus_amount, bonus_threshold, commission_rate')
        .eq('studio_id', STUDIO_ID)
        .eq('is_active', true);

      if (error) {
        console.error('[trainer-metrics] Failed to load trainers:', error);
        return [];
      }
      return (data ?? []) as TrainerRow[];
    });

    if (trainers.length === 0) {
      return { status: 'no_trainers', period: periodMonth };
    }

    // ── Load all classes in the prior month ─────────────────────
    const allClasses = await step.run('load-classes', async () => {
      const { data, error } = await db
        .from('classes')
        .select('id, trainer_id, checked_in_count, capacity, status')
        .eq('studio_id', STUDIO_ID)
        .gte('date', monthStart)
        .lt('date', monthEnd)
        .in('status', ['completed', 'in_progress']);

      if (error) {
        console.error('[trainer-metrics] Failed to load classes:', error);
        return [];
      }
      return (data ?? []) as ClassRow[];
    });

    // ── Aggregate per trainer ──────────────────────────────────
    for (const trainer of trainers) {
      await step.run(`aggregate-${trainer.id}`, async () => {
        const trainerClasses = (allClasses as ClassRow[]).filter((c: ClassRow) => c.trainer_id === trainer.id);
        const totalClasses = trainerClasses.length;

        if (totalClasses === 0) {
          // Still insert a zero row for completeness
          await upsertTrainerSnapshot(db, trainer, periodMonth, {
            totalClasses: 0,
            totalCheckIns: 0,
            avgAttendance: 0,
            classesAboveThreshold: 0,
            maxAttendance: 0,
            minAttendance: 0,
            basePay: 0,
            bonusPay: 0,
            commissionPay: 0,
          });
          return;
        }

        // For each class, get check-ins excluding the trainer's own attendance
        // We need to query bookings to exclude trainer's own profile_id
        let totalCheckIns = 0;
        const attendanceCounts: number[] = [];

        for (const cls of trainerClasses) {
          // Count check-ins excluding the trainer's profile_id
          const { count } = await db
            .from('bookings')
            .select('*', { count: 'exact', head: true })
            .eq('studio_id', STUDIO_ID)
            .eq('class_id', cls.id)
            .eq('status', 'checked_in')
            .neq('member_id', trainer.profile_id);

          const classCheckIns = count ?? 0;
          totalCheckIns += classCheckIns;
          attendanceCounts.push(classCheckIns);
        }

        const avgAttendance = totalClasses > 0 ? totalCheckIns / totalClasses : 0;
        const maxAttendance = Math.max(...attendanceCounts, 0);
        const minAttendance = Math.min(...attendanceCounts, 0);

        // Classes that exceeded the bonus threshold
        const classesAboveThreshold = attendanceCounts.filter(
          (count) => count >= trainer.bonus_threshold,
        ).length;

        // Compensation calculations
        const basePay = totalClasses * trainer.base_pay_per_class;
        const bonusPay = classesAboveThreshold * trainer.bonus_amount;

        // Commission from promo code attributions in the period
        const { data: commissions } = await db
          .from('promo_attributions')
          .select('commission_amount')
          .eq('studio_id', STUDIO_ID)
          .eq('trainer_id', trainer.id)
          .gte('attributed_at', `${monthStart}T00:00:00.000Z`)
          .lt('attributed_at', `${monthEnd}T00:00:00.000Z`);

        const commissionPay = (commissions ?? []).reduce(
          (sum, c) => sum + (c.commission_amount ?? 0),
          0,
        );

        await upsertTrainerSnapshot(db, trainer, periodMonth, {
          totalClasses,
          totalCheckIns,
          avgAttendance,
          classesAboveThreshold,
          maxAttendance,
          minAttendance,
          basePay,
          bonusPay,
          commissionPay,
        });
      });
    }

    return {
      status: 'completed',
      period: periodMonth,
      trainers_processed: trainers.length,
    };
  },
);

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function upsertTrainerSnapshot(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: ReturnType<typeof getAdminClient>,
  trainer: TrainerRow,
  periodMonth: string,
  metrics: {
    totalClasses: number;
    totalCheckIns: number;
    avgAttendance: number;
    classesAboveThreshold: number;
    maxAttendance: number;
    minAttendance: number;
    basePay: number;
    bonusPay: number;
    commissionPay: number;
  },
) {
  const now = new Date().toISOString();
  const totalCompensation = metrics.basePay + metrics.bonusPay + metrics.commissionPay;

  await db.from('trainer_metric_snapshots').upsert(
    {
      studio_id: STUDIO_ID,
      trainer_id: trainer.id,
      period_month: periodMonth,
      total_classes: metrics.totalClasses,
      total_check_ins: metrics.totalCheckIns,
      avg_attendance: Math.round(metrics.avgAttendance * 100) / 100,
      classes_above_bonus_threshold: metrics.classesAboveThreshold,
      max_attendance: metrics.maxAttendance,
      min_attendance: metrics.minAttendance,
      base_pay: metrics.basePay,
      bonus_pay: metrics.bonusPay,
      commission_pay: metrics.commissionPay,
      total_compensation: totalCompensation,
      avg_class_rating: null, // populated separately by review system
      ai_narrative: null, // populated by separate AI job
      ai_highlights: null,
      ai_growth_areas: null,
      ai_overall_rating: null,
      created_at: now,
      updated_at: now,
    },
    { onConflict: 'studio_id,trainer_id,period_month' },
  );
}
