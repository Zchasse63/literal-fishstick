# Architecture Impact Analysis
**Agent:** architecture-impact
**Plan:** Glofox API Migration to Meridian
**Complexity:** SIGNIFICANT
**Date:** 2026-03-31

---

## Agent Verdict
**MODIFY** — The migration introduces 8 new Inngest functions, 3 new tables, 27 new columns, and a new external API client — all of which fit cleanly into the existing architecture. However, two architectural decisions are deferred or unspecified in ways that create ongoing technical debt: the outbound sync trigger mechanism is not defined (creating inconsistency risk), and the `glofox_*` columns/tables become permanent schema artifacts even after Glofox is deprecated. The post-cutover cleanup plan is adequate but needs to be treated as a first-class obligation, not an afterthought.

---

## Architectural Fit Assessment

### Inngest Function Pattern — Clean Fit

The codebase already runs 12 Inngest functions across marketing, analytics, and operations domains. The proposed 8 Glofox sync functions (5 inbound cron, 3 outbound event-driven) follow the same pattern:

```
lib/inngest/functions/
  cron-daily-metrics.ts        ← existing
  cron-trainer-metrics.ts      ← existing
  glofox-sync-members-inbound.ts  ← new
  glofox-sync-bookings-inbound.ts ← new
  glofox-sync-outbound-member.ts  ← new
  ...
```

These register in `functions/index.ts` and serve through the existing `/api/inngest/route.ts` endpoint. Zero new infrastructure required. The pattern is established, the retry/observability model is proven.

**Architectural impact: Low. Clean additive fit.**

### External API Client Layer — New Pattern, Well-Isolated

The `GlofoxClient` class is the first external third-party API client in the codebase that isn't a vetted SDK (Stripe, Anthropic, Supabase, Resend all use official SDKs). It lives at `lib/glofox/client.ts` and is temporary by design (deprecated at cutover).

The isolation is appropriate. Nothing in the application should depend on `GlofoxClient` outside the sync functions and the Inngest handlers. If this boundary is respected, removal at cutover is clean.

**Risk:** If the client is used in API routes or UI components to power real-time features during parallel mode (e.g., "show me Glofox's live booking count"), it creates entanglement that complicates cleanup.

**Recommendation:** Establish an explicit rule: `GlofoxClient` is only importable from `lib/inngest/functions/glofox-*` and `lib/glofox/sync/*`. Enforce with ESLint if feasible.

**Architectural impact: Low. Cleanly isolated temporary client.**

### Database Schema — Permanent Artifacts

The 27 new columns and 3 new tables have two categories:

**Category A: Permanent data (should stay after cutover)**
- `birth_date`, `address_*`, `emergency_contact`, `consent_*` on profiles
- `membership_expiry_date`, `membership_start_date`, `auto_renewal` on members
- `is_late_cancellation`, `is_from_waitlist`, `is_first_booking` on bookings
- `waitlist_count`, `description`, `image_url` on classes
- All `lead_interactions` table data

These fields have intrinsic value to Meridian's data model independent of Glofox. They should be populated from Glofox during the transition and remain populated by Meridian operations afterward.

**Category B: Glofox-specific identifiers (cleanup target)**
- All `glofox_id` columns (7 tables)
- All `glofox_synced_at` columns (4 tables)
- `glofox_plan_code`, `glofox_membership_id`, `glofox_program_id`, `glofox_provider_id`, `glofox_paid`, `glofox_lead_status`, `glofox_sources` (scattered across tables)
- `glofox_sync_state` table
- `glofox_sync_conflicts` table

The plan correctly states "keep `glofox_id` columns for historical reference" in Phase 5 cleanup. This is the right call for `glofox_id` (for audit trail of which Glofox record a Meridian record came from). However, the other `glofox_*` fields in the application tables have less justification for permanent retention:
- `glofox_plan_code` in members: plan codes are Glofox-internal identifiers, meaningless after cutover
- `glofox_provider_id` in transactions: redundant once Stripe is the processor
- `glofox_paid` in transactions: boolean field whose only meaning was "was this paid in Glofox's system"

Leaving these fields indefinitely creates schema noise and could confuse future developers. The cleanup plan should explicitly decide which `glofox_*` fields are archived vs. dropped.

