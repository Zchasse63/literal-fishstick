# Low and Informational Findings

**Generated:** 2026-04-05
**Deduplicated from 10 layer audit reports.**

---

## LOW Findings

### LOW-001: GDPR deletion function incomplete for Phase 1 tables
**ID:** DM-008 | **Layer:** data-model
`delete_member_phase2_data()` covers Phase 2 only. Phase 1 deletion relies on unchecked FK cascade behavior.
**Fix:** Audit FK cascade. Create `delete_member_all_data()`.

### LOW-002: Monorepo scaffold underutilized — single app with 3 shared packages
**ID:** PS-002 | **Layer:** project-structure
Turborepo setup ready for multi-app but only `apps/web` exists. Package boundary discipline needed now.
**Fix:** Enforce `@meridian/types` usage. Add lint boundary rules.

### LOW-003: glofox/ components directory lacks ownership documentation
**ID:** PS-003 | **Layer:** project-structure
`components/glofox/` purpose and deprecation path undocumented.
**Fix:** Add header comment documenting purpose and expected lifespan.

### LOW-004: GDPR deletion function duplicate — cleanup_phase2_member_data is an alias
**ID:** (from rpc-functions.sql) | **Layer:** data-model
`cleanup_phase2_member_data()` is a legacy alias for `delete_member_phase2_data()`. The alias exists but adds confusion.
**Fix:** Document the canonical function clearly. Remove the alias when safe to do so.

### LOW-005: Glofox sync state lacks studio_id index
**ID:** (related to DM-008) | **Layer:** data-model
`glofox_sync_state` queried by `studio_id` — no index for multi-tenant scale.
**Fix:** `CREATE INDEX ON glofox_sync_state(studio_id)`.

### LOW-006: Cron endpoints protected by secret only — no IP allowlisting
**ID:** AS-008 | **Layer:** api-surface
`/api/cron/waitlist-promote` and `/api/campaigns/process-scheduled` use `CRON_SECRET` only.
**Fix:** Add Netlify IP allowlisting for scheduled function callers.

### LOW-007: OpenAPI spec manually maintained — likely drifted from 15 API changes
**ID:** AS-009 | **Layer:** api-surface
150 routes, hand-maintained spec. Recent Glofox API corrections and 6 trigger types not reflected.
**Fix:** Evaluate auto-generation tooling. Add spec review to release checklist.

### LOW-008: No loading.tsx Suspense skeletons for RSC pages
**ID:** UX-007 | **Layer:** ui-ux
RSC-converted pages have no `loading.tsx` files. Users see blank page flash on navigation.
**Fix:** Add `loading.tsx` skeleton files for heavy pages: member detail, revenue, analytics.

### LOW-009: Dark mode preference not persisted across page refresh
**ID:** UX-008 | **Layer:** ui-ux
Sun/moon toggle in sidebar; preference not stored in localStorage.
**Fix:** Persist in `localStorage`, initialize on mount.

### LOW-010: No breadcrumbs on deep detail pages
**ID:** UF-007 | **Layer:** user-flow
Dynamic IDs in routes (`/members/[id]`) have no breadcrumb rendering the entity name.
**Fix:** Implement dynamic breadcrumbs using server-fetched entity names.

### LOW-011: No error.tsx pages — failures show blank screens
**ID:** UF-004 | **Layer:** user-flow
No `error.tsx` files in admin route directories. RSC failures show raw Next.js error.
**Fix:** Add `error.tsx` to high-traffic pages: `/`, `/members`, `/members/[id]`, `/revenue`.

### LOW-012: AI briefings table has no eviction policy
**ID:** AI-007 | **Layer:** ai-layer
Cache entries never deleted. ~17,520 rows per year at current briefing frequency.
**Fix:** Delete `ai_briefings` entries older than 24h in a nightly cleanup step.

### LOW-013: Webhook secret rotation has no documented procedure
**ID:** INT-006 | **Layer:** integration
No runbook for rotating Stripe/Resend/Inngest/email-unsubscribe secrets.
**Fix:** Create `docs/runbooks/secret-rotation.md`.

