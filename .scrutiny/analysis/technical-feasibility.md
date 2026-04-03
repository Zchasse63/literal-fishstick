# Technical Feasibility Analysis
**Agent:** technical-feasibility
**Plan:** Glofox API Migration to Meridian
**Complexity:** SIGNIFICANT
**Date:** 2026-03-31

---

## Agent Verdict
**MODIFY** — The sync engine architecture is technically sound and the tooling choices are correct. However, five concrete bugs and under-specifications exist in the plan's code-level detail, unknown API rate limits represent a genuine schedule risk, and the cutover's pre-condition requiring member-facing features (Phase 5) is a dependency that does not have a timeline. These issues must be resolved before Phase 2 begins, not discovered mid-build.

---

## What Works Well

**Inngest is the right orchestration choice.** The project already runs 12 Inngest functions in production. The pattern is established, retry behavior is solved, and observability is already wired. Adding 8 Glofox sync functions is additive, not architectural.

**Polling-only inbound sync is correct given Glofox constraints.** No webhooks exist on the Glofox side. Using `utc_modified_start_date` / `utc_modified_end_date` filters for incremental sync is the only viable approach. The daily 3am full reconciliation as a safety net is good defensive engineering.

**Per-field conflict resolution is pragmatic.** Coarse ownership rules (Glofox owns financial fields during transition, Meridian always owns AI/segment fields) avoid distributed consensus complexity. The `glofox_sync_conflicts` audit table is correct.

**Schema migrations are safe.** All 27 new columns are nullable or have explicit defaults. The plan correctly gates on running all 229 existing tests after migration. No destructive changes proposed.

**Rollback plan has real structure.** 1-hour / 24-hour / fix-forward tiers are realistic. Supabase PITR as the data safety net is correct. "Never delete from Glofox" is the right policy.

---

## Critical Issues

### Issue 1: Rate Limits Unknown — This Is a Schedule Risk, Not Just a Mitigation Item

The plan lists Glofox API rate limiting as Medium likelihood / High impact and proposes "exponential backoff, batch requests, cache responses" as mitigation. This treatment is too casual.

The proposed sync schedule implies a minimum of:
- Bookings every 5 min: 288+ requests/day (plus pagination)
- Members every 10 min: 144+ requests/day (plus pagination — 11 pages at 100/page for 1,100 members)
- Events every 15 min: 96+ requests/day
- Transactions every 30 min: 48+ requests/day
- Full refresh daily: ~30–50 additional requests across all entity types

Total: approximately 600–700+ API calls per day before accounting for outbound writes. If Glofox enforces even a conservative 100 req/hour rate limit, the booking sync alone runs at risk. Many SaaS APIs enforce per-minute limits (e.g., 30 req/min) that would make 5-minute polling unsustainable.

**The sync frequencies in the plan were chosen for data freshness, not based on any rate limit knowledge.** They need to be validated against actual limits before Phase 2 begins. If limits are tight, the booking sync may need to move to 15 or 30 minutes.

**Recommended action:** Obtain rate limit documentation from Glofox before designing the sync schedule. If undocumented, run a burst test in Phase 1 to determine practical limits empirically.

### Issue 2: Pagination Contract Is Assumed, Not Verified

The `GlofoxClient.fetchAll()` implementation terminates pagination based on:

```typescript
hasMore = body.has_more ?? false
```

The `?? false` default means: if the field is absent in the response, assume no more pages exist. If Glofox uses a different pagination signal — `total_count` + page math, a `next_cursor`, a `Link` header, or `page >= last_page` — this code silently returns only page 1. With 1,100 members at 100/page, that means 10 pages would exist and 1,000 members would be missed on every incremental sync.

The Glofox API spans at least 5 version namespaces (2.0, 2.1, 2.2, 2.3, v3.0, Analytics). Different endpoints may use different pagination patterns across these versions. The `fetchAll` implementation needs to be validated against the actual response schema for each major endpoint, not assumed.

**Recommended action:** Verify pagination contract in glofox-api-guide.md for each entity type. Write the pagination response as an explicit TypeScript type. Test `fetchAll` against a live endpoint with a known record count to confirm it retrieves all pages.

### Issue 3: Outbound Sync Triggering Mechanism Is Unspecified — Loop Risk

The plan describes outbound sync as "event-driven, triggered by database changes" but never defines the mechanism. This is a core architectural decision that must be made before building.

In this codebase, the likely correct approach is **application-level triggering**: API routes that write to members or bookings also call `inngest.send()`. This is consistent with how existing Inngest events fire (e.g., `member/signup` triggered in the signup flow). But the plan leaves it unspecified.

More critically: the plan does not include loop-prevention logic. The sync loop risk is:

1. Glofox updates a booking → inbound sync pulls it → updates Meridian booking record
2. Meridian booking record change triggers outbound sync → pushes update to Glofox
3. Glofox's `updated_at` changes → next inbound sync window picks it up again
4. Repeat indefinitely

Every sync cycle would generate both inbound and outbound API calls for records that were originally changed in Glofox. Prevention requires: when an inbound sync update writes to the database, mark the record with `glofox_synced_at = now()` and in the outbound trigger, skip records updated within the last N seconds from an inbound sync source.

**Recommended action:** Specify the outbound triggering mechanism explicitly. Add a `sync_source` field or use the `glofox_synced_at` timestamp as a loop guard in all outbound sync functions.

### Issue 4: Pre-Cutover Checklist Has an Unsatisfied Dependency With No Timeline

