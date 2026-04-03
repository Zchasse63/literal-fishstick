/**
 * Inngest Cron Function: Trainer Metrics Aggregation
 *
 * Runs on the 1st of each month at 4 AM ET (9:00 UTC) to aggregate
 * the prior month's trainer performance data: classes led, check-ins,
 * bonus eligibility, and total compensation.
 *
 * The `trainers` table has `profile_id`, `base_pay_per_class`, `bonus_amount`,
 * `bonus_threshold`, `commission_rate`. `classes.trainer_id` references `trainers.id`.
 *
 * Uses bulk queries to avoid N+1 performance issues.
 */
import { inngest } from '@/lib/inngest/client';
import { getAdminClient } from '@/lib/inngest/helpers';
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

// TODO: Multi-tenancy — query `studios` table and iterate all active studios
// instead of hardcoding a single studio ID. See MED-001.
const STUDIO_ID = process.env.DEFAULT_STUDIO_ID || DEFAULT_STUDIO_ID;

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

interface BookingRow {
  class_id: string;
  member_id: string;
}

interface CommissionRow {
  trainer_id: string;
  commission_amount: number;
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

    const trainerIds = trainers.map((t) => t.id);
    const trainerProfileIds = trainers.map((t) => t.profile_id);

    // ── Load all classes in the prior month (bulk) ─────────────
    const allClasses = await step.run('load-classes', async () => {
      const { data, error } = await db
        .from('classes')
        .select('id, trainer_id, checked_in_count, capacity, status')
        .eq('studio_id', STUDIO_ID)
        .in('trainer_id', trainerIds)
        .gte('starts_at', `${monthStart}T00:00:00.000Z`)
        .lt('starts_at', `${monthEnd}T00:00:00.000Z`)
        .in('status', ['completed', 'in_progress']);

      if (error) {
        console.error('[trainer-metrics] Failed to load classes:', error);
        return [];
      }
      return (data ?? []) as ClassRow[];
    });

    // ── Bulk: Load all checked-in bookings for these classes ───
    // Excludes trainer's own attendance by filtering in JS
    const classIds = allClasses.map((c) => c.id);
    const allBookings = await step.run('load-bookings-bulk', async () => {
      if (classIds.length === 0) return [];

      const { data, error } = await db
        .from('bookings')
        .select('class_id, member_id')
        .eq('studio_id', STUDIO_ID)
        .in('class_id', classIds)
        .eq('status', 'checked_in');

      if (error) {
        console.error('[trainer-metrics] Failed to load bookings:', error);
        return [];
      }
      return (data ?? []) as BookingRow[];
    });

    // ── Bulk: Load all promo commissions for all trainers ──────
    const allCommissions = await step.run('load-commissions-bulk', async () => {
      const { data, error } = await db
        .from('promo_attributions')
        .select('trainer_id, commission_amount')
        .eq('studio_id', STUDIO_ID)
        .in('trainer_id', trainerIds)
        .gte('attributed_at', `${monthStart}T00:00:00.000Z`)
        .lt('attributed_at', `${monthEnd}T00:00:00.000Z`);

      if (error) {
        console.error('[trainer-metrics] Failed to load commissions:', error);
        return [];
      }
      return (data ?? []) as CommissionRow[];
    });

    // ── Index bulk data ───────────────────────────────────────
    // Group classes by trainer_id
    const classesByTrainer = new Map<string, ClassRow[]>();
    for (const cls of allClasses) {
      const list = classesByTrainer.get(cls.trainer_id) ?? [];
      list.push(cls);
      classesByTrainer.set(cls.trainer_id, list);
    }

    // Build a set of trainer profile_ids for fast lookup
    const trainerProfileIdSet = new Set(trainerProfileIds);

    // Build a map: trainer_id -> profile_id for excluding self-attendance
    const trainerProfileMap = new Map<string, string>();
    for (const t of trainers) {
      trainerProfileMap.set(t.id, t.profile_id);
    }

    // Build a map: class_id -> trainer_id (to look up whose class it is)
    const classTrainerMap = new Map<string, string>();
    for (const cls of allClasses) {
      classTrainerMap.set(cls.id, cls.trainer_id);
    }

    // Count check-ins per class, excluding the trainer's own profile_id
    const checkInsByClass = new Map<string, number>();
    for (const booking of allBookings) {
      const trainerId = classTrainerMap.get(booking.class_id);
      const trainerProfileId = trainerId ? trainerProfileMap.get(trainerId) : undefined;
      // Exclude trainer's own attendance
      if (trainerProfileId && booking.member_id === trainerProfileId) {
        continue;
      }
      const current = checkInsByClass.get(booking.class_id) ?? 0;
      checkInsByClass.set(booking.class_id, current + 1);
    }

    // Sum commissions by trainer_id
    const commissionByTrainer = new Map<string, number>();
    for (const c of allCommissions) {
      const current = commissionByTrainer.get(c.trainer_id) ?? 0;
      commissionByTrainer.set(c.trainer_id, current + (c.commission_amount ?? 0));
    }

    // ── Aggregate per trainer (no additional queries) ─────────
    for (const trainer of trainers) {
      await step.run(`aggregate-${trainer.id}`, async () => {
        const trainerClasses = classesByTrainer.get(trainer.id) ?? [];
        const totalClasses = trainerClasses.length;

        if (totalClasses === 0) {
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

        // Calculate attendance counts per class using pre-fetched data
        let totalCheckIns = 0;
        const attendanceCounts: number[] = [];

        for (const cls of trainerClasses) {
          const classCheckIns = checkInsByClass.get(cls.id) ?? 0;
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

        // Commission from pre-fetched promo attributions
        const commissionPay = commissionByTrainer.get(trainer.id) ?? 0;

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
