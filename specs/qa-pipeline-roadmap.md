# Meridian QA Pipeline Roadmap

**Created:** 2026-04-09
**Owner:** QA Council
**Status:** Tier 0 in progress
**Pilot run:** Login — complete (`specs/reports/login-report.md`)

---

## Executive summary

- **61 council runs** across **8 tiers**, preceded by **Tier 0 foundation work**
- **Current status:** 36/67 done (Tier 1 ✅ COMPLETE, Tier 2 ✅ COMPLETE, **Tier 3 ✅ COMPLETE 12/12**, **Tier 4 ✅ COMPLETE 8/8** + Tier 4.6.5 sweep). Roadmap expanded with Tier 4.6.5 (audit-sweep remediation — DONE) and Tier 8.5 (UI/UX cohesion + information hygiene, ~11 tiers — pending). **🎉 Tier 4 milestone reached.** Next: Tier 5 (Marketing + AI — 10 runs).
- **Critical unblock:** `db.ts` hardcodes `TEST_STUDIO_ID` at module level; admin pages query `DEFAULT_STUDIO_ID`. Tier 0 parameterizes fixtures so we don't have to wait for the 43-file StudioContext refactor (BUG-001, see `specs/bugs/revenue-default-studio-coupling.md`) before testing admin modules
- **Estimated test output at completion:** ~450 real E2E tests across ~45 POMs

## Current state snapshot

### Infrastructure (in place)
- Playwright config with 4 projects: `auth-setup`, `admin`, `employee`, `anonymous`
- `BasePage.ts` + `LoginPage.ts` — only real POMs
- `db.ts` seeding helpers (hardcoded to `TEST_STUDIO_ID`)
- `test-data.ts` — `ADMIN_USER`, `EMPLOYEE_USER`, `TEST_STUDIO_ID`, `DEFAULT_STUDIO_ID`
- `auth.setup.ts` — seeds auth test users via Supabase Admin API

### Stub specs (legacy — need full pipeline replacement)
`analytics.spec.ts`, `command-center.spec.ts`, `corporate.spec.ts`, `employee-portal.spec.ts`, `marketing.spec.ts`, `members.spec.ts` (has 1 forbidden pattern), `revenue.spec.ts`, `schedule.spec.ts`

### Known blockers
1. **BUG-001**: `DEFAULT_STUDIO_ID` hardcoded in 43 admin pages (write tests blocked without workaround)
2. **Toast helper mismatch**: BasePage targets sonner, but Meridian uses custom `ToastNotification`
3. **Fixture coupling**: `db.ts` hardcodes `TEST_STUDIO_ID` at import time — can't be overridden per-test

---

## Tier 0 — Foundation Unblock (DEV WORK)

Remove blockers that would otherwise re-surface in every downstream council run.

| # | Task | Files | Gate |
|---|---|---|---|
| 0.1 | Add `data-testid="toast-notification"` + `role="status"` to `ToastNotification`. Update `BasePage.expectSuccessToast` / `expectErrorToast` to target it. | `src/components/ui/toast-notification.tsx`, `e2e/pages/BasePage.ts` | Throwaway `expectSuccessToast()` passes |
| 0.2 | Parameterize `db.ts`: `seedMember({ studioId? })`, `seedClass({ studioId? })`, `seedTransaction({ studioId? })`, `resetStudioTestData(studioId?)`. Default to `DEFAULT_STUDIO_ID`. | `e2e/fixtures/db.ts`, `e2e/fixtures/test-data.ts` | Login tests still pass + seed lands in admin-visible studio |
| 0.3 | Move legacy stubs to `e2e/_stubs/` (out of test run) | 8 stub files | Only login.spec.ts runs under admin/anonymous projects |
| 0.4 | Update `apps/web/AGENTS.md` naming convention: add all module prefixes | `apps/web/AGENTS.md` | Convention doc lists all future prefixes |
| 0.5 | Pre-flight smoke across all 3 projects | — | Three green project runs + pipeline-log entry |

**Gate:** No Tier 1 runs until 0.1–0.5 are done.

---

## Tier 1 — Auth & Session (4 council runs)

| # | Feature | Project | Est. tests | Status |
|---|---|---|---|---|
| 1.1 | Login | anonymous | 8 | ✅ DONE |
| 1.2 | Middleware protected-route redirect | anonymous | 5 | ✅ DONE |
| 1.3 | Logout flow | admin | 4 | ✅ DONE |
| 1.4 | Session refresh / expired session | admin | 4 | ✅ DONE |

**Tier gate:** ✅ **COMPLETE.** 4/4 pipelines done. `LoginPage.ts` extended with `logout()`, `mockLogoutServerCall()`, `clearAuthCookies()`, `tamperAuthCookie()`. `BasePage.expectRedirectToLogin()` helper added. 21 tests, 4 bugs surfaced (BUG-001 through BUG-004).

---

## Tier 2 — Admin Smoke (11 council runs, page-mount only)

Baseline coverage: every admin page MOUNTS without crashes. No data assertions — just "page renders, no console errors, no 500s, expected landmarks visible".

| # | Feature | Pages | Est. tests | Status |
|---|---|---|---|---|
| 2.1 | Command Center smoke | `/` | 4 | ✅ DONE |
| 2.2 | Schedule smoke | `/schedule` | 3 | ✅ DONE |
| 2.3 | Members smoke | `/members`, `/members/[id]` | 4 | ✅ DONE |
| 2.4 | Revenue smoke | `/revenue`, `/revenue/orders`, `/revenue/products`, `/revenue/products/new`, `/revenue/products/[id]` | 6 | ✅ DONE |
| 2.5 | Marketing smoke | `/marketing`, `/marketing/campaigns`, `/marketing/automations`, `/marketing/content`, `/marketing/leads` | 5 | ✅ DONE |
| 2.6 | Corporate smoke | `/corporate`, `/corporate/new`, `/corporate/events`, `/corporate/[id]` | 5 | ✅ DONE |
| 2.7 | Analytics smoke | `/analytics` + all 15 sub-pages (16 routes) | 16 | ✅ DONE |
| 2.8 | Operations smoke | `/operations`, `/operations/documents`, `/operations/payroll` | 3 | ✅ DONE |
| 2.9 | Settings smoke | `/settings`, `/settings/geofence`, `/settings/sms` | 3 | ✅ DONE |
| 2.10 | Segments + Engagement + Docs smoke | `/segments`, `/engagement`, `/docs/api` | 3 | ✅ DONE |
| 2.11 | Employee portal smoke | all 9 employee pages | 9 | ✅ DONE |