Phase 4 pre-cutover checklist (Section 4.1) includes:

> "All member-facing features ready (booking portal, app)"

Per CLAUDE.md, Phase 5 (Web Booking Portal, iOS Member App, React Native) has not started and is the final phase of the product roadmap. Phase 5 is a multi-month development effort. The migration plan treats this as a checklist item without acknowledging it has no timeline or scope.

If member-facing features are not ready, Meridian cannot be the sole operational system — members cannot book, pay, or manage accounts. The plan has two viable paths it does not choose between:

**Option A (Deferred cutover):** Admin/staff operations move to Meridian; Glofox stays alive for member-facing access. The sync engine remains active longer, Glofox subscription is not cancelled, but internal operations benefit immediately.

**Option B (Member portal first):** Build a minimal member-facing booking portal before cutover. This is a scope addition the plan does not budget for.

The 8-week timeline as written is implicitly based on Option A (admin cutover only) but the cutover checklist requires Option B. This contradiction is the plan's largest structural flaw.

### Issue 5: Payment Migration Underestimates Member Non-Collection Rate

"Collect payment method (card) via Meridian member portal" requires:
1. A member-facing portal (doesn't exist yet)
2. Members to take action proactively
3. Successful email delivery and engagement

Industry benchmarks for payment method migration campaigns: 60–80% success within a 2-week window under good conditions. At 80% success with 1,100 members, approximately 220 members would not have Stripe payment methods by cutover. The plan's fallback — "manually process via Glofox for that member while debugging" — does not scale to 220 simultaneous failures on the first post-cutover billing run.

A staged rollout (migrate 10% of members, validate, then proceed) is not mentioned. A dunning/retry flow for failed payment collection is not mentioned.

---

## Code-Level Bugs

### Bug 1: Name-splitting produces wrong results and has a null-access risk

In `pushMemberUpdate`:
```typescript
first_name: member.full_name?.split(' ')[0],
last_name: member.full_name?.split(' ').slice(1).join(' '),
```

The `?.` operator short-circuits the `.split()` call if `full_name` is null/undefined — but the array index access `[0]` and `.slice()` still execute on `undefined` in JavaScript, producing `undefined`. This will silently send `first_name: undefined` to Glofox, which may clear the field or throw a 400.

Name splitting is also semantically wrong for: single-name profiles, prefixed names ("Dr. Jane Smith"), members whose full_name is stored as "LastName, FirstName". If profiles have separate `first_name` / `last_name` columns (common schema pattern), those should be read directly.

### Bug 2: Missing UNIQUE constraint on glofox_sync_state

The inbound sync upsert specifies:
```typescript
{ onConflict: 'studio_id,entity_type' }
```

But the `glofox_sync_state` table DDL does not include:
```sql
UNIQUE(studio_id, entity_type)
```

Without this constraint, the Supabase upsert will fail with a constraint violation error on every sync run after the first. This needs to be added to the migration.

### Bug 3: sold_by_profile_id FK will fail for non-Meridian staff

The transactions table adds:
```sql
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS sold_by_profile_id uuid REFERENCES profiles(id);
```

The value being mapped is a Glofox-internal staff ID. Glofox staff who do not have corresponding Meridian profiles will cause FK constraint failures during transaction sync. Given the plan notes ~10 staff members in Glofox, and some staff may not have been imported, this will produce sync errors on a non-trivial fraction of transactions.

Either make this nullable with explicit null-on-no-match logic, or store as `text` and do FK resolution separately.

### Bug 4: Analytics/report endpoint may not support incremental sync

The transactions sync relies on `POST /Analytics/report`. This is a reporting endpoint, not a CRUD endpoint. Reporting APIs frequently:
- Require date ranges (not modified-since timestamps)
- Return aggregated data rather than individual transaction records
- Have lower rate limits than CRUD endpoints
- Not support the same pagination patterns as other endpoints

The plan assumes this endpoint works like other Glofox endpoints. If it returns only aggregated totals rather than individual transaction rows, the transaction sync design needs to be completely reconceived.

### Bug 5: fetchAll constructs URLs incorrectly for absolute paths

```typescript
const url = new URL(path, this.baseUrl)
```

If `path` starts with `/` (e.g., `/2.0/members`), the `new URL(path, base)` constructor treats it as an absolute path and discards `baseUrl`'s path component. For `baseUrl = 'https://gf-api.aws.glofox.com/prod'`, a `path` of `/2.0/members` would produce `https://gf-api.aws.glofox.com/2.0/members` — dropping the `/prod` prefix and resulting in 404s.

The path should either always be relative (no leading slash) or the URL construction should use string concatenation: `${this.baseUrl}${path}`.

---

## Technical Feasibility Summary

| Component | Feasibility | Confidence |
|-----------|-------------|------------|
| Schema migrations | High | High |
| GlofoxClient HTTP layer | High | Medium (pending pagination validation) |
| Inbound sync cron jobs | High | Medium (pending rate limit validation) |
| Outbound sync event-driven | Medium | Low (trigger mechanism unspecified, loop risk) |
| Conflict resolution logic | High | High |
| Shadow / parallel mode operations | High | High |
| Payment migration | Low-Medium | Low (no member portal exists) |
| DNS cutover | High | High |
| Rollback plan | High | High |
| 8-week timeline | Low | Low (Phase 5 dependency is unsatisfied) |

**Overall technical verdict: The sync engine is buildable. The 8-week cutover timeline is not achievable as written.**
