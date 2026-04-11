# QA Report — Revenue: Record Payment (Tier 3.1)

**Pipeline ID:** `revenue-record-payment`
**Tier:** 3.1 (Core Writes — 1 of 12) — **FIRST Tier 3 council run**
**Project:** `admin`
**Run date:** 2026-04-09
**Status:** ✅ COMPLETE — 8 tests, 24/24 flake check, 79/79 admin + 11/11 employee regression, 2 bugs fixed

---

## TL;DR

The first data-bound write spec in the Meridian QA pipeline. Previous tiers were
read-only smokes (Tier 2) or anonymous auth flows (Tier 1). Tier 3 shifts the
contract: seed a real member with `testDb` service-role, drive the UI through a
full write path, then assert the row exists in Postgres with the correct shape.

Two bugs surfaced and were fixed in the same council run:

1. **BUG-006** — the `RecordPaymentModal` was completely non-functional.
   FK mismatch (`profiles.id` → `members.id`), CHECK-constraint violations on
   default and two enum values, dropped `payment_method`, a nonexistent
   `created_by` column in the API insert, a NOT NULL violation on
   `activity_log.description`, and a CHECK violation on `activity_log.type`.
   Pre-fix, 0 out of 1,925 production transactions had a non-null `member_id`
   — every manual payment attempt had silently failed since the modal shipped.
2. **BUG-007** — the Playwright auth test users (`meridian-e2e-admin@`,
   `meridian-e2e-employee@`) were seeded into the legacy isolated studio
   `00000000-0000-4000-a000-000000000000`, while all admin UI code hardcodes
   `DEFAULT_STUDIO_ID` (`11111111-...`). RLS on `profiles`/`members`/etc. uses
   `get_user_studio_id()`, which returned the legacy id for the test admin.
   Every browser-client query from the modal silently returned empty rows,
   breaking the entire member search.

Both bugs are now filed and fixed. 8 Playwright tests verify the happy path
and validation contract end-to-end, with DB assertions on every pass.

## What was tested

| # | Scenario | Priority | Result |
|---|---|---|---|
| 1 | Records a valid drop-in payment ($12.50, cash) and writes `amount=1250, type=drop_in, status=completed, payment_method=cash` to `transactions` | P0 | ✅ PASS (6.4s) |
| 2 | Blocks submission when no member is selected — shows `/select a member/i` error, zero DB rows | P0 | ✅ PASS (3.8s) |
| 3 | Blocks submission when amount is empty — shows `/valid amount/i` error, zero DB rows | P0 | ✅ PASS (4.7s) |
| 4 | Blocks submission when amount is zero — shows `/valid amount/i` error, zero DB rows | P1 | ✅ PASS (4.8s) |
| 5 | Records a $199.00 membership payment via `bank_transfer` — `amount=19900, type=membership, payment_method=bank_transfer` | P1 | ✅ PASS (6.5s) |
| 6 | Records a payment without a description (optional field) — row exists, description tolerates server default `"Manual ... payment"` | P1 | ✅ PASS (6.6s) |
| 7 | Lets the user "Change" the selected member after picking — seeds a second member, verifies the transaction lands on the second member's `member_id` | P1 | ✅ PASS (8.3s) |
| 8 | Cancelling the dialog writes nothing to the DB — fills every field then clicks Cancel, asserts zero rows | P1 | ✅ PASS (5.1s) |

**Coverage:** 100% P0 (3/3) + 100% P1 (5/5) = **8/8 tests passing**.

## Files changed

### Created
- `apps/web/e2e/revenue-record-payment.spec.ts` — 8 tests, ~290 lines. First spec to drive `testDb` reads post-submit.
- `specs/bugs/revenue-record-payment-modal-broken.md` (BUG-006) — root cause write-up with SQL probe evidence and fix plan
- `specs/bugs/auth-test-users-wrong-studio.md` (BUG-007) — test-harness bug that blocked every write spec until fixed
- `specs/reports/revenue-record-payment-report.md` — this report

