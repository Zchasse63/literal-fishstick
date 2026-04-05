/**
 * Inngest Cron Function: Daily Member Enrichment
 *
 * Runs daily at 3 AM ET (8:00 UTC) to reconcile member visit stats,
 * engagement status, and enrichment fields that may have drifted.
 *
 * This is the safety-net reconciliation; real-time updates happen at check-in
 * and during Glofox sync. This cron catches anything that slipped through.
 *
 * Steps:
 * 1. Reconcile total_visits and last_visit from bookings (attended=true)
 * 2. Recompute engagement_status based on last_visit recency
 * 3. Tag ClassPass members (acquisition_source) for profiles synced since last run
 * 4. Resolve plan_code → membership_tier for any members missing a tier
 */
import { inngest } from '@/lib/inngest/client'
import { getAdminClient } from '@/lib/inngest/helpers'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

// TODO: Multi-tenancy — query `studios` table and iterate all active studios
// instead of hardcoding a single studio ID. See MED-001.
const STUDIO_ID = process.env.DEFAULT_STUDIO_ID || DEFAULT_STUDIO_ID

// ─── Engagement Status Thresholds ────────────────────────────
// Based on days since last visit
function computeEngagementStatus(lastVisit: string | null): string {
  if (!lastVisit) return 'never_visited'

  const daysSinceVisit = Math.floor(
    (Date.now() - new Date(lastVisit).getTime()) / (1000 * 60 * 60 * 24),
  )

  if (daysSinceVisit <= 7) return 'engaged'
  if (daysSinceVisit <= 21) return 'active'
  if (daysSinceVisit <= 45) return 'cooling'
  if (daysSinceVisit <= 90) return 'at_risk'
  return 'lapsed'
}

// ─── Membership Tier Inference ───────────────────────────────
function inferTierFromPlanCode(planCode: string): string | null {
  const lower = planCode.toLowerCase()
  if (lower.includes('unlimited')) return 'unlimited'
  if (lower.includes('10')) return '10_class'
  if (lower.includes('6')) return '6_class'
  return null
}

