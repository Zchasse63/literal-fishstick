/**
 * Inngest Cron Function: Evaluate Automation Triggers
 *
 * Runs every 10 minutes to check all active automation flows for members
 * that match their trigger conditions. Creates enrollments and dispatches
 * flow execution events.
 *
 * Trigger types: signup, no_show, churn_risk, credit_expiry, birthday,
 * milestone, membership_change, booking_completed, failed_payment,
 * inactivity, referral
 */
import { inngest } from '@/lib/inngest/client';
import { getAdminClient, canEnrollMember } from '@/lib/inngest/helpers';
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

// TODO: Multi-tenancy — query `studios` table and iterate all active studios
// instead of hardcoding a single studio ID. See MED-001.
const STUDIO_ID = process.env.DEFAULT_STUDIO_ID || DEFAULT_STUDIO_ID;

// 10-minute window for polling-based triggers
const POLLING_WINDOW_MS = 10 * 60 * 1000;

// ---------------------------------------------------------------------------
// Trigger evaluation
// ---------------------------------------------------------------------------

export const evaluateTriggers = inngest.createFunction(
  {
    id: 'automation-evaluate-triggers',
    name: 'Evaluate Automation Triggers',
    retries: 2,
    concurrency: [{ limit: 1 }],
    triggers: [{ cron: '*/10 * * * *' }],
  },
  async ({ step }) => {
    const db = getAdminClient();
    const now = new Date();
    const windowStart = new Date(now.getTime() - POLLING_WINDOW_MS).toISOString();

    // ── Load active flows ───────────────────────────────────
    interface FlowRow {
      id: string;
      studio_id: string;
      trigger_type: string;
      trigger_config: Record<string, unknown> | null;
      steps: unknown;
      exit_conditions: unknown;
      version: number | null;
      allow_reenrollment: boolean;
      cooldown_days: number | null;
      [key: string]: unknown;
    }

    const flows = await step.run('load-active-flows', async (): Promise<FlowRow[]> => {
      const { data, error } = await db
        .from('automation_flows')
        .select('*')
        .eq('studio_id', STUDIO_ID)
        .eq('is_active', true);

      if (error) {
        console.error('[automation] Failed to load flows:', error);
        return [];
      }
      return (data ?? []) as FlowRow[];
    });

    if (flows.length === 0) {
      return { status: 'no_active_flows', enrollments_created: 0 };
    }

    let totalEnrollments = 0;

    // ── Evaluate each flow ──────────────────────────────────
    for (const flow of flows) {
      const triggerType = flow.trigger_type;
      const triggerConfig = (flow.trigger_config ?? {}) as Record<string, unknown>;

      const qualifyingMemberIds = await step.run(
        `evaluate-${flow.id}-${triggerType}`,
        async () => {
          try {
            return await findQualifyingMembers(triggerType, triggerConfig, windowStart, now);
          } catch (err) {
            console.error(
              `[automation] Error evaluating trigger ${triggerType} for flow ${flow.id}:`,
              err,
            );
            return [];
          }
        },
      );

      if (qualifyingMemberIds.length === 0) continue;

      // ── Enroll qualifying members ──────────────────────────
      const enrolled = await step.run(`enroll-${flow.id}`, async () => {
        const enrolledIds: string[] = [];

        for (const memberId of qualifyingMemberIds) {
          try {
            const eligible = await canEnrollMember(
              {
                id: flow.id,
                studio_id: STUDIO_ID,
                allow_reenrollment: flow.allow_reenrollment,
                cooldown_days: flow.cooldown_days ?? undefined,
              },
              memberId,
            );

            if (!eligible) continue;

            // Create enrollment with flow snapshot
            const { data: enrollment, error } = await db
              .from('automation_enrollments')
              .insert({
                automation_id: flow.id,
                member_id: memberId,
                studio_id: STUDIO_ID,
                status: 'active',
                current_step: 0,
                flow_snapshot: {
                  steps: flow.steps,
                  exit_conditions: flow.exit_conditions,
                  version: flow.version ?? 1,
                },
                step_history: [],
                enrolled_at: new Date().toISOString(),
              })
              .select('id')
              .single();

            if (error) {
              // UNIQUE constraint violation means already enrolled — skip
              if (error.code === '23505') continue;
              console.error(
                `[automation] Failed to enroll member ${memberId} in flow ${flow.id}:`,
                error,
              );
              continue;
            }

            if (enrollment) {
              enrolledIds.push(enrollment.id);
            }
          } catch (err) {
            console.error(
              `[automation] Error enrolling member ${memberId} in flow ${flow.id}:`,
              err,
            );
          }
        }

        return enrolledIds;
      });

      // ── Dispatch flow execution events ─────────────────────
      if (enrolled.length > 0) {
        await step.run(`dispatch-${flow.id}`, async () => {
          const events = enrolled.map((enrollmentId) => ({
            name: 'automation/execute_flow' as const,
            data: {
              enrollment_id: enrollmentId,
              automation_id: flow.id,
              studio_id: STUDIO_ID,
            },
          }));

          await inngest.send(events);
        });

        totalEnrollments += enrolled.length;
      }
    }

    return { status: 'completed', flows_evaluated: flows.length, enrollments_created: totalEnrollments };
  },
);

// ---------------------------------------------------------------------------
// Trigger-specific member queries
// ---------------------------------------------------------------------------