### Modified
- `apps/web/src/app/(admin)/revenue/_components/RecordPaymentModal.tsx` — two-step member search rewrite (was a broken single-query embedded filter), `PAYMENT_TYPES` enum fixes (`merchandise`→`merch`, `event`→`private_event`, removed `'other'`), default type `'other'`→`'drop_in'`, and 13 `data-testid` seeds on interactive elements
- `apps/web/src/app/api/transactions/route.ts` — GET select now joins `members!transactions_member_id_fkey` (not `profiles`), POST destructures and persists `payment_method`, POST validates `member_id` against `members` table (not `profiles`), POST uses `sold_by_profile_id` for provenance (no `created_by` column exists), POST adds `amount <= 0` 400 guard, activity_log insert now includes NOT-NULL `description` and uses canonical `type: 'payment'` (was `'transaction_created'` which violated the CHECK)
- `apps/web/src/app/(admin)/revenue/page.tsx` — `data-testid="revenue-record-payment-btn"` on the header button trigger
- `apps/web/e2e/pages/RevenuePage.ts` — extended the Tier 2.4 POM with Tier 3.1 helpers: 14 new locators (`recordPaymentBtn`, `paymentDialog`, `memberSearchInput`, etc.) and 13 new helpers (`gotoRevenue`, `openRecordPaymentModal`, `searchMember`, `selectMemberResult`, `changeSelectedMember`, `fillAmount`, `selectType`, `selectPaymentMethod`, `fillDescription`, `submitPayment`, `cancelPayment`, `expectValidationError`, `expectDialogClosed`). Preserves the Tier 2 smoke helpers untouched.
- `apps/web/e2e/auth.setup.ts` — BUG-007 fix: import `E2E_STUDIO_ID` from `./fixtures/test-data` and use it as the `TEST_STUDIO_ID` constant (was a hardcoded legacy UUID); change `studios` upsert to `ignoreDuplicates: true` so auth-setup never clobbers the real "The Sauna Guys" studio metadata on re-runs

## Test runs

### Primary (isolated)
```
Running 10 tests using 1 worker  (2 auth-setup + 8 record-payment)
  10 passed (1.0m)
```

### Flake check — `--repeat-each=3`
```
Running 26 tests using 1 worker  (2 auth-setup + 8 × 3 repeats = 24)
  26 passed (2.8m)
```
**Flake count: 0/24.**

### Full admin regression
```
Running 79 tests using 1 worker
  79 passed (2.6m)
```
All Tier 1 (auth), Tier 2 (11 smokes), and Tier 3.1 runs pass together. No regression from the BUG-007 fix (which touched `auth.setup.ts` — the ancestor of every admin test).

### Full employee regression
```
Running 11 tests using 1 worker
  11 passed (25.3s)
```
Employee project unaffected. The employee test user's studio_id was also migrated by the same auth-setup change, and the Tier 2.11 employee smoke continues to pass under the new studio.

## Bugs found

### BUG-006 — Record Payment modal cannot create a transaction
**Severity:** High (write-flow blocker, every attempt fails)
**Status:** Fixed in this council run
**Filed:** `specs/bugs/revenue-record-payment-modal-broken.md`

Compounding schema/validation mismatches chained into a complete failure of the
manual-payment recording UI. Discovered via Supabase MCP SQL probes; verified
against production (0/1925 transactions have a non-null `member_id`).

### BUG-007 — Auth test users in wrong studio
**Severity:** High (silent RLS blockade for every write spec — not a product bug, a test-harness bug)
**Status:** Fixed in this council run
**Filed:** `specs/bugs/auth-test-users-wrong-studio.md`

The admin and employee Playwright auth users were seeded into
`00000000-0000-4000-a000-000000000000` (the legacy isolated studio), but all
admin code hardcodes `DEFAULT_STUDIO_ID`. RLS `get_user_studio_id()` filtered
every authenticated browser-client query down to zero rows. Stayed hidden
through all 11 Tier 2 smokes because they never queried data.

## Design notes

### Why Tier 3.1 ships with a test-harness fix in the same run

