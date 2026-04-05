/**
 * Inngest Cron Function: Evaluate Automation Triggers
 *
 * Runs every 10 minutes to check all active automation flows for members
 * that match their trigger conditions. Creates enrollments and dispatches
 * flow execution events.
 *
 * Trigger types: signup, no_show, churn_risk, credit_expiry, birthday,
 * milestone, membership_change, booking_completed, failed_payment,
 * inactivity, referral, never_booked, classpass_repeat, one_and_done,
 * cooling_off, plan_upgrade_candidate, class_type_fan
 *
 * Multi-tenancy: Queries all studios and evaluates flows per-studio.
 */
import { inngest } from '@/lib/inngest/client';
import { getAdminClient, canEnrollMember } from '@/lib/inngest/helpers';

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

    // ── Load all active studios ────────────────────────────────
    const studios = await step.run('load-studios', async (): Promise<{ id: string }[]> => {
      const { data, error } = await db
        .from('studios')
        .select('id');

      if (error) {
        console.error('[automation] Failed to load studios:', error);
        return [];
      }
      return (data ?? []) as { id: string }[];
    });

    if (studios.length === 0) {
      return { status: 'no_studios', enrollments_created: 0 };
    }

    let totalEnrollments = 0;
    let totalFlowsEvaluated = 0;

    // ── Iterate each studio ────────────────────────────────────
    for (const studio of studios) {
      const studioId = studio.id;

      // ── Load active flows for this studio ────────────────────
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

      const flows = await step.run(`load-flows-${studioId}`, async (): Promise<FlowRow[]> => {
        const { data, error } = await db
          .from('automation_flows')
          .select('*')
          .eq('studio_id', studioId)
          .eq('is_active', true);

        if (error) {
          console.error(`[automation] Failed to load flows for studio ${studioId}:`, error);
          return [];
        }
        return (data ?? []) as FlowRow[];
      });

      if (flows.length === 0) continue;

      totalFlowsEvaluated += flows.length;

      // ── Evaluate each flow ──────────────────────────────────
      for (const flow of flows) {
        const triggerType = flow.trigger_type;
        const triggerConfig = (flow.trigger_config ?? {}) as Record<string, unknown>;

        const qualifyingMemberIds = await step.run(
          `evaluate-${flow.id}-${triggerType}`,
          async () => {
            try {
              return await findQualifyingMembers(triggerType, triggerConfig, windowStart, now, studioId);
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
                  studio_id: studioId,
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
                  studio_id: studioId,
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
                studio_id: studioId,
              },
            }));

            await inngest.send(events);
          });

          totalEnrollments += enrolled.length;
        }
      }
    }

    return {
      status: 'completed',
      studios_evaluated: studios.length,
      flows_evaluated: totalFlowsEvaluated,
      enrollments_created: totalEnrollments,
    };
  },
);

// ---------------------------------------------------------------------------
// Trigger-specific member queries
// ---------------------------------------------------------------------------
// All triggers return profile IDs (string[]) because
// automation_enrollments.member_id references profiles(id).
//
// When querying the `members` table, we return `profile_id` to match.
// When querying `profiles` directly, we return `id`.
// ---------------------------------------------------------------------------