async function findQualifyingMembers(
  triggerType: string,
  config: Record<string, unknown>,
  windowStart: string,
  now: Date,
): Promise<string[]> {
  const db = getAdminClient();

  switch (triggerType) {
    // ── Signup: profiles created in the last 10 minutes ──────
    case 'signup': {
      const { data } = await db
        .from('profiles')
        .select('id')
        .eq('studio_id', STUDIO_ID)
        .gte('created_at', windowStart);

      return (data ?? []).map((r) => r.id);
    }

    // ── No-show: bookings marked no_show in the last 10 min ─
    case 'no_show': {
      const { data } = await db
        .from('bookings')
        .select('member_id')
        .eq('studio_id', STUDIO_ID)
        .eq('status', 'no_show')
        .gte('updated_at', windowStart);

      return [...new Set((data ?? []).map((r) => r.member_id))];
    }

    // ── Churn risk: at-risk or critical health scores ────────
    case 'churn_risk': {
      const { data } = await db
        .from('profiles')
        .select('id')
        .eq('studio_id', STUDIO_ID)
        .in('health_risk_level', ['at_risk', 'critical']);

      return (data ?? []).map((r) => r.id);
    }

    // ── Credit expiry: packs expiring within 7 days ─────────
    case 'credit_expiry': {
      const expiryWindow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data } = await db
        .from('credit_packs')
        .select('member_id')
        .eq('studio_id', STUDIO_ID)
        .eq('status', 'active')
        .gt('credits_remaining', 0)
        .lte('expires_at', expiryWindow)
        .gte('expires_at', now.toISOString());

      return [...new Set((data ?? []).map((r) => r.member_id))];
    }

    // ── Birthday: profiles where birthday matches today ─────
    case 'birthday': {
      // Match month and day regardless of year
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      // Use text pattern matching on the date field: YYYY-MM-DD
      const pattern = `%-${month}-${day}`;

      const { data } = await db
        .from('profiles')
        .select('id')
        .eq('studio_id', STUDIO_ID)
        .like('date_of_birth', pattern);

      return (data ?? []).map((r) => r.id);
    }

    // ── Milestone: total visits >= config.count ─────────────
    case 'milestone': {
      const targetCount = (config.count as number) ?? 10;

      const { data } = await db
        .from('members')
        .select('id')
        .eq('studio_id', STUDIO_ID)
        .gte('total_visits', targetCount);

      return (data ?? []).map((r) => r.id);
    }

    // ── Membership change: recent status changes ────────────
    case 'membership_change': {
      const { data } = await db
        .from('membership_changes')
        .select('member_id')
        .eq('studio_id', STUDIO_ID)
        .gte('created_at', windowStart);

      return [...new Set((data ?? []).map((r) => r.member_id))];
    }

    // ── Booking completed: checked in during the last 10 min
    case 'booking_completed': {
      const { data } = await db
        .from('bookings')
        .select('member_id')
        .eq('studio_id', STUDIO_ID)
        .not('checked_in_at', 'is', null)
        .gte('checked_in_at', windowStart);

      return [...new Set((data ?? []).map((r) => r.member_id))];
    }

    // ── Failed payment: failed transactions in last 10 min ──
    case 'failed_payment': {
      const { data } = await db
        .from('transactions')
        .select('member_id')
        .eq('studio_id', STUDIO_ID)
        .eq('status', 'failed')
        .gte('created_at', windowStart);

      return [...new Set((data ?? []).map((r) => r.member_id))];
    }

    // ── Inactivity: no check-in for N days ──────────────────
    case 'inactivity': {
      const inactivityDays = (config.inactivity_days as number) ?? 30;
      const cutoff = new Date(now.getTime() - inactivityDays * 24 * 60 * 60 * 1000).toISOString();

      // Get all active members
      const { data: activeMembers } = await db
        .from('members')
        .select('id')
        .eq('studio_id', STUDIO_ID)
        .eq('membership_status', 'active');

      if (!activeMembers || activeMembers.length === 0) return [];

      // For each member, check if they have a recent check-in
      const inactiveMembers: string[] = [];

      // Process in batches to avoid overwhelming the DB
      const batchSize = 50;
      for (let i = 0; i < activeMembers.length; i += batchSize) {
        const batch = activeMembers.slice(i, i + batchSize);
        const memberIds = batch.map((m) => m.id);

        const { data: recentBookings } = await db
          .from('bookings')
          .select('member_id')
          .eq('studio_id', STUDIO_ID)
          .in('member_id', memberIds)
          .not('checked_in_at', 'is', null)
          .gte('checked_in_at', cutoff);

        const recentMemberIds = new Set((recentBookings ?? []).map((b) => b.member_id));
        for (const m of batch) {
          if (!recentMemberIds.has(m.id)) {
            inactiveMembers.push(m.id);
          }
        }
      }

      return inactiveMembers;
    }

    // ── Referral: recent referral records ────────────────────
    case 'referral': {
      const { data } = await db
        .from('referrals')
        .select('referrer_id')
        .eq('studio_id', STUDIO_ID)
        .gte('created_at', windowStart);

      return [...new Set((data ?? []).map((r) => r.referrer_id))];
    }

    default:
      console.warn(`[automation] Unknown trigger type: ${triggerType}`);
      return [];
  }
}