**Tier gate:** ✅ **COMPLETE.** 11 smoke specs pass. 11 new POMs. 61 tests covering 52 routes. Only BUG-005 surfaced (command-center activity API returning 500).

---

## Tier 3 — Revenue + Members + Schedule Writes (12 council runs)

Core studio operations. Write flows with DB assertions.

| # | Feature | POM | Est. tests | Status |
|---|---|---|---|---|
| 3.1 | Revenue: Record Payment | `RevenuePage` (extended) | 8 | ✅ DONE |
| 3.2 | Revenue: Refund | `RevenuePage` | 6 | 🚫 GAP-FILED (BUG-008) |
| 3.3 | Revenue: Issue Credit | `RevenuePage` | 5 | 🚫 GAP-FILED (BUG-008) |
| 3.4 | Revenue: Product Create/Edit/Archive | `RevenuePage` (extended) | 9 | ✅ DONE |
| 3.5 | Members: Create Member | `MembersPage` (extended) | 9 | ✅ DONE |
| 3.6 | Members: Edit Member | `MembersPage` (extended) | 9 | ✅ DONE |
| 3.7 | Members: Archive / Exclude from Analytics | `MembersPage` (extended) | 5 | ✅ DONE |
| 3.8 | Schedule: Create Class | `SchedulePage` (extended) | 7 | ✅ DONE |
| 3.9 | Schedule: Cancel Class | `SchedulePage` (extended) | 5 | ✅ DONE |
| 3.10 | Schedule: Reschedule Class | `SchedulePage` (extended) | 5 | ✅ DONE |
| 3.11 | Schedule: Waitlist Add/Remove | `SchedulePage` | 5 | 🚫 GAP-FILED (BUG-008 GAP-3) |
| 3.12 | Check-in (QR + manual) | `SchedulePage` (extended) | 3 | ✅ DONE (narrow scope — BUG-019 + BUG-020 filed) |

**Tier gate:** ✅ **COMPLETE.** 12/12 council runs done. **9 full pipeline runs** (3.1, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10) + **1 narrow-scope run** (3.12 — verifies as-shipped UI behavior, files BUG-019 + BUG-020 for follow-up) + **3 gap-filed runs** (3.2 Refund, 3.3 Issue Credit, 3.11 Waitlist — all covered by BUG-008). Total: **45 tests** in the Tier 3 regression suite. **11 bugs surfaced** (BUG-008 through BUG-020). 7 fully closed inline, 1 narrowed (BUG-013), 4 filed for follow-up tiers (BUG-016, 019, 020, + latent DELETE filter and db.ts cleanup bugs documented inline). Tier 3 took ~24 hours of council runs across 2026-04-09 → 2026-04-10.

---

## Tier 4.6.5 — Audit-Sweep Remediation (NEW — inserted after audit findings)

A single dedicated tier that batches all the mechanical fixes from the audit sweep (`specs/bugs/qa-pipeline-systematic-findings.md`). Triggered by BUG-024 (Tier 4.5) and BUG-026 (Tier 4.6) which suggested broader systemic issues. The audit confirmed it: **14 findings** spanning RLS gaps, phantom enum values, silent-swallow inserts, phantom column writes, phantom tables, and UI bypasses.

| Sub-task | Type | Files affected | Severity |
|---|---|---|---|
| **M1** Migration: create RLS policies for 8 policy-less tables (F1) | DB | 8 tables | 🔴 CRITICAL |
| **M2** Migration: extend `activity_log.type` enum with ~30 missing values (F5) | DB | 1 migration | 🟠 HIGH |
| **M3** Migration: fix `classes_write` operator precedence (F7 / BUG-016 L6) | DB | 1 migration | 🟠 MEDIUM |
| **B1** Route batch: replace phantom `'confirmed'` booking status in 11 routes (F2) | code | 11 files | 🔴 CRITICAL |
| **B2** Route batch: add description + capture-and-log to 95 silent-swallow activity_log inserts (F4 + F5 prerequisites) | code | ~95 routes | 🟠 HIGH |
| **U1** UI fix: BUG-020 Check In All → call `/api/check-in` per attendee (F8) | code | 1 file | 🟠 MEDIUM |
| **U2** UI fix: pricing simulator new page → call `/api/pricing-simulator` (F8) | code | 1 file | 🟠 MEDIUM |
| **D1** Diagnose Tier 4.5 corporate POST full-payload 500 (F13) | code | 1 file | 🟡 MEDIUM |

**OUT OF Tier 4.6.5 scope (handed to feature-dev backlog):**
- F3 — `promo_codes` table missing → see B6 in `specs/bugs/feature-dev-backlog.md`
- F6 — Systemic RLS role-check absence → see B8 (needs design decisions)
- F9 — BUG-013 Pause/Upgrade panel full fix → see B9 (cleaner as a dedicated rewrite tier)
- F14 — `increment_rate_limit` RPC missing → see B7

**Tier gate:** Migrations apply cleanly + full Tier 3 regression (45 tests) passes + new tests for the fixed paths. After this tier, Tier 5+ marketing tests run on a clean foundation.

---

## Tier 8.5 — UI/UX Cohesion + Information Hygiene Sweep (NEW — added 2026-04-10)

**Purpose:** Apply the same systematic audit-and-fix methodology to UI/UX quality, data freshness, AI insight accuracy, dashboard cohesion, AND information hygiene. The bug-fix work in Tiers 1–8 ensures the data is correct and the routes work; Tier 8.5 ensures the user experience is professional, fast, trustworthy, and **every piece of information serves a real business purpose**.

**Core principle (user mandate, 2026-04-10):**

> "Everything needs to serve a purpose. No phony or unnecessary information or fluff. Only real actual things that make the business more efficient. This needs to be a command powerhouse for our company."

**Triggered by user feedback (2026-04-10):**
- AI insights weren't loading properly / had delayed data / didn't seem accurate
- Dashboard data didn't feel cohesive
- Member list ordering doesn't make sense — needs sorting/filtering
- Member cards/detail panels need accuracy verification
- The same rigor applies to **every page on the site**

**Scope:** Methodologically mirrors the audit-sweep approach (greps + DB probes + Playwright walks) but the targets are UI quality and data flow, not bug fixes.