export const cronMemberEnrichment = inngest.createFunction(
  {
    id: 'cron-member-enrichment',
    name: 'Daily Member Enrichment',
    retries: 3,
    concurrency: [{ limit: 1 }],
    triggers: [{ cron: '0 8 * * *' }], // 3 AM ET = 8:00 UTC
  },
  async ({ step }) => {
    const db = getAdminClient()
    const now = new Date().toISOString()

    // ── Step 1: Reconcile total_visits and last_visit ──────────
    const visitReconciliation = await step.run('reconcile-visit-stats', async () => {
      let updated = 0
      let checked = 0

      // Use a server-side aggregate query (GROUP BY) instead of loading all
      // booking rows into memory. This avoids OOM on studios with large booking
      // tables. See MED-001.
      const { data: aggregates, error: aggError } = await db.rpc(
        'execute_readonly_sql',
        {
          query_text: `
            SELECT
              b.member_id,
              COUNT(*)::int AS visit_count,
              MAX(b.checked_in_at) AS last_visit
            FROM bookings b
            JOIN classes c ON b.class_id = c.id
            WHERE b.studio_id = '${STUDIO_ID}'
              AND b.attended = true
            GROUP BY b.member_id
          `,
        },
      )

      if (aggError || !aggregates) {
        console.error('[member-enrichment] Failed to query booking aggregates:', aggError?.message)
        return { updated: 0, checked: 0, error: aggError?.message }
      }

      // Build lookup maps from the aggregate result
      const memberStats = new Map<string, { count: number; lastVisit: string | null }>()
      for (const row of aggregates as Array<{ member_id: string; visit_count: number; last_visit: string | null }>) {
        if (!row.member_id) continue
        memberStats.set(row.member_id, {
          count: row.visit_count,
          lastVisit: row.last_visit,
        })
      }

      // Fetch all members for comparison
      const { data: members } = await db
        .from('members')
        .select('id, total_visits, last_visit')
        .eq('studio_id', STUDIO_ID)

      if (!members) return { updated: 0, checked: 0 }

      // Compare and update where needed
      for (const member of members) {
        checked++
        const stats = memberStats.get(member.id)
        const expectedVisits = stats?.count ?? 0
        const expectedLastVisit = stats?.lastVisit ?? null
        const currentVisits = (member.total_visits as number) ?? 0
        const currentLastVisit = member.last_visit as string | null

        const visitsDrifted = currentVisits !== expectedVisits
        const lastVisitDrifted =
          expectedLastVisit !== null &&
          (currentLastVisit === null ||
            new Date(currentLastVisit).getTime() !== new Date(expectedLastVisit).getTime())

        if (visitsDrifted || lastVisitDrifted) {
          const updatePayload: Record<string, unknown> = { updated_at: now }
          if (visitsDrifted) updatePayload.total_visits = expectedVisits
          if (lastVisitDrifted && expectedLastVisit) updatePayload.last_visit = expectedLastVisit

          await db.from('members').update(updatePayload).eq('id', member.id)
          updated++
        }
      }

      return { updated, checked }
    })

    // ── Step 2: Recompute engagement_status ────────────────────
    const engagementReconciliation = await step.run('recompute-engagement-status', async () => {
      let updated = 0

      const { data: members } = await db
        .from('members')
        .select('id, last_visit, engagement_status')
        .eq('studio_id', STUDIO_ID)

      if (!members) return { updated: 0 }

      for (const member of members) {
        const expected = computeEngagementStatus(member.last_visit as string | null)
        const current = (member.engagement_status as string) ?? 'never_visited'

        if (expected !== current) {
          await db
            .from('members')
            .update({ engagement_status: expected, updated_at: now })
            .eq('id', member.id)
          updated++
        }
      }

      return { updated }
    })

    // ── Step 3: Tag ClassPass members ──────────────────────────
    const classpassTagging = await step.run('tag-classpass-members', async () => {
      let tagged = 0

      // ClassPass members have lead_source = 'U' and phone = '+10000000000' in profiles
      const { data: classpassProfiles } = await db
        .from('profiles')
        .select('id')
        .eq('studio_id', STUDIO_ID)
        .eq('lead_source', 'U')
        .eq('phone', '+10000000000')

      if (!classpassProfiles || classpassProfiles.length === 0) return { tagged: 0 }

      const profileIds = classpassProfiles.map((p) => p.id)

      // Find members linked to these profiles that don't have acquisition_source set
      const { data: members } = await db
        .from('members')
        .select('id, profile_id, acquisition_source')
        .eq('studio_id', STUDIO_ID)
        .in('profile_id', profileIds)

      if (!members) return { tagged: 0 }

      for (const member of members) {
        if ((member.acquisition_source as string | null) !== 'classpass') {
          await db
            .from('members')
            .update({ acquisition_source: 'classpass', updated_at: now })
            .eq('id', member.id)
          tagged++
        }
      }

      return { tagged }
    })

    // ── Step 4: Resolve plan_code → membership_tier ────────────
    const tierResolution = await step.run('resolve-membership-tiers', async () => {
      let resolved = 0

      // Find members with a plan_code but no membership_tier
      const { data: members } = await db
        .from('members')
        .select('id, plan_code, membership_tier')
        .eq('studio_id', STUDIO_ID)
        .not('plan_code', 'is', null)
        .is('membership_tier', null)

      if (!members || members.length === 0) return { resolved: 0 }

      // Try to resolve via glofox_plan_map table first
      const { data: planMapRows } = await db
        .from('membership_plans')
        .select('glofox_id, tier, name')
        .eq('studio_id', STUDIO_ID)

      const planMap = new Map<string, string>()
      for (const row of planMapRows ?? []) {
        if (row.glofox_id && row.tier) {
          planMap.set(row.glofox_id, row.tier)
        }
        // Also try inference from name if tier is null
        if (row.glofox_id && !row.tier && row.name) {
          const inferred = inferTierFromPlanCode(row.name)
          if (inferred) planMap.set(row.glofox_id, inferred)
        }
      }

      for (const member of members) {
        const planCode = member.plan_code as string
        // First check plan map, then try inference from plan_code string itself
        const tier = planMap.get(planCode) ?? inferTierFromPlanCode(planCode)
        if (tier) {
          await db
            .from('members')
            .update({ membership_tier: tier, updated_at: now })
            .eq('id', member.id)
          resolved++
        }
      }

      return { resolved }
    })

    // ── Step 5: Evict stale AI briefings (LOW-006) ──────────────
    const aiCacheEviction = await step.run('evict-stale-ai-cache', async () => {
      // AI briefings older than 24 hours are stale and should be regenerated
      // on next access. This prevents the Command Center from showing outdated
      // AI insights after member data has been reconciled above.
      const { count } = await db
        .from('ai_briefings')
        .delete()
        .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())


      return { evicted: 'completed' }
    })

    return {
      status: 'completed',
      visit_reconciliation: visitReconciliation,
      engagement_reconciliation: engagementReconciliation,
      classpass_tagging: classpassTagging,
      tier_resolution: tierResolution,
      ai_cache_eviction: aiCacheEviction,
    }
  },
)
