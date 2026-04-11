# Tier 4.1 — Memberships: Assign (narrow scope, API-level)

**Run date:** 2026-04-10
**Pipeline:** Narrow scope — API-level testing because UI is broken by BUG-013
**Status:** ✅ PASS (3 clean runs, 7/7 each)
**Tests:** 5 scenarios (2 P0, 3 P1)
**Bugs closed:** BUG-021 (`'membership_upgraded'` not in activity_log enum + missing description) — 1-line type fix + description add + capture-and-log
**Bugs documented (not fixed):** BUG-013 still inherited by Pause/Upgrade panel buttons (modal interfaces pass `member.id` instead of `profileId`)

---

## Scope decision

Tier 4.1 is "Memberships: Assign". The roadmap says 6 tests, new MembershipsPage POM. After Analyst probing:

- **No dedicated `/api/memberships/assign` endpoint exists.** The "assign" operation is a degenerate case of `POST /api/members/[id]/upgrade` (oldPlan='none' → newPlan='6_class').
- **The MemberProfilePanel's Upgrade button is broken by BUG-013** — it passes `member.id` (= `members.id`) but the route expects `profile_id`. The button currently 404s in production.
- **No new MembershipsPage POM is needed** — the operation is exposed via the members panel + an UpgradeModal, both of which are broken.

Building the full UI fix (BUG-013 narrow blast for Pause + Upgrade buttons + their modals) would touch 4-5 files and re-exercise the Tier 3.6/3.7 BUG-013 mitigation pattern. That's a substantial scope.

**Decision: narrow scope.** Test the upgrade endpoint at the API layer using `page.request.post`, fix the inline BUG-021 bug (1-line type + 4 lines for description and error capture), document BUG-013 as still open. UI flow is deferred to a dedicated "BUG-013 Option A full fix" tier.

---

## Phase 1 — Analyst

### BUG-021 — `/api/members/[id]/upgrade` activity_log silent swallow

File: `apps/web/src/app/api/members/[id]/upgrade/route.ts:116-127`

```ts
await supabase.from("activity_log").insert({
  ...
  type: "membership_upgraded",   // NOT IN ENUM
  // description omitted — NOT NULL silent swallow
  ...
});
```

`activity_log.type` CHECK enum (verified Tier 4.1 probe — same as Tier 3.8 list, no new values for memberships):

```
'check_in', 'booking', 'cancellation', 'payment', 'failed_payment',
'membership_change', 'walk_in', 'new_member', 'refund', 'strike',
'clock_in', 'clock_out', 'product_created', 'product_updated', 'product_deleted',
'member_created', 'member_updated', 'member_deleted',
'class_created', 'class_updated', 'class_cancelled', 'class_deleted'
```

`'membership_upgraded'` is NOT in the enum. The canonical value for membership transitions is `'membership_change'` (singular). The previous insert silently swallowed every upgrade.

The same insert also omits the NOT NULL `description` column — same silent-swallow pattern as Tiers 3.1/3.4/3.5/3.6/3.7/3.8/3.9/3.10/3.12 (10 consecutive Tier 3+ runs).

**Fix:** 1-line type change (`'membership_upgraded'` → `'membership_change'`) + add `description: \`Membership changed: ${oldPlan} → ${new_plan}\`` + capture-and-log pattern. ~10 lines of diff in one file.

### BUG-013 inheritance — still open

The MemberProfilePanel has 3 panel buttons that pass `member.id` but the routes expect `profile_id`:

- **Pause** — `MemberPauseModal` receives `memberId={member.id}` (line 594)
- **Upgrade** — `MemberUpgradeModal` receives `memberId={member.id}` (line 585)
- **Edit** — uses `member.profileId` (Tier 3.6 narrow fix)
- **Archive** — uses `member.profileId` (Tier 3.7 narrow fix)

Pause and Upgrade still inherit BUG-013. Tier 4.1 does NOT fix this — instead the spec uses `page.request.post` to bypass the broken UI.

The modals (`MemberPauseModal`, `MemberUpgradeModal`) likely have their own `memberId` prop interfaces and internal `fetch` calls that need updating. That's the scope of a future "BUG-013 Option A full fix" tier.

### Test scenarios (5)

| # | Pri | Name | Proves |
|---|---|---|---|
| 1 | P0 | Assign happy path (none → unlimited) | Endpoint accepts the assign-from-none case + BUG-021 fix |
| 2 | P0 | Upgrade between tiers (6_class → unlimited) | Standard upgrade case |
| 3 | P1 | Already-on-plan rejection | 400 with no log row |
| 4 | P1 | Invalid plan name rejection | 400 with allowlist enforcement |
| 5 | P1 | 404 on non-existent member | Clean error handling |

---

## Phase 2-5 — Engineer + Sentinel

Inline (small scope). Files:

| File | Change |
|---|---|
| `apps/web/src/app/api/members/[id]/upgrade/route.ts` | BUG-021 fix: `'membership_change'` type, description added, capture-and-log on activityError, `metadata.action: 'upgrade'` marker |
| `apps/web/e2e/memberships-assign-upgrade.spec.ts` | NEW — 5-test spec (~210 lines) using `page.request.post` directly |

No POM extension (tests use `page.request` not the UI). No testid seeds. No fixture changes.

---

## Sentinel

3 consecutive standalone runs:

| Run | Duration | Result |
|---|---|---|
| 1 | 35.7s | 7/7 ✅ |
| 2 | 38.0s | 7/7 ✅ |
| 3 | 31.2s | 7/7 ✅ |

(7 = 2 auth-setup + 5 Tier 4.1 tests.)

No regression suite run — Tier 4.1 doesn't touch any prior tier's surfaces. The activity_log enum hasn't changed (no migration). The route remap is purely additive in semantics (canonical type + description + error capture).

---

## Bugs

### BUG-021 — closed by this run

`'membership_upgraded'` → `'membership_change'`, description added, capture-and-log applied. Verified by Scenario 1's assertion that `activity_log.type === 'membership_change'` AND `description` is non-null AND `metadata.action === 'upgrade'`.

### BUG-013 — still open for Pause/Upgrade panel buttons

Tier 4.1 used direct API testing to bypass the broken UI. The UI buttons remain broken in production. A dedicated "BUG-013 Option A full fix" tier should:
1. Update `MemberPauseModal` to accept `profileId` instead of `memberId`
2. Update `MemberUpgradeModal` to accept `profileId` instead of `memberId`
3. Update both modals' internal `fetch` calls to use `profileId` in the URL
4. Update the panel to pass `member.profileId` to both modals
5. Re-test via the UI flow

Estimated effort: small (~30 lines across 3-4 files), but requires the same testing rigor as Tier 3.6/3.7.

---

## Tier 4 status

**0/8 → 1/8** (1 narrow-scope full pipeline). Tier 4 just started.

Next: Tier 4.2 (Memberships: Upgrade with Stripe proration). Scope decision likely similar — Stripe integration is stubbed in the existing route (line 105-113 has TODO comments), so a meaningful test of "Stripe proration" would require either mocking Stripe or accepting that the test asserts on the stub note. Likely another narrow-scope tier.