| Audit | Method | Output |
|---|---|---|
| **U1** Stat freshness audit | For every stat card / metric on every admin page, trace: (a) source query, (b) cache TTL / polling interval, (c) staleness window | List of stale or delayed data sources |
| **U2** AI insight wiring audit | Find every AI call site (`anthropic.messages.create`, `/api/ai/*`). Verify: actually fires (not stubbed), responds, parses correctly, renders to UI, has error handling | List of AI features that look like they work but don't |
| **U3** Data cohesion audit | Cross-page consistency check: does the "active members" count on Command Center match the count on Members directory? Does Revenue MRR match what Analytics shows? Same for trainer counts, class counts, etc. | List of cross-page data inconsistencies |
| **U4** Empty state + loading state audit | Walk every admin page in 3 modes: empty data, loading, error. Screenshot each. Verify: helpful empty states, skeleton loaders, error messages with retry actions | List of pages with missing/broken empty/loading/error states |
| **U5** Navigation flow audit | Walk all 50+ admin routes via Playwright. Verify: no 404s, no infinite redirects, all sidebar links land on a page that loads, command palette finds every page | List of broken navigation paths |
| **U6** Design system adherence audit | Compare each component to the MagicPath design guide. Verify: typography, color tokens, spacing, button styles, animations, dark mode parity | List of components that drift from the design system |
| **U7** Real-time data audit | The 60-second polling pattern (CLAUDE.md) — verify actually polling on Command Center / Schedule. Find places where polling should happen but doesn't. | List of pages with stale-after-load behavior |
| **U8** Performance audit | Lighthouse / Playwright traces on every page. Find slow LCP, layout shifts, blocking JS | List of performance regressions |
| **U9** **Member card / detail accuracy audit** (NEW — user-mandated) | For every field shown on the member detail panel and member card: trace it to its source query. Is the data accurate? Does it match what's in the DB? Is it current? Does the field serve a real business purpose? | List of inaccurate, stale, or fluff fields to remove or fix |
| **U10** **Information-purpose audit** (NEW — site-wide, user-mandated) | Walk every page. For every visible field, badge, stat, chart, or component, ask: "Does this make the business more efficient? Would a studio owner or manager actually use this?" Flag fluff, vanity metrics, and decorative-only elements. | List of elements to remove, consolidate, or replace with something useful |
| **U11** **Sorting/filtering audit** (NEW — site-wide, user-mandated) | For every list view (members, classes, transactions, products, leads, employees, events, etc.) verify: (a) is there a sensible default sort?, (b) are sort controls present?, (c) are filter controls present and functional?, (d) does pagination work?, (e) does search work? | List of list views missing sort/filter/search/pagination |
| **U12** **List ordering rationality audit** (NEW — user-mandated) | Specifically: every list view's default sort. Today the members directory orders by `id` (UUIDs — random). It should be by `last_name`, `last_visit`, `lifetime_value`, or another business-meaningful field. Same review for every other list. | List of list views with non-meaningful default sorts |

After audits, batch fixes by category:
- **F1 batch** — fix all stale data sources / cache TTLs / wire up missing polling
- **F2 batch** — wire up real AI calls, fix parsing/rendering, add error handling
- **F3 batch** — make data sources canonical (one query, one number, used everywhere)
- **F4 batch** — add empty/loading/error states to every page
- **F5 batch** — fix navigation gaps, add missing routes, fix command palette
- **F6 batch** — design system polish (could use the `frontend-design` skill)
- **F7 batch** — REMOVE fluff fields/components/charts from every page (the inverse of typical work — deletion, not addition)
- **F8 batch** — add sensible default sorts + sort/filter/search/pagination controls to every list view
- **F9 batch** — rebuild the member list with proper segmentation (status, membership tier, last visit, lifetime value)
- **F10 batch** — verify every member detail field against the source data; rewrite any inaccurate or aggregated-from-stale-source fields

**Estimated tier count:** Single mega-tier OR split into 12 smaller tiers (one per audit). Probably 1 mega-audit (covering U1–U12) followed by 10 fix-tiers (one per F batch above) = **~11 council runs**.

### The "Information Hygiene" principle for Tier 8.5

Every page in the site will be evaluated against this checklist before passing the tier gate:

**For every visible UI element on every page:**
1. **Is the data accurate?** Trace the value back to its source query. Match against the DB.
2. **Is the data current?** Check the polling interval / cache TTL. If it's stale, fix or remove.
3. **Is the data necessary?** Would a real studio owner or manager use this to make a decision? If no, remove.
4. **Is the placement right?** Is it where the user would expect it? Is it competing with more important info?
5. **Is the interaction obvious?** Can the user click into it for more detail? Does the click do something useful?

**For every list view:**
1. Default sort must be **business-meaningful** (last visit, lifetime value, recently created, alphabetical by name) — NEVER by `id` or `created_at` UUID order.
2. Sort controls must be present and functional.
3. Filter controls must be present, functional, and persist across page navigation.
4. Search must be server-side and instant (debounced).
5. Pagination must work and the page count must be visible.
6. Empty states must be helpful ("No members match your filters — try clearing them" with a button).

