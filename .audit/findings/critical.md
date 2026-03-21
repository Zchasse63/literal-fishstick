# Critical Findings

All CRITICAL severity findings, deduplicated and cross-referenced.

---

## CRIT-001 — Automation Engine Completely Non-Functional (Field Mismatch)

**Source layers:** data-model, integration, user-flow, ai-layer
**Corroboration score:** 4/10 agents

**Finding:**
`evaluate-triggers.ts` (Inngest cron, runs every 10 minutes) queries `.eq('status', 'active')` on the `automation_flows` table. The SQL schema defines this as `is_active BOOLEAN DEFAULT FALSE`, not a `status` TEXT column. The query returns 0 flows every run.

**Impact:** The entire automation engine — all 12 trigger types including win-back, churn re-engagement, birthday, credit-expiry, member signup, no-show follow-up — is silently non-functional. No automation flow has ever or will ever execute until this is fixed.

**Fix:** Change `.eq('status', 'active')` to `.eq('is_active', true)` in `evaluate-triggers.ts`.

---

## CRIT-002 — `members` vs `profiles` Table Split Breaks Stripe Webhook

**Source layers:** data-model, integration, security
**Corroboration score:** 3/10 agents

**Finding:**
The Stripe webhook handler (`/api/webhooks/stripe/route.ts`) writes subscription events to `.from('members')`. The entire API layer and UI reads from `.from('profiles')`. If these are separate tables (not a view), Stripe subscription data is written to a dead table.

**Impact:** Membership status never updates from Stripe events. Subscription activations, cancellations, and billing failures are invisible in the admin UI. Revenue data is permanently stale.

**Fix:** Determine whether `members` is a table or a view of `profiles`. If a separate table, migrate the webhook to write to `profiles` using the appropriate field names. Verify `helpers.ts:checkExitConditions()` (which also queries `.from('members')`) is similarly corrected.

---

## CRIT-003 — Churn Prediction Inputs Permanently Corrupted

**Source layers:** data-model, ai-layer
**Corroboration score:** 2/10 agents

**Finding:**
`/api/ai/churn-prediction/route.ts` queries `credit_packs` with `.select('remaining')`. The actual column name is `credits_remaining` (per TypeScript types and consistent API usage). Supabase returns `null` for the unknown column, resulting in `credits_remaining: 0` and `credits_expiring_soon: false` for every member.

**Impact:** All 13 churn predictions receive systematically wrong input data. Claude is making predictions based on false information that every member has zero credits and no credits expiring. This produces incorrect `churn_probability`, `risk_level`, and `recommended_interventions` for all members. Cached results are poisoned for 24 hours.

**Fix:** Change `.select('remaining')` to `.select('credits_remaining')` in the churn prediction route. Invalidate any cached results in `ai_cache` where `cache_type = 'churn_narrative'`.

---

## CRIT-004 — Phase 2 RLS Policies May Not Be Enforced

**Source layers:** security, data-model
**Corroboration score:** 2/10 agents

**Finding:**
Phase 2 RLS policies (campaigns, automations, leads, content, email preferences, cooldowns) use `current_setting('app.studio_id')::uuid`. No code was found that sets this PostgreSQL session variable before executing queries. The `@meridian/supabase` server client is a standard `createSSRClient` with no session variable injection.

**Impact:** If `app.studio_id` is never set, either all RLS policies throw an error (fail-closed, breaking all Phase 2 functionality) or `current_setting` with no default returns null (making `studio_id = null::uuid` comparisons that exclude all rows). Either way, Phase 2 tables are either inaccessible or improperly isolated.

**Fix:** Verify the Supabase RLS configuration. Supabase's standard RLS pattern uses `auth.uid()` not custom session variables. If the intent is session-variable RLS, the server client must execute `SET app.studio_id = '...'` before every query batch, or the RLS policies must be rewritten to use `auth.uid()` lookups against a `studio_members` junction table.

---

## CRIT-005 — `automation_cooldowns` Schema Mismatch (Synthesis Finding)

**Source layers:** Synthesizer (from data-model + integration cross-reference)
**Corroboration score:** 2/10 agents (synthesis)

**Finding:**
The Phase 2 SQL migration defines `automation_cooldowns` with two timestamp columns (`last_automation_email_at`, `last_automation_sms_at`) — one row per member. The `checkAutomationCooldown()` and `updateCooldown()` functions in `lib/inngest/helpers.ts` query with `.eq('channel', channel)` and upsert with `{ onConflict: 'member_id,studio_id,channel' }` — expecting one row per member-channel combination with a `channel` TEXT column.

**Impact:** Both `checkAutomationCooldown()` and `updateCooldown()` will fail at runtime with a Postgres column-not-found error (`channel` column does not exist). Since these are called inside Inngest step functions, failures will be caught and retried, but the cooldown system will never function correctly. This means the 24-hour automation rate limit cannot be enforced.

**Fix:** Reconcile the schema with the code. Either add a `channel TEXT` column and unique constraint to `automation_cooldowns`, or update `helpers.ts` to use the two-timestamp approach defined in the SQL.

---

## CRIT-006 — Zero Test Coverage on Financial and Security Paths

**Source layers:** testing-quality, security
**Corroboration score:** 2/10 agents

**Finding:**
No tests exist for the Stripe webhook handler, booking capacity enforcement, credit expiry grace periods, trainer bonus threshold calculations, or RLS isolation. There is no CI pipeline to catch regressions.

**Impact:** Any regression in financial flows (payment processing, subscription management, credit tracking) or security boundaries (RLS isolation, role authorization) will reach production undetected. As the platform approaches Phase 5 (member-facing, public), this becomes a critical operational risk.

**Fix:** Establish minimum test coverage for: (1) Stripe webhook event handling, (2) concurrent booking capacity, (3) RLS cross-tenant isolation, (4) role-based API authorization. Set up Vitest + Playwright as the test infrastructure.
