# Tier 4.2 — Memberships: Upgrade (Stripe proration) — 🚫 GAP-FILED + COVERED-BY-4.1

**Run date:** 2026-04-10
**Pipeline:** Analyst-only (composite reason: Stripe is stubbed + the upgrade flow is already tested by Tier 4.1)
**Status:** 🚫 GAP-FILED — 0 new tests; the underlying endpoint is already covered by Tier 4.1
**Tests written:** 0 (Tier 4.1 already validates the upgrade flow at the API layer)
**Tests specified for when Stripe ships:** 4 (documented below)

---

## Why this tier doesn't run

Tier 4.2 in the roadmap is "Memberships: Upgrade (Stripe proration)" with the note "Mock Stripe". The intent: verify that an upgrade triggers a real Stripe `subscriptions.update` call with `proration_behavior: 'create_prorations'`.

### State of Stripe integration in the upgrade route

`apps/web/src/app/api/members/[id]/upgrade/route.ts:104-113` has explicit TODO comments:

```ts
// If Stripe subscription exists, update with proration
// Note: Full Stripe integration requires the Stripe SDK.
// This logs the intent; the actual Stripe call would be:
// stripe.subscriptions.update(subscriptionId, {
//   items: [{ id: itemId, price: newPriceId }],
//   proration_behavior: 'create_prorations',
// });
const stripeNote = member.stripe_subscription_id
  ? "Stripe subscription proration pending"
  : "No Stripe subscription to update";
```

**Stripe is not integrated.** The endpoint logs a `stripeNote` string in the response and the activity_log metadata, but never actually calls Stripe. There is no proration to verify, no item ID lookup, no price ID resolution, and no subscription update.

### Tier 4.1 already covers the non-Stripe upgrade flow

Tier 4.1 (Memberships: Assign) tested `POST /api/members/[id]/upgrade` end-to-end at the API layer with 5 scenarios:

1. ✅ Assign-from-none happy path (tier 4.1 Scenario 1)
2. ✅ Upgrade between tiers (tier 4.1 Scenario 2 — 6_class → unlimited)
3. ✅ Already-on-plan rejection (Scenario 3)
4. ✅ Invalid plan name rejection (Scenario 4)
5. ✅ 404 for non-existent member (Scenario 5)

Plus Tier 4.1 fixed BUG-021 (`'membership_upgraded'` → `'membership_change'` + missing description) which was a prerequisite for any meaningful activity_log assertion.

The only thing Tier 4.2 would add ON TOP of 4.1 is the Stripe assertion — and there's no Stripe integration to assert against.

---

## Decision

**Gap-file with 0 new tests.** The upgrade flow is already tested. The Stripe-specific behavior cannot be tested because it doesn't exist. When Stripe is integrated, the 4 scenarios below should be added.

This is the third "covered by adjacent tier" pattern in the playbook:
- Tier 4.2 is covered by Tier 4.1 (same endpoint, no new behavior)
- Future tiers may identify similar overlap

---

## Scenarios for when Stripe integration ships

When the Stripe `subscriptions.update` call is wired into the route, the following 4 scenarios should be added:

### Scenario 1 — P0 — Mock Stripe call fires with proration_behavior

```
GIVEN a member with stripe_subscription_id='sub_test_xyz' on the 6_class plan
AND Stripe SDK is mocked at the test boundary
WHEN admin upgrades the member to unlimited
THEN the mocked stripe.subscriptions.update was called with:
  - subscription_id = 'sub_test_xyz'
  - items[0].price = the unlimited tier's price ID
  - proration_behavior = 'create_prorations'
AND DB: members.membership_tier = 'unlimited'
AND DB: activity_log metadata.stripe_note contains the proration confirmation
```

### Scenario 2 — P0 — Member without Stripe subscription still upgrades

```
GIVEN a member with stripe_subscription_id=null
WHEN admin upgrades the member
THEN no Stripe call is made
AND DB: members.membership_tier is updated
AND DB: activity_log metadata.stripe_note = 'No Stripe subscription to update'
```

### Scenario 3 — P1 — Stripe API failure rolls back the upgrade

```
GIVEN a member with stripe_subscription_id='sub_test_xyz'
AND the mocked Stripe call throws StripeAPIError
WHEN admin upgrades the member
THEN the response is 502 (Bad Gateway) or 500
AND DB: members.membership_tier is UNCHANGED
AND DB: no activity_log row was inserted
```

### Scenario 4 — P1 — Concurrent upgrade requests are serialized

```
GIVEN a member with stripe_subscription_id='sub_test_xyz' on 6_class
WHEN two concurrent upgrade requests are sent (one to unlimited, one to 10_class)
THEN exactly one succeeds
AND the other returns either 409 (conflict) or the same plan state
AND DB: only one membership_change activity_log row exists
```

---

## What's needed before this tier can run

1. **Real Stripe integration** in `apps/web/src/app/api/members/[id]/upgrade/route.ts`:
   - Import `Stripe` from `'stripe'` (already a project dep — see CLAUDE.md tech stack)
   - Lookup the price ID for the new plan (likely from a `membership_plans` table or env config)
   - Lookup the subscription item ID via `stripe.subscriptions.retrieve(subscriptionId)`
   - Call `stripe.subscriptions.update(subscriptionId, { items, proration_behavior })`
   - Capture the proration result (proration_amount, next_invoice_date) and write to activity_log metadata

2. **Stripe mocking infrastructure** for the tests:
   - Add `apps/web/e2e/fixtures/stripe-mock.ts` — wraps the Stripe SDK with controllable test responses
   - Pattern: similar to how Resend is mocked in Tier 5 marketing tests

3. **Test fixtures**:
   - `seedMember({ stripeSubscriptionId: 'sub_test_xyz' })` extension
   - Or use a dedicated `seedStripeMember` helper

4. **Optional**: A `membership_plans` table with plan→price_id mapping. The current route hardcodes plan names — if the project moves to a `membership_plans` lookup, the route needs an additional query.

Estimated effort: medium-large. Stripe integration is non-trivial.

---

## Disposition

**Gap-filed.** Tier 4 counter advances to 2/8 with this gap-file (alongside Tier 4.1 narrow-scope). Total 29/61.

This is the **first non-BUG-008 gap-file** in the pipeline. Prior gap-files (3.2, 3.3, 3.11) were all "feature absent" — this one is "feature partially present + already tested by adjacent tier + the missing piece is unbuildable in this tier without Stripe SDK work".

Pattern note: this gap-file establishes a new sub-category — **"covered-by-adjacent-tier"**. Distinct from "feature absent". When a future tier identifies that its scope is already tested elsewhere, gap-file with this rationale rather than running redundant tests.

---

## Tier 4 status

**1/8 → 2/8** (1 narrow-scope full + 1 gap-filed). Next: Tier 4.3 (Memberships: Downgrade — next cycle). The downgrade endpoint (`/api/members/[id]/downgrade`) likely has the same BUG-021-style silent swallow + BUG-013 inheritance issues. Will be a similar narrow-scope tier.
