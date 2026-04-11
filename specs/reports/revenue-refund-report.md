# QA Report — Revenue: Refund (Tier 3.2) — 🚫 GAP-FILED

**Pipeline ID:** `revenue-refund`
**Tier:** 3.2 (Core Writes — 2 of 12)
**Project:** `admin`
**Run date:** 2026-04-09
**Status:** 🚫 GAP-FILED — feature does not exist in codebase; no tests written

---

## TL;DR

The refund feature does not exist in the admin UI or the `/api/transactions` route. Zero tests are written. Tier 3.2 is logged as a **gap-filed council run** against BUG-008 (Phase 1 Revenue + Schedule write flows — 5 feature gaps).

This is not a product bug in the "it's broken" sense. It is a scope gap: `CLAUDE.md` lists Revenue as a Phase 1 ✅ feature, but the refund write path never shipped. The QA pipeline's contract is to verify and gap-file — not to build missing features from scratch. Tier 3.2's council run ends in the Analyst phase with a gap report; no Architect, Engineer, Sentinel, Healer, or Scribe work happens beyond this document.

## What would have been tested

If the refund feature existed, Tier 3.2's Analyst phase would have designed ~6 scenarios:

| # | Scenario | Priority |
|---|---|---|
| 1 | Records a valid full refund against a completed transaction, asserts `transactions.status = 'refunded'`, inserts a reverse row (or sets `refunded_at`), logs activity | P0 |
| 2 | Records a partial refund (e.g., $50 of $100), asserts remaining balance is tracked correctly and a reversal row is created | P0 |
| 3 | Blocks refunding an already-refunded transaction — shows error, zero DB mutation | P0 |
| 4 | Blocks refunds > original amount — shows error, zero DB mutation | P1 |
| 5 | Refunds sync to the member's profile transaction history (line-through styling, status badge) | P1 |
| 6 | Cancelling the refund dialog writes nothing to the DB | P1 |

**None of these can be written** because the UI has no refund button and the API has no refund endpoint.

## Evidence of absence

**UI:** `apps/web/src/app/(admin)/revenue/_components/` contains only `OverviewTab.tsx`, `MembershipsTab.tsx`, `TransactionsTab.tsx`, `RecordPaymentModal.tsx`. No `RefundModal.tsx`. `TransactionsTab.tsx` does display refund status (line-through on refunded rows) but has no action button or per-row kebab menu.

**API:** `apps/web/src/app/api/transactions/` contains only `route.ts` with GET + POST handlers. There is no `[id]/refund/route.ts`, no `[id]/route.ts`, no PATCH handler on the root route.

**Grep audit:** `grep -rE "onRefund|handleRefund|refund.*button|button.*refund" src/` returns 0 matches. The only matches for "refund" or "Refund" are:
- Display-side status badges in `TransactionsTab.tsx`, `MemberProfileClient.tsx`, `MemberProfilePanel.tsx`
- A `typeDisplayName` mapping in `revenue/page.tsx` (`refund: 'Refund'` — maps a transaction type label, not an action)
- Test factory in `src/__tests__/integration/helpers/test-data-factory.ts` (creates `type: 'refund'` rows for integration tests, but the factory simulates what a refund *would* look like)
- Imports / transformers in `src/lib/glofox/transformers.ts` (maps Glofox refund records into the same shape the admin UI can't produce)

So the data model has a refund concept (a transaction with `type = 'refund'` and `status = 'refunded'`), and the read-side surfaces it. The write path is missing.

## Files changed

**None.** No code written, no testids seeded, no POM extended, no spec file created.

## Test runs

**None.** No tests to run.

## Bugs filed

- **BUG-008** (`specs/bugs/phase-1-revenue-schedule-gaps.md`) — Phase 1 completeness gap audit documenting all 5 Tier 3 feature gaps (Refund + Issue Credit + Waitlist + Cancel Class UI + Exclude from Analytics UI). Tier 3.2 is one of 5 affected council runs.

## Design notes

### Why this was gap-filed instead of built

Tier 3.1 (Record Payment) fixed BUG-006 inline — the Record Payment modal existed but was broken (FK mismatch, CHECK violations, dropped fields). That was legitimate QA pipeline scope: a broken existing feature.

Tier 3.2 (Refund) is different. The feature **does not exist**. Building it means:

- New `RefundModal` component (~200 LoC)
- New `POST /api/transactions/[id]/refund` route handler (~150 LoC)
- Schema decisions (full vs. partial, reverse row vs. status update, refund_amount column)
- Activity log plumbing
- Member credit side-effects
- Stripe refund API integration (if the original payment was Stripe-processed — Phase 2 concern for dunning)
- Updates to `TransactionsTab` to expose the refund action
- ~6 tests (~300 LoC)

That is **feature development work**, not QA verification work. The QA council's mandate is to verify what exists, find what's broken, and surface gaps. It is not to build Phase 2 features during a Phase 1 stabilization pass.

Filing BUG-008 and producing this gap report:
1. Unblocks the Tier 3 pipeline (the next testable run is 3.4 Products CRUD)
2. Preserves traceability (the tier ID 3.2 stays in the log and roadmap with a clear "gap-filed" status)
3. Hands the scope to feature-dev with a complete, ready-to-implement brief (see BUG-008 "Minimum to implement" for Refund)
4. Allows retroactive test coverage: when the refund feature ships, re-run `/qa-council` with the same 6 scenarios listed above

### Why not skip to the next feature entirely

The roadmap's 12 Tier 3 council runs are ordered for a reason — each run's file/POM artifacts feed the next. Skipping 3.2 without logging it would leave a hole in the pipeline log and produce a mismatch between the tier counter and the actual state. The gap-filed report is a first-class council run output: it takes ~5 minutes to produce, keeps the tier counter accurate, and preserves the "why did we not test this?" answer for future readers.

## Agent trail

| Phase | Agent | Outcome |
|---|---|---|
| 1 — Analyst | inline | 🚫 Feature absent. Documented 6 scenarios that would have been tested. No testid inventory possible. |
| 2 — Architect | — | Skipped — nothing to design on top of. |
| 3 — Engineer | — | Skipped. |
| 4 — Sentinel | — | Skipped. |
| 5 — Healer | — | Skipped. |
| 6 — Scribe | inline | ✅ This report + BUG-008 |

**Run time:** ~15 minutes (audit + BUG-008 filing + this report).

**Next:** Tier 3.3 (Revenue: Issue Credit) — also gap-filed against BUG-008. Then Tier 3.4 (Revenue: Products CRUD) — full pipeline.
