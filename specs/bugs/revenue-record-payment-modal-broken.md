# BUG-006 — Record Payment modal cannot create a transaction (critical write-flow blocker)

**Status:** Open — critical write-flow blocker
**Severity:** High (every manual payment recording is broken; entire modal is non-functional)
**Discovered by:** QA pipeline Tier 3.1 (Revenue: Record Payment council run) — 2026-04-09
**Related:** `apps/web/src/app/(admin)/revenue/_components/RecordPaymentModal.tsx`, `apps/web/src/app/api/transactions/route.ts`

---

## Summary

The admin Revenue module's "Record Payment" modal (`/revenue` → header button)
is completely broken in production. It cannot successfully create a transaction
for **any** input combination a user might select, because of three compounding
schema/validation mismatches between the client UI, the POST `/api/transactions`
route, and the `transactions` table's constraints.

Production evidence: `SELECT COUNT(*) FROM transactions WHERE member_id IS NOT NULL`
returns **0** out of 1,925 total transactions. The studio has 1,187 members and
1,202 profiles, but zero transactions have ever been successfully linked to a
member via this modal. Every existing transaction row was inserted by a different
code path (Glofox sync, scripted seeds, etc.) and leaves `member_id` NULL.

## Root causes

### (1) FK mismatch — UI sends `profiles.id`, DB expects `members.id`

`RecordPaymentModal.tsx:76-88` searches the `profiles` table directly:

```tsx
const { data } = await supabase
  .from('profiles')
  .select('id, full_name, email')
  .eq('studio_id', DEFAULT_STUDIO_ID)
  .or(`full_name.ilike.%${memberSearch}%,email.ilike.%${memberSearch}%`)
  .limit(8)
```

When the user selects a search result, `selectMember()` stores `profile.id` as
`memberId`:

```tsx
const selectMember = (m: MemberOption) => {
  setSelectedMember(m)
  setMemberId(m.id)  // ← this is profiles.id
  ...
}
```

The form submits `{ member_id: profileId, ... }` to `POST /api/transactions`,
which inserts `member_id: profileId` into the `transactions` table. But:

```sql
-- Verified in rhdmiyttafsbfuflnjza (Fleetwood / TSG SaaS dev DB)
SELECT conname, confrelid::regclass FROM pg_constraint
WHERE conname = 'transactions_member_id_fkey';

--  conname                      | confrelid
-- ------------------------------+-----------
--  transactions_member_id_fkey  | members
```

`transactions.member_id` is a FK to **`members.id`**, not `profiles.id`. Inserting
a `profile.id` fails with:

```
ERROR: 23503: insert or update on table "transactions" violates foreign key
constraint "transactions_member_id_fkey"
DETAIL: Key (member_id)=(<profile uuid>) is not present in table "members".
```

The API route (`api/transactions/route.ts:157-170`) validates `member_id` exists
in the `profiles` table, which PASSES — giving the appearance that the caller
provided a valid ID — and then fails at the `.insert()` because the FK goes to
`members`. The error surfaces as a 500 to the client, which displays a generic
"Failed to record payment" banner.

### (2) Default transaction type is `other`, which violates the CHECK constraint

`RecordPaymentModal.tsx:49` defaults the type to `'other'`:

```tsx
const [type, setType] = useState('other')
```

But the `transactions_type_check` CHECK constraint is:

```sql
CHECK (type = ANY (ARRAY[
  'membership', 'drop_in', 'credit_pack', 'merch', 'gift_card',
  'private_event', 'refund', 'strike_penalty'
]))
```

`'other'` is not in the allowed list. **Even if the FK were fixed**, a user who
accepts the default type would hit:

```
ERROR: 23514: new row for relation "transactions" violates check constraint
"transactions_type_check"
```

### (3) Two other PAYMENT_TYPES values don't match DB canonical names

`RecordPaymentModal.tsx:31-39` defines:

```tsx
const PAYMENT_TYPES = [
  { value: 'membership', label: 'Membership' },     // ✓ valid
  { value: 'drop_in', label: 'Drop-in' },           // ✓ valid
  { value: 'credit_pack', label: 'Credit Pack' },   // ✓ valid
  { value: 'merchandise', label: 'Merchandise' },   // ✗ should be 'merch'
  { value: 'event', label: 'Event' },               // ✗ should be 'private_event'
  { value: 'gift_card', label: 'Gift Card' },       // ✓ valid
  { value: 'other', label: 'Other' },               // ✗ not in DB enum
]
```

Selecting "Merchandise" or "Event" triggers the same CHECK constraint error as
`'other'`. Only four of the seven labeled options (`membership`, `drop_in`,
`credit_pack`, `gift_card`) would reach the FK check — where they'd fail with
root cause (1).

### (4) `payment_method` is silently dropped