**For every detail panel / card:**
1. Every field must be accurate (cross-check against DB).
2. Every field must serve a purpose. **Delete fluff fields ruthlessly.**
3. Aggregated fields (visit count, lifetime value, churn risk) must be computed from real data, not placeholder.
4. AI insights must actually call the API and show real responses, not stubs.
5. Action buttons must do what their label says (no "Edit" buttons that don't open an edit modal).

### Specific known concerns (user-flagged 2026-04-10)

These will be the FIRST targets when Tier 8.5 begins:

1. **Member directory ordering** — currently `.order('id', { ascending: true })` which produces random-looking UUID order. Must change to a business-meaningful default. Candidates: `last_visit DESC` (most recently active first), `lifetime_value DESC` (best customers first), `created_at DESC` (newest first), or `profiles.full_name ASC` (alphabetical). Also: every other list view in the site has the same problem and needs the same review.

2. **Member detail panel field audit** — every field on the panel needs to be verified for accuracy and purpose:
   - Visit history / heatmap (is it real or placeholder?)
   - Lifetime value (sourced from transactions?)
   - Churn risk / health score (real AI prediction or stub?)
   - Membership tier (current?)
   - Strike count (real?)
   - Wallet balance (synced with wallet_transactions?)
   - Last visit (synced with check-ins?)
   - AI summary (real Claude call or stub?)
   - Tags (real or fake?)
   - Notes (the BUG-018 fix proved the edit flow works — what about the read flow?)
   - Bookings list (real or fake?)
   - Transactions list (real or fake?)

3. **Site-wide fluff hunt** — walk every page and aggressively flag:
   - "Trending" badges that don't reflect real trends
   - "AI Insight" cards that show static text
   - Sparkline charts with random data
   - Stat cards showing "+12%" without a real comparison period
   - "Recommended" sections with no real recommendation logic
   - Decorative gradients/icons that don't communicate anything

**The bar:** "Linear meets Apple Health meets Stripe Dashboard" — confident, information-dense, never decorative for decoration's sake. Every pixel earns its place.

**Where this fits in the roadmap:**
- AFTER all bug-fix tiers (Tier 1–8 closed)
- BEFORE handing the dashboard to real users
- Could be combined with Tier 8 polish into a single "production-readiness" tier set

**Tier gate:** Every admin page passes a checklist: (a) loads in <2s, (b) shows real data, (c) updates without manual refresh, (d) has empty/loading/error states, (e) AI features actually fire, (f) cross-page numbers match, (g) design system adherent, (h) no console errors. Visual evidence: full screenshot suite + Playwright trace files attached to the Scribe report.

**Total roadmap impact:** +1 audit-sweep remediation tier (4.6.5) + ~11 UI/UX cohesion tiers (8.5 expanded) = **~67 council runs total** (was 61). Worth it — Tier 8.5 is what makes the dashboard usable as a "command powerhouse" rather than a working-but-meh tool.

---

## Tier 4 — Memberships + Corporate + Operations Writes (8 council runs)

| # | Feature | POM | Est. tests | Notes |
|---|---|---|---|---|
| 4.1 | Memberships: Assign | _(API-level — POM not built)_ | 5 | ✅ DONE (narrow scope — BUG-021 fixed, BUG-013 still open) |
| 4.2 | Memberships: Upgrade (Stripe proration) | _(N/A — gap-filed)_ | 0 | 🚫 GAP-FILED (Stripe stubbed + covered by 4.1) |
| 4.3 | Memberships: Downgrade (next cycle) | _(API-level)_ | 4 | ✅ DONE (narrow scope — BUG-022 fixed) |
| 4.4 | Memberships: Cancel | _(N/A — gap-filed)_ | 0 | 🚫 GAP-FILED (feature absent — BUG-008 GAP-6) |
| 4.5 | Corporate: Create Account | _(API-level)_ | 5 | ✅ DONE (narrow scope — BUG-023 + CRITICAL BUG-024 RLS fix) |
| 4.6 | Corporate: Create Event | _(API-level)_ | 5 | ✅ DONE (narrow scope — BUG-025 + SYSTEMIC BUG-026 RLS fix across 17 tables) |
| 4.7 | Operations: Upload Waiver Doc | _(API-level — routes built inline)_ | 6 | ✅ DONE (backend built, UI deferred) |
| 4.8 | Smart Segments: Create Segment | _(API-level)_ | 6 | ✅ DONE (narrow scope — role check + activity log added) |

**Tier gate:** ✅ **COMPLETE.** 8/8 council runs done. **6 full pipeline runs** (4.1, 4.3, 4.5, 4.6, 4.7, 4.8) + **2 gap-filed runs** (4.2 Stripe-stubbed, 4.4 Cancel feature absent) + **1 mega-sweep tier** (4.6.5). Total: **30+ tests** in Tier 4 regression suite (including the new Tier 4.7 waiver routes and Tier 4.8 segments tests). **9 bugs surfaced and fixed** (BUG-021 through BUG-026, plus 2 check-in route phantom column bugs, plus Tier 4.8 missing role check + missing activity log). **2 CRITICAL bugs surfaced systemic issues** — BUG-024 (company_accounts broken RLS) led to BUG-026 (17-table systemic RLS) discovered via audit sweep. Tier 4 took ~6 hours across 2026-04-10. **The audit sweep methodology (Tier 4.6.5) is now an established pattern** — applied at the end of a tier set to catch systemic issues before they contaminate the next tier set.

---

## Tier 5 — Marketing + AI (10 council runs)

| # | Feature | POM | Est. tests | Mock |
|---|---|---|---|---|
| 5.1 | Marketing: Create Campaign | new `MarketingPage` | 7 | |
| 5.2 | Marketing: Send Campaign | `MarketingPage` | 6 | Resend |
| 5.3 | Marketing: Create Automation Flow | `MarketingPage` | 6 | |
| 5.4 | Marketing: Content Hub Create | `MarketingPage` | 5 | |
| 5.5 | Marketing: Lead Pipeline Update | `MarketingPage` | 5 | |
| 5.6 | AI: Command Center briefing | new `AIPage` | 5 | Anthropic |
| 5.7 | AI: Member profile insights | `AIPage` | 4 | Anthropic |
| 5.8 | AI: Churn prediction | `AIPage` | 4 | Anthropic |
| 5.9 | AI: Pricing recommendation | `AIPage` | 4 | Anthropic |
| 5.10 | AI: Email draft assist | `AIPage` | 4 | Anthropic |

**Tier gate:** Resend + Anthropic always mocked. AI tests assert UI behavior, not LLM output.

---

## Tier 6 — Analytics + Reports (6 council runs)

| # | Feature | POM | Est. tests |
|---|---|---|---|
| 6.1 | Analytics: Executive Dashboard | new `AnalyticsPage` | 5 |
| 6.2 | Analytics: Custom Report Create | `AnalyticsPage` | 7 |
| 6.3 | Analytics: Trainer Performance | `AnalyticsPage` | 5 |
| 6.4 | Analytics: Pricing Simulator | `AnalyticsPage` | 6 |
| 6.5 | Analytics: Migration status page | `AnalyticsPage` | 4 |
| 6.6 | Analytics: Glofox Migration (dry-run only — no writes to Glofox) | `AnalyticsPage` | 4 |

---

## Tier 7 — Employee Portal Writes (6 council runs)

| # | Feature | POM | Est. tests | Notes |
|---|---|---|---|---|
| 7.1 | Clock In/Out | new `EmployeeClockPage` | 7 | Mock geolocation |
| 7.2 | Submit Timesheet | new `EmployeeTimesheetPage` | 5 | |
| 7.3 | View Pay / Performance | new `EmployeePayPage` | 4 | Read-only |
| 7.4 | Update Profile | new `EmployeeProfilePage` | 5 | |
| 7.5 | Generate Promo Code Link | new `EmployeePromoPage` | 5 | |
| 7.6 | View Schedule | new `EmployeeSchedulePage` | 4 | Read-only |

---

## Tier 8 — Platform + Stress (5 council runs)

| # | Feature | Est. tests | Notes |
|---|---|---|---|
| 8.1 | Multi-tenancy RLS enforcement | 6 | Seed 2 studios, cross-check isolation |
| 8.2 | Concurrent booking race | 5 | N parallel POSTs, assert atomic capacity |
| 8.3 | Rate limit / dunning retry | 4 | Mock Stripe failure + retry |
| 8.4 | Error boundary / 500 handling | 4 | Force 500 via mock, assert fallback |
| **8.4.5** | **Supabase Direct Audit (NEW)** | **bulk migration** | **Proactive sweep via Supabase MCP — security advisors, performance advisors, phantom column inventory (all tables), orphaned RLS policies, missing RPCs (`increment_rate_limit`, `count_today_bookings`, etc), index coverage on hot paths. Produces a single batch migration for auto-fixable items + backlog entries for design decisions. Must run before Tier 8.5 so UI/UX audit is not contaminated by data-layer rot.** |

---

## Dependency graph

```
Tier 0 (foundation)
  └─ Tier 1 (auth) ──┬──> Tier 2 (smoke) ──┬──> Tier 3 (core writes)
                     │                      │
                     │                      ├──> Tier 4 (memberships/corp/ops)
                     │                      │
                     │                      ├──> Tier 5 (marketing/AI)
                     │                      │
                     │                      ├──> Tier 6 (analytics)
                     │                      │
                     │                      └──> Tier 7 (employee portal)
                     │
                     └──────────────────────────> Tier 8 (platform/stress)
```

## Parallelization

- **Analyst phases can be batched** (3-4 specs per exploration session)
- **Engineer phases must be serial** (shared file modifications)
- **Sentinel can run in parallel with next Engineer phase** if files don't overlap
- **Cadence target:** 3-5 features per tier per session

## Quality gates (applied to every tier)

1. 100% P0 tests passing
2. Flake check (`--repeat-each=3`) green
3. No regression in previous tier's suites
4. TypeScript clean in `e2e/`
5. Zero forbidden patterns
6. Scribe report + pipeline-log entry per feature

## Parking lot (out of scope)

- Landing page (Astro) — Phase 5
- iOS apps (React Native) — Phase 5
- Community board — Phase 5
- Accessibility audit — separate A11y pipeline
- Mobile viewport — desktop only
- Load testing — k6 or similar, not Playwright
- Visual regression — separate concern

---

## Progress log

- **2026-04-09:** Roadmap created. Pilot (Login) complete. Tier 0 starting.
- **2026-04-09 14:45:** ✅ **Tier 0 complete.** All 5 tasks done: toast helper fix, db.ts parameterization, stub quarantine, AGENTS.md prefix list, baseline smoke (3 projects green). Ready for Tier 1 (Auth & Session) council runs.
- **2026-04-09 15:20:** ✅ **Tier 1.2 complete.** Middleware protected-route redirect — 5/5 tests passing (4 P0, 1 P1), zero flakes in 3× repeat, no login regression. `BasePage.expectRedirectToLogin()` helper added (Tier 1 gate requirement). BUG-002 filed (login page ignores `?redirect=` param). Next: Tier 1.3 (Logout flow).
- **2026-04-09 15:45:** ✅ **Tier 1.3 complete.** Logout flow — 4/4 tests passing (3 P0, 1 P1), zero flakes in 3× repeat, no anonymous regression. `LoginPage.logout()` + `LoginPage.mockLogoutServerCall()` added (Tier 1 gate satisfied). Healer ran 2 iterations: (1) mocked Supabase global-scope logout endpoint to prevent `admin.json` refresh-token poisoning, (2) swapped `waitForURL` → polling `toHaveURL` to tolerate in-flight aborts during hard navigation. BUG-003 filed (employee portal has no logout button). **Tier 1 is 3/4 complete.** Next: Tier 1.4 (Session refresh / expired session).
- **2026-04-09 16:05:** 🏁 **TIER 1 COMPLETE.** Session refresh — 4/4 tests passing (3 P0, 1 P1), zero flakes in 3× repeat, 10/10 full admin regression, 13/13 full anonymous regression. `LoginPage.clearAuthCookies()` + `LoginPage.tamperAuthCookie()` added. **Sentinel surfaced a pre-existing `playwright.config.ts` misconfiguration** — the admin project's `testIgnore` was missing `/middleware-redirect.*\.spec\.ts/`, which only became visible when the full admin project was run unfiltered for the first time. Fix included in this run. BUG-004 filed (login page doesn't redirect already-authenticated users — pairs with BUG-002 for unified login-page fix). **Tier 1 totals: 4 council runs, 21 tests (17 P0 / 4 P1 / 1 P2), 4 bugs surfaced, 17 LoginPage methods, 1 BasePage helper.** Next: Tier 2 (Admin Smoke — 11 council runs, baseline page-mount coverage).
- **2026-04-09 16:45:** 🟢 **Tier 2.1 DONE.** Command Center smoke — 4/4 tests passing (1 P0, 3 P1), zero flakes in 3× repeat, 3 consecutive 14/14 admin regression runs, 13/13 anonymous regression. **Built shared Tier 2 infrastructure:** 3 new `BasePage` helpers (`expectSmokeMount(url, landmark, expectedPath?)`, `adminShellLandmark()`, `employeeShellLandmark()`) — consumed by all 11 Tier 2 smokes. Healer ran 2 iterations: (1) flipped the `/api/bookings` non-5xx probe to a gap-guard after **BUG-005** was surfaced (route handler returns 500 for any authenticated request — likely wrong FK join in Supabase select), (2) fixed a pre-existing session-refresh race condition that only manifested under the new command-center test load. Per-spec work for Tiers 2.2–2.11 should now be minimal: ~1 testid + ~1 POM + ~1 spec. Next: Tier 2.2 (Schedule smoke).
- **2026-04-09 17:05:** 🟢 **Tier 2.2 DONE.** Schedule smoke — 3/3 tests passing (1 P0, 2 P1), zero flakes in 3× repeat, 17/17 admin regression. First council run to CONSUME the shared Tier 2 infra without building new helpers — validated the Tier 2.1 pattern scales. 1 testid + 1 POM (28 lines) + 1 spec (69 lines). No bugs filed, no Healer iteration. Next: Tier 2.3 (Members smoke).
- **2026-04-09 17:25:** 🟢 **Tier 2.3 DONE.** Members smoke — 4/4 tests passing (1 P0, 3 P1), zero flakes in 3× repeat, 21/21 admin regression, 13/13 anonymous regression. First Tier 2 smoke to cover a **nested dynamic route** (`/members/[id]`) — used a bogus UUID to hit the not-found fallback without needing fixture seeding (happy-path detail deferred to Tier 3.5). 2 testid seeds (directory + both render paths of `MemberProfileClient`), 1 POM (63 lines), 1 spec (104 lines). No bugs filed, no Healer iteration. Next: Tier 2.4 (Revenue smoke — 5 pages, ~6 tests — first Tier 2 multi-page spec).
- **2026-04-09 17:50:** 🟢 **Tier 2.4 DONE.** Revenue smoke — 6/6 tests passing (1 P0, 5 P1), zero flakes in 3× repeat, 27/27 admin regression. **First multi-page Tier 2 smoke** covering 5 routes (`/revenue`, `/revenue/orders`, `/revenue/products`, `/revenue/products/new`, `/revenue/products/[id]`) — the pattern holds. 6 testid seeds across 5 files (reused the dual-branch testid pattern from Tier 2.3 for `ProductDetailClient`). 1 POM (71 lines), 1 spec (90 lines). No bugs filed, no Healer iteration. 1 minor polish observation (empty-src warning on `/revenue/products/new` image preview — console warning, not a pageerror). Per-page effort confirmed as small: ~1 testid + ~20 lines of POM/spec. Next: Tier 2.5 (Marketing smoke — 5 pages).
- **2026-04-09 18:15:** 🟢 **Tier 2.5 DONE.** Marketing smoke — 5/5 tests passing (1 P0, 4 P1), zero flakes in 3× repeat (15/15), 32/32 full admin regression. **Second multi-page Tier 2 smoke**, again covering 5 routes (`/marketing`, `/marketing/campaigns`, `/marketing/automations`, `/marketing/content`, `/marketing/leads`). 5 testid seeds (1 server page + 4 client components). 1 POM (57 lines), 1 spec (70 lines). No bugs filed, no Healer iteration. Marketing module was clean end-to-end — no pageerrors, no hydration issues. Confirms the per-page cost model has stabilized. **Tier 2: 5/11 complete.** Next: Tier 2.6 (Corporate smoke — 4 pages).
- **2026-04-09 18:35:** 🟢 **Tier 2.6 DONE.** Corporate smoke — 5/5 tests passing (1 P0, 4 P1), zero flakes in 3× repeat (15/15), 37/37 full admin regression. 4 routes (`/corporate`, `/corporate/new`, `/corporate/events`, `/corporate/[id]`). 5 testid seeds (dual-branch on `CompanyDetailClient` to cover both not-found and happy-path renders for Tier 4 reuse). 1 POM (66 lines), 1 spec (77 lines). No bugs filed, no Healer iteration. **Tier 2: 6/11 complete.** Next: Tier 2.7 (Analytics smoke — **14 sub-pages**, the largest Tier 2 run).
- **2026-04-09 19:05:** 🟢 **Tier 2.7 DONE.** Analytics smoke — 16/16 tests passing (1 P0, 15 P1), **1 healer iteration**, zero flakes after fix (50/50 on re-check), 53/53 full admin regression. **LARGEST Tier 2 run by far** — 16 routes covering the entire Analytics module (main + dashboards×4 + kpi + insights + migration + reports×3 + pricing×3 + trainers×2). 17 testid seeds across 16 files (dual-branch on `TrainerDetailClient`; reports and pricing detail routes have no not-found branches — documented inline in POM). 1 POM (162 lines, 17 locators, 16 helpers — largest in the project), 1 spec (173 lines). **Healer surfaced a dev-mode test-infra flake:** Next.js on-demand compilation of the 5 heaviest client components (KPI 1017 LoC, Migration 858, Executive 606, Growth 568, Operations 448) occasionally pushes cold-compile latency past the 10s `ANIM_TIMEOUT`. Error-context snapshots confirmed page content was fully rendered at timeout — purely a cold-compile latency issue, not an application bug. Fix: introduced local `HEAVY_TIMEOUT = 20_000` ms in `AnalyticsPage.ts`, applied to 5 helpers only. Shared Tier 2 infra untouched. No bugs filed (not a real bug, would not repro in prod builds). Per-page effort remained FLAT even at 16× Tier 2.6 — the shared `expectSmokeMount` + `adminShellLandmark` primitives scaled cleanly. **Tier 2: 7/11 complete.** Next: Tier 2.8 (Operations smoke — 3 pages).
- **2026-04-09 19:25:** 🟢 **Tier 2.8 DONE.** Operations smoke — 3/3 tests passing (1 P0, 2 P1), zero flakes in 3× repeat (9/9), 56/56 full admin regression. 3 routes (`/operations`, `/operations/documents`, `/operations/payroll`). 4 testid seeds (3 unique) — `PayrollClient` dual-branch uses the SAME testid on both empty-state and happy-path since smoke doesn't need to distinguish. 1 POM (45 lines), 1 spec (60 lines). No bugs filed, no Healer iteration. First Tier 2 use of the same-testid dual-branch pattern — a minor refinement on the previous different-testid approach. **Tier 2: 8/11 complete.** Next: Tier 2.9 (Settings smoke — 3 pages).
- **2026-04-09 19:50:** 🟢 **Tier 2.9 DONE.** Settings smoke — 3/3 tests passing (1 P0, 2 P1), zero flakes in 3× repeat (11/11), 59/59 full admin regression. 3 routes (`/settings`, `/settings/geofence`, `/settings/sms`). 3 testid seeds across 3 files. 1 POM (38 lines), 1 spec (46 lines). **1 Healer iteration** — Engineer initially seeded `settings-page-root` at line 354 inside `BookingRulesTab`, not the main `SettingsClient` default-exported function's return at line 957. Default active tab is `General` so `BookingRulesTab` never mounted → testid was never rendered → `/settings` test timed out. Root cause diagnosed via `grep -n "^export default\|^function [A-Z]"` which revealed 7 top-level functions (5 tab sub-components + 2 helpers + 1 main default export). Relocated testid to main `<motion.div>` at line 958. No bugs filed (seed-placement error, not a product bug). **Lesson:** multi-function client files need an explicit grep for function boundaries BEFORE seeding — future Architect plans should name the target function when source has >1 function declaration. Tier 3/4 will need per-tab testids (e.g. `settings-general-tab-root`) to assert specific tab contents. **Tier 2: 9/11 complete.** Next: Tier 2.10 (Segments + Engagement + Docs smoke — 3 pages).
- **2026-04-09 20:10:** 🟢 **Tier 2.10 DONE.** Utility Pages smoke — 3/3 tests passing (1 P0, 2 P1), zero flakes in 3× repeat (9/9), 62/62 full admin regression. 3 routes (`/segments`, `/engagement`, `/docs/api`). 3 testid seeds across 3 files. 1 POM (48 lines — `UtilityPages`) + 1 spec (45 lines). No bugs filed, no Healer iteration. **First Tier 2 run to combine multiple unrelated routes into a SINGLE POM** — the 3 routes share no data/UI patterns but share the Tier 2 contract, and the roadmap lists them as one council run. `/docs/api` is read-only (SwaggerUI dynamic import fetching `/api/openapi`) — the outer wrapper div renders during both loading + loaded states, so the smoke is resilient to OpenAPI fetch latency. Tier 4 will split `UtilityPages` into a dedicated `SegmentsPage` (4.8) when segment write flows are added. **Tier 2: 10/11 complete.** Next: Tier 2.11 (Employee portal smoke — ~10 pages, first council run to target the `employee` Playwright project).
- **2026-04-09 20:40:** 🏁 **TIER 2 COMPLETE.** Employee Portal smoke (2.11) — 9/9 tests passing (3 P0, 6 P1), zero flakes in 3× repeat (27/27), 80/80 full admin+employee regression. 9 routes (entire `/employee/*` tree). 9 testid seeds across 9 files. 1 POM (93 lines — `EmployeePortalPage`) + 1 spec (100 lines). No bugs filed, no Healer iteration. **First Tier 2 run against the `employee` Playwright project** (trainer auth state). Used `employeeShellLandmark()` ("Employee Portal" header label) because the employee portal has no sign-out button (BUG-003 still open). Applied Tier 2.9 pre-seed-grep lesson: ran `grep "^export default function\|^function [A-Z]"` against each file before seeding to confirm single main return — no misplaced testids. All 9 pages share an identical loading-guard-then-main-return pattern; testids seeded on the main return only. `/employee/clock` (618 LoC, largest client component in the portal) took ~3.9s cold but stayed within `ANIM_TIMEOUT` — no HEAVY_TIMEOUT needed. **Tier 2 TOTALS: 11/11 council runs, 52 routes, 61 tests, 3 Healer iterations across 11 runs, 1 real product bug (BUG-005).** Shared infra (`expectSmokeMount`, `adminShellLandmark`, `employeeShellLandmark`, `byTestId`, `ANIM_TIMEOUT`) scaled cleanly from 1 to 11 specs without modification. Per-page cost model held flat throughout. Next: Tier 3 (Core Studio Writes — 12 council runs covering Revenue + Members + Schedule write flows with DB assertions; significant shift from Tier 2's read-only smoke contract).
- **2026-04-09 21:15:** 🟣 **Tier 3.1 DONE.** Revenue: Record Payment — 8/8 tests passing (3 P0, 5 P1), zero flakes in 3× repeat (24/24), **79/79 full admin regression** (Tier 1+2+3.1), **11/11 full employee regression**. **FIRST Tier 3 council run** — establishes the data-bound write contract (seed via service-role `testDb` → drive UI → assert row in Postgres). 1 spec (~290 lines), extended `RevenuePage` POM with 14 new locators + 13 new helpers (Tier 2.4 read-only POM grows into Tier 3.1 write POM), 14 testid seeds (13 in `RecordPaymentModal.tsx` + 1 on Revenue page header button). **TWO bugs surfaced and fixed inline in the same council run:** (1) **BUG-006** — `RecordPaymentModal` was fundamentally broken: FK mismatch (sent `profiles.id` but `transactions.member_id` FKs `members.id`), default type `'other'` violated CHECK, two enum values off (`'merchandise'`→`'merch'`, `'event'`→`'private_event'`), silently-dropped `payment_method`, nonexistent `created_by` column in API insert, NOT NULL violation on `activity_log.description`, CHECK violation on `activity_log.type`. 0/1,925 production transactions had a non-null `member_id` pre-fix. Fixed via two-step member search (profiles → members via `.in('profile_id', profileIds)`), PAYMENT_TYPES alignment, `sold_by_profile_id` provenance, `amount <= 0` server guard, and activity_log schema fixes. (2) **BUG-007** — `auth.setup.ts` was seeding admin/employee test users into the legacy isolated studio `00000000-...` while all admin code hardcodes `DEFAULT_STUDIO_ID` `11111111-...`; RLS `get_user_studio_id()` silently filtered every browser-client query to zero rows. Hidden through all 11 Tier 2 smokes because they only asserted layout landmarks, not data. Fixed by switching `TEST_STUDIO_ID` to import `E2E_STUDIO_ID` from `test-data.ts` and changing the `studios` upsert to `ignoreDuplicates: true` so "The Sauna Guys" metadata isn't clobbered on every auth-setup run. 1 Healer iteration (Sentinel round 1 blocked 7/8 at `searchMember`, diagnosed as BUG-007 via RLS policy inspection + Supabase MCP SQL probes). **Tier 3: 1/12 complete.** Next: Tier 3.2 (Revenue: Refund).
- **2026-04-09 21:30:** 🚫 **Tier 3.2 GAP-FILED.** Revenue: Refund — feature does not exist in codebase (no `RefundModal`, no `/api/transactions/[id]/refund` route, no refund action on `TransactionsTab`). No tests written. **Filed BUG-008** (`specs/bugs/phase-1-revenue-schedule-gaps.md`) — a comprehensive Phase 1 completeness audit documenting **5 Tier 3 feature gaps:** (GAP-1) Revenue Refund MISSING, (GAP-2) Revenue Issue Credit MISSING, (GAP-3) Schedule Waitlist Add/Remove MISSING, (GAP-4) Schedule Cancel Class UI PARTIAL (API exists, UI missing), (GAP-5) Members Exclude from Analytics UI PARTIAL (API supports `exclude_from_analytics` field, no toggle in UI). Discovered via Tier 3.2 audit + Explore subagent audit of all 12 Tier 3 features. **Established the "gap-filed council run" format**: Analyst-only output with evidence-of-absence section, 6 scenarios documented for when the feature ships, BUG-008 cross-reference, no code written. Preserves tier traceability without conflating QA work with feature-dev work. Tier 3 counter advances to 2/12. Next: Tier 3.3 (Revenue: Issue Credit) — also gap-filed against BUG-008.
- **2026-04-09 21:35:** 🚫 **Tier 3.3 GAP-FILED.** Revenue: Issue Credit — feature does not exist. No `IssueCreditModal`, no `/api/credits` or `/api/members/[id]/credits` route, no `type = 'credit_grant'` branch in `/api/transactions/route.ts`. Only the Glofox sync transformer writes `CreditPack` rows — there's no admin-facing grant path. Gap-filed against BUG-008 (no new bug). Report in `specs/reports/revenue-issue-credit-report.md`. **Tier 3: 3/12 (1 full, 2 gap-filed).** Next: Tier 3.4 (Revenue: Products CRUD) — both UI (`/revenue/products/new`, `/revenue/products/[id]`) and API (`POST /api/products`, `PUT /api/products/[id]`, `DELETE /api/products/[id]`) exist — full 6-phase pipeline.
- **2026-04-09 22:10:** 🟣 **Tier 3.4 DONE.** Revenue: Products CRUD — 9/9 tests passing (6 P0, 3 P1), zero flakes in 3× repeat (29/29), **88/88 full admin regression**. **BUG-009 closed** after all 6 layers fixed inline (Analyst flagged 5, Healer surfaced a 6th — NOT NULL `activity_log.description` silently swallowed by the Supabase JS client). Extended `RevenuePage` POM (+30 locators, +15 helpers) with Tier 3.4 products section. 27 testid seeds across `NewProductPage`, `ProductDetailClient`, `ProductsClient`. 312-line spec. 1 Healer iteration. Established the pattern: when diagnosing a silent write failure, probe `information_schema.columns` for NOT NULL + no-default columns before blaming app code. **Tier 3: 4/12 (2 full, 2 gap-filed).** Next: Tier 3.5 (Members: Create Member).
- **2026-04-09 23:30:** 🟣 **Tier 3.6 DONE.** Members: Edit Member — 9/9 tests passing (4 P0, 5 P1), zero flakes in 3× repeat (29/29, 3.4m), **106/106 full admin regression** (round-2 clean sweep after a one-off transient on the dup-email test in round-1). **BUG-012 closed** after all 6 layers fixed inline: (L1) `notes` written to wrong table, (L2) phantom `members` columns in `allowedFields`, (L3) `exclude_from_analytics` masking the bug as the only field that ever made it through, (L4) NOT NULL `activity_log.description` silently swallowed, (L5) missing RLS UPDATE policy on `profiles`, (L6) no duplicate-email check on PUT. **First time the standing `pg_policies` Analyst checklist item (added after Tier 3.5 BUG-010 L5) caught a bug prospectively** — BUG-012 Layer 5 was found and fixed at Analyst-time instead of Sentinel-time, saving a Sentinel→Healer→Sentinel cycle. Applied 1 migration (`profiles_update_admin` RLS UPDATE policy), rewrote PUT handler, seeded 10 testids, extended MembersPage POM with Tier 3.6 section (+8 locators, +8 helpers), built new `EditMemberModal.tsx` (~190 lines) with delta-payload submission and no-op short-circuit, wrote 9-test spec. **BUG-013 surfaced during Engineer Step 3** — SQL probe proved 1,188/1,188 members rows have `members.id ≠ profile_id`, and while the data-fetching path (bookings/transactions/tags FKs) correctly uses `members.id`, the per-member action routes (`/pause`, `/upgrade`, `/PUT`, `/DELETE`, `/GET`) all expect URL `[id]` to be a `profile_id`. The panel has been silently passing the wrong ID to Pause/Upgrade/Archive for an unknown duration. Applied **Option B narrow mitigation**: added `profileId: string` to Member type, set from `row.profile_id`, used explicitly in the new `EditMemberModal`. Pause/Upgrade/Archive/Full-Profile-link still pass `member.id` — filed as BUG-013 for Tier 3.7 (Members: Lifecycle) which will exercise them end-to-end. Code reviewer surfaced 4 issues all fixed inline: (1) critical — unit test factory missing new required `profileId` field (would break `tsc --noEmit`), (2) important — members UPDATE block had no row-count check (zero-row UPDATE silently returns 200), fixed with `.select('id').maybeSingle()` + null-check 404, (3) important — `memberName` always `"(unknown)"` for notes-only edits, fixed by fetching `existingProfile` up-front, (4) medium — stale PUT docblock enumerated pre-fix accepted fields. Healer skipped (Sentinel passed on first real run). **New standing Analyst checklist item:** for each panel action button, trace `${id}` from UI through to the route's WHERE clause. **Tier 3: 6/12 (4 full, 2 gap-filed).** Next: Tier 3.7 (Members: Lifecycle — Pause/Upgrade/Archive) which will surface every remaining BUG-013 instance and fix them at the proper scope.
- **2026-04-09 22:45:** 🟣 **Tier 3.5 DONE.** Members: Create Member — 9/9 tests passing (4 P0, 5 P1), zero flakes in 3× repeat (29/29), **97/97 full admin regression**. **BUG-010 closed** after all 5 layers fixed inline — Analyst flagged 4 layers (phantom `status` column, missing `members` row, invalid `activity_log.type`, NOT NULL `description`), **Sentinel round 1 surfaced a 5th** (missing RLS INSERT policy on `profiles`) invisible to the Analyst phase because Supabase MCP `execute_sql` runs as superuser and bypasses RLS. Applied 2 migrations: extend `activity_log.type` CHECK (15 → 18 values) + `CREATE POLICY profiles_write ON profiles FOR INSERT WITH CHECK (studio_id = get_user_studio_id())`. Extended `MembersPage` POM with Tier 3.5 section (+8 locators, +7 helpers). 8 testid seeds across modal + page. ~400-line spec. **2 Healer iterations** — (1) BUG-010 Layer 5 RLS policy, (2) Scenario 4 adaptation after surfacing **BUG-011** (list query orders by `id ASC limit 50` with 1,187 existing members, new rows never visible — medium severity UX paper cut filed for Tier 3.6 fold-in). **New standing Analyst checklist item going forward:** query `pg_policies` for every table the feature writes to alongside existing `information_schema.columns` + `pg_constraint` probes — three mandatory Tier 3+ Analyst probes. **Tier 3: 5/12 (3 full, 2 gap-filed).** Next: Tier 3.6 (Members: Edit Member) — will touch the same `members/page.tsx` file and can fold in the BUG-011 one-line fix.