### LOW-014: Glofox client lacks proactive rate limit throttle
**ID:** INT-005 | **Layer:** integration
Per-request retry exists but no inter-request delay. Backfill of 200+ members will trigger Glofox rate limits.
**Fix:** Add configurable `rateLimitMs` delay to `fetchAll()`.

### LOW-015: Members directory page not converted to RSC
**ID:** UX-006 | **Layer:** ui-ux
`members/page.tsx` is still `'use client'` while `members/[id]/page.tsx` was converted.
**Fix:** Convert members directory to RSC with initial server-side fetch + client component for search/filter.

### LOW-016: Service-role client created inline in Stripe webhook handler
**ID:** SEC-008 | **Layer:** security
Inconsistent with other service-role usage that goes through `getAdminClient()`.
**Fix:** Extract `getWebhookSupabaseClient()` shared helper.

### LOW-017: X-Frame-Options: DENY may block Phase 5 same-origin iframes
**ID:** SEC-009 | **Layer:** security
SnapWidget and potential member portal iframes may be blocked.
**Fix:** Switch to `Content-Security-Policy: frame-ancestors 'self'`.

### LOW-018: Engagement module is a navigational dead end
**ID:** UF-006 | **Layer:** user-flow
Streak and referrals columns show "--" with no explanation. Users who navigate here are confused.
**Fix:** Hide incomplete columns or add "Coming soon" placeholder until data pipelines exist.

### LOW-019: No component tests for 40+ React components
**ID:** TQ-006 | **Layer:** testing-quality
Zero React Testing Library tests. Recently RSC-converted components and complex modals untested.
**Fix:** Add RTL tests for `MemberProfilePanel`, `AddMemberModal`, layout components.

### LOW-020: Phone normalization test misplaced in unit directory
**ID:** TQ-007 | **Layer:** testing-quality
`phone-normalization-integration.test.ts` is in `unit/api/` but has "integration" in its name.
**Fix:** Clarify placement based on whether it uses real DB connections.

---

## INFO Findings

### INFO-001: rate_limit_entries table lacks explicit RLS documentation
**ID:** DM-009 | **Layer:** data-model
Intentional RLS absence not documented. Add comment to migration.

### INFO-002: AI fallback quality is high — rules-based degradation works well
**ID:** AI-009 | **Layer:** ai-layer
All 22 AI modules degrade gracefully to rules-based fallbacks. Excellent pattern.

### INFO-003: AI model centralized in AI_MODEL constant
**ID:** AI-008 (adjacent) | **Layer:** ai-layer
Single source of truth for model version. Model upgrade is a one-line change. Good practice.

### INFO-004: Stripe webhook uses idempotency table correctly
**Layer:** integration
`processed_webhook_events` table prevents duplicate Stripe event processing. Correct implementation.

### INFO-005: Netlify @netlify/plugin-nextjs correctly configured
**ID:** PERF-008 | **Layer:** performance-infra
App Router on Netlify correctly handled. No manual configuration needed.

### INFO-006: Command palette (Cmd+K) implemented — navigation shortcuts work
**ID:** UX-009 | **Layer:** ui-ux
Command palette present. Expansion to actions (create booking, invite member) would improve UX.

### INFO-007: member-360 test pattern is a strong model for view logic testing
**ID:** TQ-010 | **Layer:** testing-quality
Replicates SQL CASE logic in TypeScript and tests as pure functions. Should be replicated for other complex SQL.

### INFO-008: No hardcoded secrets found in source code
**ID:** SEC-010 | **Layer:** security
Confirmed clean. All API keys use `process.env.*`. HSTS, CSP, and security headers correctly configured.

### INFO-009: Glofox write-back policy is documented and approved
**ID:** INT-007 | **Layer:** integration
Write-back for specific actions (createBooking, markAttendance, cancelBooking) is intentional and policy-approved.

### INFO-010: Turbopack active in dev, webpack in production — expected configuration
**ID:** PERF-009 | **Layer:** performance-infra
No action required.
