---
id: BUG-008
title: Phase 1 Revenue + Schedule write flows — 5 feature gaps (claimed "complete" but missing)
status: Open
severity: Medium (multiple features missing; no single user-blocking crash; all 5 are scope gaps)
discovered_by: QA pipeline Tier 3 audit (2026-04-09)
related:
  - CLAUDE.md "Phase 1 (Core Platform) ✅ COMPLETE" claim
  - specs/qa-pipeline-roadmap.md Tier 3.2, 3.3, 3.7, 3.9, 3.11
  - BUG-006 (BUG-006 fixed the Record Payment modal; these are 5 additional write-flow gaps surfaced by the same Tier 3 audit)
---

# BUG-008 — Phase 1 Revenue + Schedule write flows have 5 feature gaps

## Summary

`CLAUDE.md` and the project roadmap both claim:

> **Phase 1 (Core Platform) ✅ COMPLETE:** Command Center, Schedule & Booking, Members, Revenue, Settings, Waitlists, Employee Portal (clock in/out), Smart Segments, Resend Email (with tracking), QR Check-in, 10 AI Features (Claude Sonnet 4.6)

But a Tier 3 audit of the admin write-flow surface (in preparation for council runs 3.2 through 3.11) found that **5 write features listed in the Tier 3 roadmap do not exist in the codebase** — 3 are completely missing (no UI, no API) and 2 are API-only (UI does not expose the write path).

This bug does not block any currently-shipping functionality — it documents the delta between the "Phase 1 complete" claim and what is actually implemented, so that (a) the QA pipeline can file gap-filed council runs for each missing feature instead of halting, and (b) Phase 2 planning can pick these up as explicit work items rather than "assumed done."

## Discovered during

Tier 3.1 (Revenue: Record Payment) council run surfaced BUG-006 (Record Payment modal was broken end-to-end). The Tier 3.1 Scribe phase then kicked off Tier 3.2 (Revenue: Refund), which immediately revealed that the refund feature doesn't exist. Rather than file 5 separate bugs across 5 council runs, this single audit consolidates all 5 gaps.

**Audit method:** Grep + file-tree inspection of `apps/web/src/app/(admin)` and `apps/web/src/app/api` for each Tier 3 write flow. Verified by the `Explore` subagent at 2026-04-09 21:30. No runtime probing of the UI was required — the absence is observable from the source tree alone.

## Gap inventory

### GAP-1 — Revenue Refund (Tier 3.2)
**Status:** MISSING (UI + API both absent)
**Feature described in roadmap:** A way for an admin to refund an existing transaction — either full or partial — from the Revenue module. Should update `transactions.status` to `refunded`, insert a reverse accounting row, and surface in analytics.

**Evidence of absence:**
- `apps/web/src/app/(admin)/revenue/_components/` contains `OverviewTab.tsx`, `MembershipsTab.tsx`, `TransactionsTab.tsx`, `RecordPaymentModal.tsx`. **No** `RefundModal.tsx`, no refund button on the transactions table (grep for "refund"/"Refund" in `TransactionsTab.tsx` finds only display-side styling: `tx.status === 'Refunded' ? '…line-through'`).
- `apps/web/src/app/api/transactions/` contains only `route.ts` (GET + POST for manual payments). **No** `[id]/refund/route.ts`, no `[id]/route.ts`.
- `apps/web/src/app/(admin)/members/[id]/_components/MemberProfileClient.tsx` displays refund status for already-refunded rows but has no refund action.

**Minimum to implement:**
- `PATCH /api/transactions/[id]` or `POST /api/transactions/[id]/refund` — set `status = 'refunded'`, optionally insert a reverse `transactions` row for partial refunds, log to `activity_log` with type `refund`.
- A `RefundModal` component wired up from the transactions table (new per-row "Refund" button or kebab menu).
- Testid seeds: `revenue-refund-btn` on the transactions row action, `revenue-refund-form-*` for the modal.

### GAP-2 — Revenue Issue Credit (Tier 3.3)
**Status:** MISSING (UI + API both absent)
**Feature described in roadmap:** A way to grant a member a credit (wallet balance, class credits, etc.) without processing a real payment — e.g., for goodwill after a cancelled class or as a dispute resolution. Should increment `member_credits` or `wallet_balance` and show up in the member's credit history.

**Evidence of absence:**
- No `IssueCreditModal` component anywhere in `apps/web/src/app/(admin)/revenue/_components/` or `apps/web/src/app/(admin)/members/`.
- No API route: `apps/web/src/app/api/credits/` does not exist. `apps/web/src/app/api/transactions/route.ts` doesn't handle a `type: 'credit_grant'` branch.
- The `CreditPack` read structure exists (membership detail pages display credit pack balances) but there's no write path for manual credit issuance.

**Minimum to implement:**
- A dedicated `credit_grants` table (or use `transactions` with `type = 'credit_pack'` and `payment_method = 'comp'`).
- `POST /api/credits` or `POST /api/members/[id]/credits` to grant credits to a member.
- An `IssueCreditModal` triggered from the member detail page or the revenue page.

### GAP-3 — Schedule Waitlist Add/Remove (Tier 3.11)
**Status:** MISSING (UI + API both absent, although `bookings.status` supports a `'waitlisted'` value)
**Feature described in roadmap:** When a class is full, members (or admins on their behalf) should be able to join the waitlist. When a booked seat opens up, the next waitlisted member should be auto-promoted (or the admin should be able to manually promote them).

