# QA Report — Revenue: Issue Credit (Tier 3.3) — 🚫 GAP-FILED

**Pipeline ID:** `revenue-issue-credit`
**Tier:** 3.3 (Core Writes — 3 of 12)
**Project:** `admin`
**Run date:** 2026-04-09
**Status:** 🚫 GAP-FILED — feature does not exist; no tests written

---

## TL;DR

Issue Credit does not exist in the admin UI or the API surface. Zero tests written. Gap-filed against **BUG-008** (Phase 1 Revenue + Schedule write flows — 5 feature gaps).

## What would have been tested

| # | Scenario | Priority |
|---|---|---|
| 1 | Grants a $25 credit to a member from the member detail page, asserts wallet balance increments by $25, logs activity | P0 |
| 2 | Grants a 5-class credit pack to a member, asserts credit pack row exists with correct expiry (7-day grace policy per edge-case-policies.md) | P0 |
| 3 | Blocks negative credit grants — shows error, zero DB mutation | P1 |
| 4 | Cancelling the dialog writes nothing to the DB | P1 |
| 5 | Credit grants appear in the member's credit history view | P1 |

## Evidence of absence

- **UI:** No `IssueCreditModal`, `GrantCreditForm`, or credit-grant button anywhere in `apps/web/src/app/(admin)/revenue/` or `apps/web/src/app/(admin)/members/`. Grep for `IssueCredit|issue.*credit|Credit.*Modal|credit_grant|creditsTab` returns 0 matches.
- **API:** No `apps/web/src/app/api/credits/` directory. No `POST /api/members/[id]/credits` route. No `type = 'credit_grant'` branch in `/api/transactions/route.ts`.
- **Data model:** `CreditPack` read structure exists (membership detail surfaces balance) but the only write path is via Glofox sync (`src/lib/glofox/transformers.ts`). There is no admin-facing grant path.

## Files changed

**None.**

## Test runs

**None.**

## Bugs filed

- **BUG-008** (already filed during Tier 3.2) — this council run adds no new bug.

## Design notes

Same rationale as Tier 3.2: building the feature from scratch is out of QA scope. Per CLAUDE.md, The Sauna Guys use credit packs as a core revenue stream alongside memberships and drop-ins, and comped credits are an explicit use case (goodwill after missed class, dispute resolution, former-owner complimentary access). The gap is material — it just isn't QA council's to build.

## Agent trail

| Phase | Agent | Outcome |
|---|---|---|
| 1 — Analyst | inline | 🚫 Feature absent. 5 scenarios listed for when this ships. |
| 2–5 | — | Skipped. |
| 6 — Scribe | inline | ✅ This report (BUG-008 already filed in Tier 3.2). |

**Run time:** ~5 minutes.

**Next:** Tier 3.4 (Revenue: Products CRUD) — full pipeline. Products UI and API both exist (verified in Tier 3 audit).