`RecordPaymentModal.tsx:114` sends `payment_method` in the POST body, but
`api/transactions/route.ts:141` destructures only `{ member_id, amount, type,
description, status }` — the `payment_method` field is silently ignored by the
server. Every manual payment gets `payment_method: NULL` in the DB. This is
not a crash bug, but the UI lies about tracking cash vs. check vs. bank
transfer.

## Reproduction

1. Log in as admin
2. Navigate to `/revenue`
3. Click "Record Payment"
4. Search for any member, click a result
5. Enter any amount (e.g., `10`)
6. Leave type as default (`Other`) OR select any other value
7. Click "Record Payment" → "Failed to record payment" banner

Verified with direct SQL probe against `rhdmiyttafsbfuflnjza.supabase.co`:

```sql
-- FK fails (member_id = profile.id)
INSERT INTO transactions (member_id, studio_id, amount, type, status, description)
SELECT id, '11111111-1111-1111-1111-111111111111', 1, 'drop_in', 'completed', 'probe'
FROM profiles LIMIT 1;
-- ERROR: violates foreign key constraint "transactions_member_id_fkey"

-- FK succeeds (member_id = members.id)
INSERT INTO transactions (member_id, studio_id, amount, type, status, description)
SELECT id, '11111111-1111-1111-1111-111111111111', 1, 'drop_in', 'completed', 'probe'
FROM members LIMIT 1;
-- Insert OK
```

## Fix (applied as part of Tier 3.1 remediation)

### `RecordPaymentModal.tsx`

1. **Two-step member search** — `profiles` match first, then look up the corresponding `members.id`:
   ```tsx
   // 1. Find profiles matching the search
   const { data: profileRows } = await supabase
     .from('profiles')
     .select('id, full_name, email')
     .eq('studio_id', DEFAULT_STUDIO_ID)
     .or(`full_name.ilike.%${memberSearch}%,email.ilike.%${memberSearch}%`)
     .limit(8)

   // 2. Look up the member row for each profile
   const { data: memberRows } = await supabase
     .from('members')
     .select('id, profile_id')
     .eq('studio_id', DEFAULT_STUDIO_ID)
     .in('profile_id', profileIds)

   // 3. Join in JS and map into { id: members.id, full_name, email }
   ```
   The two-step approach replaces an earlier single-query attempt using
   `.from('members').select('id, profiles:profile_id!inner(...)').or(..., { referencedTable: 'profiles' })`.
   The embedded-filter form returned an empty set in practice — a PostgREST
   serialization quirk surfaced in this council run. Two queries are simple,
   explicit, and resilient.

2. **Fix PAYMENT_TYPES to match DB canonical values:**
   - `merchandise` → `merch`
   - `event` → `private_event`
   - Remove `other` entirely

3. **Change default type** from `'other'` to `'drop_in'` (the most common
   manual-payment case for a walk-in session).

### `api/transactions/route.ts`

1. **Validate `member_id` against `members` table** (not `profiles`):
   ```tsx
   const { data: member } = await supabase
     .from("members")
     .select("id")
     .eq("id", member_id)
     .eq("studio_id", studioId)
     .maybeSingle();
   ```

2. **Accept and persist `payment_method`** from the request body (already present
   as a column on `transactions`). Destructured alongside `member_id`, `amount`,
   `type`, `description`, `status`.

3. **Use `sold_by_profile_id` for provenance.** An earlier draft inserted
   `created_by: user.id`, but `transactions` has no `created_by` column — the
   provenance column is `sold_by_profile_id` (FK to `profiles.id`). Fixed in
   the same commit.

4. **Zero/negative amount guard.** Added a `if (amount <= 0)` branch returning
   400 `"amount must be greater than zero"` — the modal's client-side guard was
   already present, but the server was trusting the client. Tier 3 contract
   requires validation in both layers.

5. **activity_log insert fixes** — two separate schema constraints were violated
   by the original draft:
   - `activity_log.description` is `NOT NULL`. Added a human-readable label:
     `\`Manual payment recorded: ${(amount / 100).toFixed(2)} ${type}\``.
   - `activity_log_type_check` is an enum whitelist that does NOT include
     `'transaction_created'`. Canonical value for manual payments is
     `'payment'`.

## Related discoveries

The same Tier 3.1 council run surfaced **BUG-007** (auth test users seeded into
wrong studio). BUG-007 is not a product bug — it's a test-harness bug — but it
blocked every write spec until fixed. See
`specs/bugs/auth-test-users-wrong-studio.md`.

## Impact

- **Before fix:** the "Record Payment" button is dead; no admin can ever record
  a manual / offline / cash payment. 100% of existing transactions were inserted
  by other code paths.
- **After fix:** admin can record payments linked to real members, and those
  rows show up correctly in the transactions table / analytics dashboards.

## Status

**Fixed in this Tier 3.1 council run.** See `apps/web/src/app/(admin)/revenue/_components/RecordPaymentModal.tsx` and `apps/web/src/app/api/transactions/route.ts` for the diff. Verified by 8 new Playwright tests
in `apps/web/e2e/revenue-record-payment.spec.ts`.