**Architectural impact: Low-Medium. New columns are safe but create cleanup obligations.**

### Multi-Tenancy Compliance

All new tables include `studio_id NOT NULL REFERENCES studios(id)` — this is correct and consistent with the codebase's RLS pattern. The `lead_interactions` table has `studio_id` and a cascade delete from `leads`. Row-level security policies need to be added to the three new tables (`glofox_sync_state`, `glofox_sync_conflicts`, `lead_interactions`). The plan does not mention RLS policies for these tables.

For a single-studio deployment (The Sauna Guys), this is not immediately a problem. But if Meridian becomes multi-tenant SaaS, `glofox_sync_state` and `glofox_sync_conflicts` without RLS policies would expose sync metadata across tenants.

**Recommended action:** Add RLS policies to all three new tables at the same time as the migration. Standard pattern: `studio_id = current_setting('app.studio_id')::uuid`.

### TypeScript Type System Impact

The plan adds 27 new columns. The shared `@meridian/types` package (visible in `apps/web/package.json` as a dependency) presumably contains database type definitions. These need to be updated to reflect the new schema. If types are generated from Supabase (common with `supabase gen types typescript`), regenerating after migration will include the new columns automatically. If types are hand-maintained, they need explicit updates.

The plan does not mention type updates. This is a small but real gap — missing types on new columns means TypeScript will treat them as unknown/any in the codebase until updated.

---

## Sync Engine Architecture — Deeper Analysis

### The Inngest Event Model Needs Glofox-Specific Events

The existing `MeridianEvents` type in `lib/inngest/client.ts` does not include Glofox sync events. For outbound sync to be event-driven, new event types are needed:

```typescript
'glofox/sync_member': { data: { member_id: string; studio_id: string } };
'glofox/sync_booking': { data: { booking_id: string; studio_id: string } };
'glofox/sync_attendance': { data: { booking_id: string; studio_id: string } };
```

Without typed events, the Inngest functions will use untyped `any` payloads, losing type safety. The plan's code samples show `inngest.send()` without showing the event type definitions.

### The Admin Supabase Client

The inbound sync code calls `getAdminClient()` — this implies a service-role Supabase client that bypasses RLS. This is the correct choice for background sync functions (which run server-side, outside user request context). The plan should clarify that sync functions use the service role key, not the anon key, and that the service role key must be available in the Inngest/Next.js environment on Netlify.

### Implications for 60-Second Polling Architecture

CLAUDE.md states the current architecture uses 60-second polling for real-time data (WebSocket-ready Phase 2). The sync engine introduces a new polling layer at 5–30 minute intervals that is entirely separate from the UI polling. These are different in purpose (background sync vs. UI refresh) and should not conflict. However, during shadow mode, the UI polling will show Meridian data that lags Glofox by up to 30 minutes for transactions. This is acceptable for a shadow mode but may create confusion during parallel mode if staff expects both systems to agree in real time.

---

## Post-Cutover Architecture Cleanliness

The plan includes a cleanup phase (Week 9+). The architectural obligation is to ensure Meridian's data model fully replaces Glofox's after cutover:

**Member classification logic must change.** Currently, member `engagement_status`, churn classification, and membership status may depend on Glofox-synced data (membership_expiry, booking status). After cutover, these must derive from Stripe subscription status and Meridian's own booking records. The plan mentions this ("update member classification logic to use Stripe subscription status") but it is a non-trivial refactor that needs its own testing.

**The `glofox_synced_at` field becomes semantically wrong.** After cutover, if a record is updated in Meridian, there is no "sync to Glofox" happening. The timestamp loses meaning. It should either be removed or repurposed.

---

## Summary

The architecture is well-suited to this migration. The plan does not introduce any new infrastructure, picks appropriate patterns for the existing codebase, and limits Glofox-specific code to isolated modules. The main architectural concerns are:
1. Outbound trigger mechanism unspecified (creates inconsistency risk)
2. RLS policies missing from new tables
3. Inngest event types not defined for new sync events
4. Post-cutover schema cleanup needs to be more precise about which `glofox_*` fields to drop vs. retain
5. Member classification refactor after cutover is larger than the plan implies

None of these are blockers to Phase 1. All should be addressed before Phase 2 is considered complete.