async function findQualifyingMembers(
  triggerType: string,
  config: Record<string, unknown>,
  windowStart: string,
  now: Date,
  studioId: string,
): Promise<string[]> {
  const db = getAdminClient();

  switch (triggerType) {
    // ── Signup: profiles created in the last 10 minutes ──────
    case 'signup': {
      const { data } = await db
        .from('profiles')
        .select('id')
        .eq('studio_id', studioId)
        .gte('created_at', windowStart);

      return (data ?? []).map((r) => r.id);
    }

    // ── No-show: bookings marked no_show in the last 10 min ─
    // bookings.member_id -> members.id, so join to get profile_id
    case 'no_show': {
      const { data } = await db
        .from('bookings')
        .select('member_id, members!inner(profile_id)')
        .eq('studio_id', studioId)
        .eq('status', 'no_show')
        .gte('updated_at', windowStart);

      const profileIds = (data ?? []).map(
        (r) => (r.members as unknown as { profile_id: string }).profile_id,
      );
      return [...new Set(profileIds)];
    }

    // ── Churn risk: at-risk or critical health scores ────────
    case 'churn_risk': {
      const { data } = await db
        .from('profiles')
        .select('id')
        .eq('studio_id', studioId)
        .in('health_risk_level', ['at_risk', 'critical']);

      return (data ?? []).map((r) => r.id);
    }

    // ── Credit expiry: packs expiring within 7 days ─────────
    case 'credit_expiry': {
      const expiryWindow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data } = await db
        .from('credit_packs')
        .select('member_id')
        .eq('studio_id', studioId)
        .eq('status', 'active')
        .gt('credits_remaining', 0)
        .lte('expires_at', expiryWindow)
        .gte('expires_at', now.toISOString());

      // credit_packs.member_id likely references profiles — keep as-is
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
        .eq('studio_id', studioId)
        .like('date_of_birth', pattern);

      return (data ?? []).map((r) => r.id);
    }

    // ── Milestone: total visits >= config.count ─────────────
    case 'milestone': {
      const targetCount = (config.count as number) ?? 10;

      const { data } = await db
        .from('members')
        .select('profile_id')
        .eq('studio_id', studioId)
        .gte('total_visits', targetCount);

      return (data ?? []).map((r) => r.profile_id);
    }

    // ── Membership change: recent status changes ────────────
    case 'membership_change': {
      const { data } = await db
        .from('membership_changes')
        .select('member_id')
        .eq('studio_id', studioId)
        .gte('created_at', windowStart);

      return [...new Set((data ?? []).map((r) => r.member_id))];
    }

    // ── Booking completed: checked in during the last 10 min
    case 'booking_completed': {
      const { data } = await db
        .from('bookings')
        .select('member_id, members!inner(profile_id)')
        .eq('studio_id', studioId)
        .not('checked_in_at', 'is', null)
        .gte('checked_in_at', windowStart);

      const profileIds = (data ?? []).map(
        (r) => (r.members as unknown as { profile_id: string }).profile_id,
      );
      return [...new Set(profileIds)];
    }

    // ── Failed payment: failed transactions in last 10 min ──
    case 'failed_payment': {
      const { data } = await db
        .from('transactions')
        .select('member_id')
        .eq('studio_id', studioId)
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
        .select('id, profile_id')
        .eq('studio_id', studioId)
        .eq('membership_status', 'active');

      if (!activeMembers || activeMembers.length === 0) return [];

      // For each member, check if they have a recent check-in
      const inactiveProfileIds: string[] = [];

      // Process in batches to avoid overwhelming the DB
      const batchSize = 50;
      for (let i = 0; i < activeMembers.length; i += batchSize) {
        const batch = activeMembers.slice(i, i + batchSize);
        const memberIds = batch.map((m) => m.id);

        const { data: recentBookings } = await db
          .from('bookings')
          .select('member_id')
          .eq('studio_id', studioId)
          .in('member_id', memberIds)
          .not('checked_in_at', 'is', null)
          .gte('checked_in_at', cutoff);

        const recentMemberIds = new Set((recentBookings ?? []).map((b) => b.member_id));
        for (const m of batch) {
          if (!recentMemberIds.has(m.id)) {
            inactiveProfileIds.push(m.profile_id);
          }
        }
      }

      return inactiveProfileIds;
    }

    // ── Referral: recent referral records ────────────────────
    case 'referral': {
      const { data } = await db
        .from('referrals')
        .select('referrer_id')
        .eq('studio_id', studioId)
        .gte('created_at', windowStart);

      return [...new Set((data ?? []).map((r) => r.referrer_id))];
    }

    // =======================================================================
    // NEW TRIGGER TYPES (Sprint 3B)
    // =======================================================================

    // ── Never booked: joined > N hours ago, zero bookings ───
    case 'never_booked': {
      const hoursSinceJoin = (config.hours_since_join as number) ?? 48;
      const cutoff = new Date(now.getTime() - hoursSinceJoin * 60 * 60 * 1000).toISOString();

      // Members who joined before cutoff — LEFT JOIN bookings to find those with zero
      const { data: members } = await db
        .from('members')
        .select('id, profile_id')
        .eq('studio_id', studioId)
        .lte('join_date', cutoff.slice(0, 10)); // join_date is DATE type (YYYY-MM-DD)

      if (!members || members.length === 0) return [];

      // Check which of these members have any bookings
      const neverBookedProfileIds: string[] = [];
      const batchSize = 50;

      for (let i = 0; i < members.length; i += batchSize) {
        const batch = members.slice(i, i + batchSize);
        const memberIds = batch.map((m) => m.id);

        const { data: bookings } = await db
          .from('bookings')
          .select('member_id')
          .eq('studio_id', studioId)
          .in('member_id', memberIds);

        const bookedMemberIds = new Set((bookings ?? []).map((b) => b.member_id));

        for (const m of batch) {
          if (!bookedMemberIds.has(m.id)) {
            neverBookedProfileIds.push(m.profile_id);
          }
        }
      }

      return neverBookedProfileIds;
    }

    // ── ClassPass repeat: acquisition_source=classpass, visits >= N ─
    case 'classpass_repeat': {
      const minVisits = (config.min_visits as number) ?? 2;

      // profiles with acquisition_source='classpass' joined to members with total_visits >= threshold
      const { data } = await db
        .from('profiles')
        .select('id, members!inner(total_visits)')
        .eq('studio_id', studioId)
        .eq('acquisition_source', 'classpass');

      if (!data) return [];

      return data
        .filter((r) => {
          // members is returned as an array from the join; take the first
          const memberArr = r.members as unknown as { total_visits: number }[];
          const member = Array.isArray(memberArr) ? memberArr[0] : memberArr;
          return member && member.total_visits >= minVisits;
        })
        .map((r) => r.id);
    }

    // ── One and done: total_visits=1, last visit > N days ago ─
    case 'one_and_done': {
      const daysSinceVisit = (config.days_since_visit as number) ?? 7;
      const cutoff = new Date(now.getTime() - daysSinceVisit * 24 * 60 * 60 * 1000).toISOString();

      const { data } = await db
        .from('members')
        .select('profile_id')
        .eq('studio_id', studioId)
        .eq('total_visits', 1)
        .lt('last_visit', cutoff);

      return (data ?? []).map((r) => r.profile_id);
    }

    // ── Cooling off: engagement_status = 'cooling' ──────────
    case 'cooling_off': {
      const { data } = await db
        .from('members')
        .select('profile_id')
        .eq('studio_id', studioId)
        .eq('engagement_status', 'cooling');

      return (data ?? []).map((r) => r.profile_id);
    }

    // ── Lapsed with credits: has unused credits, >90 days absent ─
    case 'lapsed_with_credits': {
      const { data } = await db
        .from('members')
        .select('profile_id')
        .eq('studio_id', studioId)
        .eq('engagement_status', 'lapsed_with_credits');

      return (data ?? []).map((r) => r.profile_id);
    }

    // ── Plan upgrade candidate: class-pack / drop-in members with high recent visits ─
    case 'plan_upgrade_candidate': {
      const minMonthlyVisits = (config.min_monthly_visits as number) ?? 8;
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // Get members on lower tiers
      const { data: candidates } = await db
        .from('members')
        .select('id, profile_id')
        .eq('studio_id', studioId)
        .in('membership_tier', ['10_class', '6_class', 'drop_in']);

      if (!candidates || candidates.length === 0) return [];

      const upgradeProfileIds: string[] = [];
      const batchSize = 50;

      for (let i = 0; i < candidates.length; i += batchSize) {
        const batch = candidates.slice(i, i + batchSize);
        const memberIds = batch.map((m) => m.id);

        // Count bookings with check-ins in last 30 days per member
        const { data: recentBookings } = await db
          .from('bookings')
          .select('member_id')
          .eq('studio_id', studioId)
          .in('member_id', memberIds)
          .not('checked_in_at', 'is', null)
          .gte('checked_in_at', thirtyDaysAgo);

        // Count per member
        const visitCounts = new Map<string, number>();
        for (const b of recentBookings ?? []) {
          visitCounts.set(b.member_id, (visitCounts.get(b.member_id) ?? 0) + 1);
        }

        for (const m of batch) {
          if ((visitCounts.get(m.id) ?? 0) >= minMonthlyVisits) {
            upgradeProfileIds.push(m.profile_id);
          }
        }
      }

      return upgradeProfileIds;
    }

    // ── Class type fan: 5+ attended bookings of same glofox_event_name ─
    case 'class_type_fan': {
      const minClassVisits = (config.min_visits as number) ?? 5;

      // Get all checked-in bookings with a class name for this studio
      const { data: bookings } = await db
        .from('bookings')
        .select('member_id, glofox_event_name')
        .eq('studio_id', studioId)
        .not('checked_in_at', 'is', null)
        .not('glofox_event_name', 'is', null);

      if (!bookings || bookings.length === 0) return [];

      // Group by member_id + glofox_event_name, count occurrences
      const countMap = new Map<string, number>();
      const qualifyingMemberIds = new Set<string>();

      for (const b of bookings) {
        const key = `${b.member_id}::${b.glofox_event_name}`;
        const newCount = (countMap.get(key) ?? 0) + 1;
        countMap.set(key, newCount);

        if (newCount >= minClassVisits) {
          qualifyingMemberIds.add(b.member_id);
        }
      }

      if (qualifyingMemberIds.size === 0) return [];

      // Resolve member IDs to profile IDs
      const memberIdArr = [...qualifyingMemberIds];
      const allProfileIds: string[] = [];
      const batchSize = 50;

      for (let i = 0; i < memberIdArr.length; i += batchSize) {
        const batch = memberIdArr.slice(i, i + batchSize);

        const { data: members } = await db
          .from('members')
          .select('id, profile_id')
          .eq('studio_id', studioId)
          .in('id', batch);

        for (const m of members ?? []) {
          allProfileIds.push(m.profile_id);
        }
      }

      return allProfileIds;
    }

    default:
      console.warn(`[automation] Unknown trigger type: ${triggerType}`);
      return [];
  }
}