**Evidence of absence:**
- `apps/web/src/app/(admin)/schedule/page.tsx` line 439 shows a `'waitlisted'` status label in display logic, but the UI does not surface a way to add/remove waitlist entries.
- `apps/web/src/app/api/waitlist/` does not exist. No `[id]/waitlist/route.ts` under `/api/classes`.
- `bookings.status` may accept `'waitlisted'` as a value (schema inspection required), but there is no route handler that sets it, clears it, or promotes a waitlist entry into an active booking.

**Minimum to implement:**
- `POST /api/classes/[id]/waitlist` (add member to waitlist)
- `DELETE /api/classes/[id]/waitlist/[memberId]` (remove member from waitlist)
- `POST /api/classes/[id]/waitlist/[memberId]/promote` (convert to booking when capacity opens)
- A waitlist section on the class detail view / booking page with add/remove controls.
- Auto-promotion hook on booking cancellation (trigger or Next.js route post-cancel).

### GAP-4 — Schedule Cancel Class, UI missing (Tier 3.9)
**Status:** PARTIAL — API exists, UI missing
**Feature described in roadmap:** Admin should be able to cancel a scheduled class from the schedule page. Should mark the class as cancelled, notify booked members, and release capacity.

**Evidence of absence:**
- `apps/web/src/app/api/classes/[id]/route.ts` has a `DELETE` handler (route.ts:239) that returns 409 if any bookings exist. API-side is built.
- `apps/web/src/app/(admin)/schedule/_components/ClassFormModal.tsx` does NOT expose a "Cancel this class" button. It only supports create and edit (fields starts_at/ends_at/capacity/etc.).
- `apps/web/src/app/(admin)/schedule/page.tsx` does not include a cancel action on class tiles.

**Minimum to implement:**
- Add a "Cancel class" button to `ClassFormModal.tsx` (in edit mode only) that calls `DELETE /api/classes/[id]` with a confirmation dialog.
- OR add a cancel action to the class tile's action menu on `schedule/page.tsx`.
- Either path requires handling the 409 case (class has bookings) — Phase 2 scope for the notification flow.

### GAP-5 — Members Exclude from Analytics, UI missing (Tier 3.7)
**Status:** PARTIAL — API supports the field, UI missing
**Feature described in roadmap:** The Meridian CLAUDE.md explicitly calls out:
> "Exclude from analytics" toggle on profiles so comped members don't skew revenue/attendance data. Comped members still count toward physical capacity.
> Ability to flag specific profiles (e.g., former owners with complimentary memberships) to exclude from financial and attendance calculations.

This is an **explicit user requirement** and a differentiator from Glofox.

**Evidence of absence:**
- `apps/web/src/app/api/members/[id]/route.ts` line 176-184 accepts an `exclude_from_analytics` field on PUT — API supports it.
- `apps/web/src/lib/ai/nl-search.ts` references the field for AI search filtering — read path uses it.
- But: no toggle, no checkbox, no form field in `MemberProfileClient.tsx` or `AddMemberModal.tsx` exposes this to admins. Grep for `exclude_from_analytics` only finds 2 files (the API route and the nl-search). It should also appear in at least one client component.

**Minimum to implement:**
- Add a toggle to the member detail page (`MemberProfileClient.tsx`) or the edit member form, persisted via the existing `PUT /api/members/[id]` route.
- No backend change needed.

## Impact

- **User-facing:** Admins cannot refund transactions, issue credits, cancel classes from the UI, exclude members from analytics, or manage waitlists. Each of these is a documented Phase 1 requirement.
- **QA pipeline:** Tier 3 has 12 planned council runs. 5 of them (3.2, 3.3, 3.7-partial, 3.9, 3.11) cannot run as full 6-phase pipelines because there's nothing to test. This bug unblocks the pipeline by documenting the gap once so each affected council run can file a "gap-filed" report instead.
- **Roadmap honesty:** `CLAUDE.md` and `specs/qa-pipeline-roadmap.md` both claim Phase 1 is complete. They should be updated to reflect that these 5 gaps are Phase 1 debt (or reclassified as Phase 2 work items).

## Fix

**Not fixed in this QA pipeline run.** The QA council's scope is to verify and find gaps, not to build missing features from scratch. This bug is filed so the feature-dev pipeline can pick up the 5 gaps as explicit work items in Phase 2.

The affected Tier 3 council runs (3.2, 3.3, 3.9, 3.11, plus the `exclude_from_analytics` partial of 3.7) will each produce a gap-filed report that cross-references this bug and documents what *would* have been tested if the feature existed.

## Follow-up

- **Phase 2 planning:** Add these 5 gaps as explicit feature-dev tickets before Marketing & Engagement work begins.
- **Documentation correction:** Update `CLAUDE.md` Phase 1 ✅ COMPLETE bullet to either (a) remove the features not yet built or (b) note them as "Phase 1 debt — see BUG-008."
- **Roadmap reordering option:** When the 5 features ship, retroactively run the gap-filed Tier 3 council runs to produce real test coverage. The roadmap's 12-run total still stands; these 5 are just paused.

## Status

**Open — Phase 1 debt documented.** QA pipeline proceeds with gap-filed tiers for missing features and full-pipeline tiers for the 7 that are fully testable (3.4, 3.5, 3.6, 3.7-archive, 3.8, 3.10, 3.12).