BUG-007 was a foundational blocker — it would have surfaced in 3.2, 3.3, 3.4,
and every subsequent data-bound test. Fixing it inside the 3.1 council run
(rather than filing it and skipping the tier) keeps the pipeline moving and
prevents 10+ council runs from having to be restarted later. The fix is
minimal: two edits in `auth.setup.ts`, both documented with cross-references
to BUG-001 and BUG-007.

### Two-step member search

An earlier version of the modal used Supabase's embedded resource filter:
```ts
.from('members')
.select('id, profiles:profile_id!inner(full_name, email)')
.or(..., { referencedTable: 'profiles' })
```
In practice this returned an empty set. Replacing it with an explicit two-step
query (profiles match → members lookup via `.in('profile_id', profileIds)`) is
both simpler and more resilient to PostgREST serialization quirks. Two round
trips for an 8-row typeahead is acceptable.

### `RevenuePage.ts` — extended, not duplicated

The Tier 2.4 `RevenuePage` POM already existed for the Revenue smoke. Tier 3.1
extends the same file rather than creating a new one, keeping all Revenue
locators/helpers in one place. The contract split is documented with section
headers (`// ─── Page root locators (Tier 2.4 smoke) ───` vs `// ─── Record
Payment modal locators (Tier 3.1) ───`). Future Revenue tiers (3.2 Refund, 3.3
Issue Credit, 3.4 Products) will continue extending the same POM.

### Shared `transactions` inventory

The original seed helper `deleteMember(memberId, profileId)` already cascades
`transactions.member_id = memberId` deletion, and `resetStudioTestData`
additionally scopes transaction cleanup by `E2E Test ...` description prefix.
This council run's `beforeEach`/`afterAll` do not need any new cleanup code.

## Follow-up work

- **BUG-001** remains open — the `DEFAULT_STUDIO_ID` hardcoding in 43 admin
  pages is the true root cause behind BUG-007. Tier 3+ proceeds with the
  current workaround (test admin in `DEFAULT_STUDIO_ID`). When BUG-001 ships
  a real `StudioContext`, revisit BUG-007 and move the test users back into
  an isolated studio.
- **BUG-005** (command-center activity API 500) — from Tier 2.1, still open.
- Polish: the `amount <= 0` server-side guard now matches the client-side
  guard. When a future tier adds a pricing simulator or bulk import flow, the
  same guard pattern applies.
- Document the two-step search pattern in `AGENTS.md` alongside the `!inner` +
  `referencedTable` caveat so future modals don't fall into the same trap.

## Agent trail

| Phase | Agent | Outcome |
|---|---|---|
| 1 — Analyst | inline | ✅ 8 scenarios designed (3 P0, 5 P1) — 1 happy path + 3 validation + 4 behavior variants |
| 2 — Architect | inline | ✅ Plan: extend RevenuePage POM (14 locators + 13 helpers), seed 13 testids in modal + 1 in revenue/page.tsx, write spec with `testDb` assertions, fix BUG-006 in modal + API route |
| 3 — Engineer | inline | ✅ Modal + API fixes applied; 13 testids seeded; POM extended (~135 new lines); spec written (~290 lines); TypeScript clean |
| 4 — Sentinel (round 1) | inline | 🚫 BLOCKED — 7/8 tests failing: `searchMember` helper never found `revenue-payment-form-member-results`. Triaged via Supabase MCP: the modal's browser-client query returned empty rows. Root cause: BUG-007 (test admin in wrong studio, not a PostgREST bug as first suspected). |
| 5 — Healer | inline | ✅ 1 iteration. Fixed `auth.setup.ts` to use `E2E_STUDIO_ID`. Primary run after fix: 8/8. |
| 4' — Sentinel (round 2) | inline | ✅ PASS — 8/8 primary, 24/24 flake check, 79/79 admin regression, 11/11 employee regression |
| 6 — Scribe | inline | ✅ This report + BUG-006 update + BUG-007 spec |

**Run time:** single session. Playwright time: ~1.0m primary + ~2.8m flake + ~2.6m admin + ~25s employee = ~6.8m across all verification runs.
