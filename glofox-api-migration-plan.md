# Glofox API Migration Plan — Complete Transition Strategy

**Author:** Claude Opus 4.6 + Zach (The Sauna Guys)
**Date:** 2026-03-31
**Status:** DRAFT — Pending Scrutiny Review
**Scope:** Replace CSV-based Glofox data import with live two-way API integration

---

## Executive Summary

The Sauna Guys currently operates on Glofox for bookings, memberships, and payments, while Meridian serves as the management dashboard. Data was imported once via CSV, leaving 27 data fields uncaptured and no ongoing sync. Glofox has now granted API access (57 endpoints, two-way read/write), enabling us to:

1. **Enrich existing data** with 27 new fields (birthdays, addresses, consent, membership expiry dates, etc.)
2. **Enable live two-way sync** so actions in either system stay consistent
3. **Eventually cut over** to Meridian as the sole operational system, using Stripe for payments

This plan defines four phases over ~8 weeks, from schema preparation through full cutover.

---

## API Capability Assessment

### What We Can READ from Glofox
| Data | Endpoint | Volume |
|------|----------|--------|
| All members + profiles | `GET /2.0/members` | ~1,100 |
| Staff/trainers | `GET /2.0/staff` | ~10 |
| All bookings (studio-wide) | `GET /2.2/branches/{id}/bookings` | ~1,300+ |
| All transactions | `POST /Analytics/report` | ~2,500+ |
| Classes/events | `GET /2.0/events` | ~300+ |
| Credit packs | `GET /2.0/credits` | Per member |
| Membership plans | `GET /2.0/memberships` | All plans |
| Leads + interactions | `POST /2.1/.../leads/filter` | All leads |
| Waivers/agreements | `GET /TermsConditions/view` | All |
| Products | `GET /v3.0/.../products` | All |
| Trainer performance | `GET /2.0/analytics/trainer-performance` | Aggregated |
| Family/linked accounts | `GET /2.2/users/{id}/linked-accounts` | Per member |
| Lead sources | `GET /2.3/.../contact-sources` + `marketing-sources` | All |

**Key for incremental sync:** Members and Events support `utc_modified_start_date` / `utc_modified_end_date` filters. Bookings support `modified_start_date` / `modified_end_date`. This allows pulling only changed records since last sync.

### What We Can WRITE Back to Glofox
| Action | Endpoint | Use Case |
|--------|----------|----------|
| Update member profiles | `PUT /2.0/members/{id}` | Profile edits in Meridian → Glofox |
| Register new members | `POST /2.0/register` | New signups from Meridian |
| Create bookings | `POST /2.3/.../bookings` | Book from Meridian → shows in Glofox |
| Cancel bookings | `DELETE /2.3/.../bookings/{id}` | Cancel from Meridian → Glofox |
| Mark attendance | `POST /2.0/attendances` | Check-in from Meridian → Glofox |
| Create door access | `POST /2.0/access` | Entry log from Meridian |
| Purchase memberships | `POST /2.2/.../purchase` | Sell from Meridian via Glofox payment |
| Cancel memberships | `POST /v3.0/memberships/{id}/cancel` | Cancel from Meridian |
| Add lead interactions | `POST /2.1/.../interactions` | CRM notes from Meridian |
| Send agreements | `POST /2.2/.../agreements/send` | Trigger waivers |
| Upload profile images | `POST /assets/upload/.../profile` | Photo updates |
| Cart/checkout | `POST /v3.0/carts` → checkout | Full purchase flow |

### What We CANNOT Do via API
- Create/edit classes or schedules (no write endpoint for events)
- Create/edit membership plans (read-only)
- Access Glofox's payment processor directly
- Receive webhooks (Glofox has no webhook system — we must poll)
- Edit transaction records
- Manage staff accounts

---

## Phase 1: Schema Preparation (Week 1)

### 1.1 Add Glofox ID Columns to All Synced Tables

Every table that syncs with Glofox needs a `glofox_id` column for ID mapping:

```sql
-- profiles already has glofox_id ✅
ALTER TABLE members ADD COLUMN IF NOT EXISTS glofox_id text UNIQUE;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS glofox_id text UNIQUE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS glofox_id text UNIQUE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS glofox_id text UNIQUE;
ALTER TABLE credit_packs ADD COLUMN IF NOT EXISTS glofox_id text UNIQUE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS glofox_id text UNIQUE;
ALTER TABLE membership_plans ADD COLUMN IF NOT EXISTS glofox_id text UNIQUE;

-- Add sync tracking
ALTER TABLE members ADD COLUMN IF NOT EXISTS glofox_synced_at timestamptz;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS glofox_synced_at timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS glofox_synced_at timestamptz;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS glofox_synced_at timestamptz;
```

### 1.2 Add New Fields from API (27 fields)

#### Profiles table
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birth_date date;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS emergency_contact text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address_street text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address_city text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address_state text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address_zip text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address_country text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS consent_email boolean DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS consent_sms boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS consent_push boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS access_barcode text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS glofox_lead_status text; -- LEAD/MEMBER/COLD
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS glofox_sources text[]; -- acquisition source array
```

#### Members table
```sql
ALTER TABLE members ADD COLUMN IF NOT EXISTS membership_expiry_date timestamptz;
ALTER TABLE members ADD COLUMN IF NOT EXISTS membership_start_date timestamptz;
ALTER TABLE members ADD COLUMN IF NOT EXISTS glofox_plan_code text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS plan_price_cents integer;
ALTER TABLE members ADD COLUMN IF NOT EXISTS auto_renewal boolean DEFAULT false;
ALTER TABLE members ADD COLUMN IF NOT EXISTS glofox_membership_id text; -- user_membership_id
```

#### Bookings table
```sql
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_late_cancellation boolean DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_from_waitlist boolean DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_first_booking boolean DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_paid boolean;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS guest_booking_count integer DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS glofox_program_id text;
```

#### Transactions table
```sql
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS sold_by_profile_id uuid REFERENCES profiles(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS glofox_provider_id text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS glofox_paid boolean;
```

#### Classes table
```sql
ALTER TABLE classes ADD COLUMN IF NOT EXISTS waitlist_count integer DEFAULT 0;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS is_online boolean DEFAULT false;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS is_private boolean DEFAULT false;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS glofox_program_id text;
```

#### Credit Packs table
```sql
ALTER TABLE credit_packs ADD COLUMN IF NOT EXISTS credit_model text; -- class/course/appointment/facility
ALTER TABLE credit_packs ADD COLUMN IF NOT EXISTS linked_membership_id text;
ALTER TABLE credit_packs ADD COLUMN IF NOT EXISTS linked_membership_name text;
```

### 1.3 Create Sync Infrastructure Tables

```sql
-- Sync engine state tracking
CREATE TABLE IF NOT EXISTS glofox_sync_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES studios(id),
  entity_type text NOT NULL, -- 'members', 'bookings', 'events', 'transactions'
  last_sync_at timestamptz NOT NULL DEFAULT '1970-01-01',
  last_full_sync_at timestamptz,
  records_synced integer DEFAULT 0,
  errors_count integer DEFAULT 0,
  last_error text,
  status text DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'error', 'disabled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Sync conflict log for auditing
CREATE TABLE IF NOT EXISTS glofox_sync_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES studios(id),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  glofox_id text NOT NULL,
  field_name text NOT NULL,
  meridian_value text,
  glofox_value text,
  resolution text CHECK (resolution IN ('glofox_wins', 'meridian_wins', 'manual', 'unresolved')),
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Lead interactions (new table from Glofox CRM data)
CREATE TABLE IF NOT EXISTS lead_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES studios(id),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  glofox_id text,
  type text NOT NULL CHECK (type IN ('NOTE', 'CALLED_AND_CONNECTED', 'CALLED_AND_NO_ANSWER', 'MANUAL_EMAIL', 'meridian_note')),
  description text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);
```

### 1.4 Store API Credentials

Add to Netlify environment variables (NOT in code):
```
GLOFOX_API_TOKEN=<your-integrator-token>
GLOFOX_API_KEY=<your-api-key>
GLOFOX_BRANCH_ID=<your-branch-mongo-id>
```

---

## Phase 2: Sync Engine Build (Weeks 2-3)

### 2.1 Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Glofox    │◄───►│  Sync Engine │◄───►│  Supabase   │
│   API       │     │  (Inngest)   │     │  (Postgres)  │
└─────────────┘     └──────────────┘     └─────────────┘
                           │
                    ┌──────┴──────┐
                    │             │
              ┌─────▼────┐ ┌─────▼────┐
              │ Inbound  │ │ Outbound │
              │ Sync     │ │ Sync     │
              │ (Glofox  │ │ (Meridian│
              │ → Merid) │ │ → Glofox)│
              └──────────┘ └──────────┘
```

**Sync engine runs as Inngest functions:**

| Function | Schedule | Direction | What |
|----------|----------|-----------|------|
| `sync-members-inbound` | Every 10 min | Glofox → Meridian | Pull changed members |
| `sync-bookings-inbound` | Every 5 min | Glofox → Meridian | Pull changed bookings |
| `sync-events-inbound` | Every 15 min | Glofox → Meridian | Pull changed classes |
| `sync-transactions-inbound` | Every 30 min | Glofox → Meridian | Pull new transactions |
| `sync-full-refresh` | Daily 3am | Glofox → Meridian | Full reconciliation |
| `sync-member-outbound` | Event-driven | Meridian → Glofox | Push profile updates |
| `sync-booking-outbound` | Event-driven | Meridian → Glofox | Push new bookings/cancellations |
| `sync-attendance-outbound` | Event-driven | Meridian → Glofox | Push check-ins |

### 2.2 Glofox API Client

```typescript
// lib/glofox/client.ts
export class GlofoxClient {
  private baseUrl = 'https://gf-api.aws.glofox.com/prod'
  private apiToken: string
  private apiKey: string

  constructor() {
    this.apiToken = process.env.GLOFOX_API_TOKEN!
    this.apiKey = process.env.GLOFOX_API_KEY!
  }

  private headers() {
    return {
      'Content-Type': 'application/json',
      'x-glofox-api-token': this.apiToken,
      'x-api-key': this.apiKey,
    }
  }

  // Paginated fetch helper
  async fetchAll<T>(path: string, params?: Record<string, string>): Promise<T[]> {
    const results: T[] = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      const url = new URL(path, this.baseUrl)
      url.searchParams.set('page', String(page))
      url.searchParams.set('limit', '100')
      if (params) {
        for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
      }

      const res = await fetch(url.toString(), { headers: this.headers() })
      if (!res.ok) throw new Error(`Glofox API ${res.status}: ${await res.text()}`)

      const body = await res.json()
      results.push(...(body.data || []))
      hasMore = body.has_more ?? false
      page++
    }

    return results
  }

  // Entity-specific methods
  async getMembers(modifiedSince?: string) { ... }
  async getMember(userId: string) { ... }
  async updateMember(userId: string, data: Partial<GlofoxMember>) { ... }
  async getBookings(modifiedSince?: string) { ... }
  async createBooking(data: GlofoxBookingRequest) { ... }
  async cancelBooking(bookingId: string) { ... }
  async markAttendance(bookingIds: string[]) { ... }
  async getEvents(start: number, end: number, modifiedSince?: string) { ... }
  async getTransactions(start: string, end: string) { ... }
  async getCredits(userId: string) { ... }
  async getMemberships() { ... }
  async getStaff() { ... }
  async getLeads() { ... }
  async getLeadInteractions(userId: string) { ... }
  async addLeadInteraction(userId: string, type: string, description: string) { ... }
}
```

### 2.3 Inbound Sync Logic (Glofox → Meridian)

```typescript
// lib/glofox/sync/inbound-members.ts
async function syncMembersInbound(studioId: string) {
  const glofox = new GlofoxClient()
  const db = getAdminClient()

  // Get last sync timestamp
  const { data: syncState } = await db
    .from('glofox_sync_state')
    .select('last_sync_at')
    .eq('entity_type', 'members')
    .eq('studio_id', studioId)
    .single()

  const modifiedSince = syncState?.last_sync_at || '1970-01-01T00:00:00Z'

  // Pull changed members from Glofox
  const glofoxMembers = await glofox.getMembers(modifiedSince)

  let synced = 0, errors = 0

  for (const gm of glofoxMembers) {
    try {
      // Find existing Meridian record by glofox_id
      const { data: existing } = await db
        .from('profiles')
        .select('id, updated_at')
        .eq('glofox_id', gm._id)
        .eq('studio_id', studioId)
        .maybeSingle()

      if (existing) {
        // UPDATE — per-field conflict resolution
        await updateExistingMember(db, existing.id, gm, studioId)
      } else {
        // INSERT — new member from Glofox
        await createNewMember(db, gm, studioId)
      }
      synced++
    } catch (err) {
      errors++
      console.error(`Sync error for Glofox member ${gm._id}:`, err)
    }
  }

  // Update sync state
  await db.from('glofox_sync_state').upsert({
    studio_id: studioId,
    entity_type: 'members',
    last_sync_at: new Date().toISOString(),
    records_synced: synced,
    errors_count: errors,
    status: errors > 0 ? 'error' : 'idle',
  }, { onConflict: 'studio_id,entity_type' })
}
```

### 2.4 Outbound Sync Logic (Meridian → Glofox)

Outbound sync is **event-driven**, triggered by database changes:

```typescript
// lib/glofox/sync/outbound.ts

// Called when a member profile is updated in Meridian
async function pushMemberUpdate(memberId: string) {
  const db = getAdminClient()
  const glofox = new GlofoxClient()

  // Get the Meridian member + their glofox_id
  const { data: member } = await db
    .from('profiles')
    .select('*, members!inner(*)')
    .eq('members.id', memberId)
    .single()

  if (!member?.glofox_id) return // No Glofox mapping — skip

  // Push changes to Glofox
  await glofox.updateMember(member.glofox_id, {
    first_name: member.full_name?.split(' ')[0],
    last_name: member.full_name?.split(' ').slice(1).join(' '),
    phone: member.phone,
    email: member.email,
  })

  // Update sync timestamp
  await db.from('profiles')
    .update({ glofox_synced_at: new Date().toISOString() })
    .eq('id', member.id)
}

// Called when a booking is created in Meridian
async function pushNewBooking(bookingId: string) {
  const db = getAdminClient()
  const glofox = new GlofoxClient()

  const { data: booking } = await db
    .from('bookings')
    .select('*, classes(glofox_id), members(profiles(glofox_id))')
    .eq('id', bookingId)
    .single()

  if (!booking?.classes?.glofox_id || !booking?.members?.profiles?.glofox_id) return

  const result = await glofox.createBooking({
    branch_id: process.env.GLOFOX_BRANCH_ID!,
    model: 'event',
    model_id: booking.classes.glofox_id,
    user_id: booking.members.profiles.glofox_id,
  })

  // Store the Glofox booking ID back
  await db.from('bookings')
    .update({ glofox_id: result.Booking._id })
    .eq('id', bookingId)
}
```

### 2.5 Conflict Resolution Rules

| Field Category | Owner During Transition | After Cutover |
|---------------|------------------------|---------------|
| **Membership status/plan** | Glofox (payments run there) | Meridian + Stripe |
| **Membership expiry/billing** | Glofox | Meridian + Stripe |
| **Booking status** | Glofox (staff still uses it) | Meridian |
| **Transaction amounts** | Glofox (payment processor) | Meridian + Stripe |
| **Profile data** (name, phone, email) | Last-modified wins | Meridian |
| **Address, emergency contact** | Last-modified wins | Meridian |
| **AI fields** (health score, engagement) | Always Meridian | Meridian |
| **Meridian-only** (segments, automations) | Always Meridian | Meridian |
| **Consent preferences** | Last-modified wins | Meridian |
| **Notes/tags** | Merged (both kept) | Meridian |

When a conflict is detected (same field modified in both systems since last sync):
1. Apply the resolution rule above
2. Log to `glofox_sync_conflicts` table
3. Surface unresolved conflicts in the admin dashboard

---

## Phase 3: Transition Period (Weeks 4-6)

### 3.1 Shadow Mode (Week 4)

**Goal:** Validate sync accuracy without affecting operations.

- Enable inbound sync (Glofox → Meridian) on all entities
- Outbound sync DISABLED — Meridian is read-only mirror
- Staff continues using Glofox as normal
- Compare Meridian data against Glofox daily (automated integrity checks)

**Integrity check queries:**
```sql
-- Members count match
SELECT
  (SELECT count(*) FROM members WHERE studio_id = X AND glofox_id IS NOT NULL) as meridian_count,
  -- Compare against Glofox API total_count from /2.0/members response

-- Bookings for today match
SELECT
  (SELECT count(*) FROM bookings b JOIN classes c ON b.class_id = c.id
   WHERE c.starts_at::date = CURRENT_DATE AND b.glofox_id IS NOT NULL) as meridian_today,
  -- Compare against Glofox /2.2/branches/{id}/bookings?start_date=today
```

**Success criteria for Shadow Mode:**
- Member count within 1% of Glofox (allows for timing differences)
- All bookings from last 7 days present in both systems
- Transaction totals match within $1 per day
- Zero data corruption (no existing records overwritten incorrectly)

### 3.2 Parallel Mode (Weeks 5-6)

**Goal:** Both systems accept writes, bidirectional sync keeps them consistent.

- Enable outbound sync (Meridian → Glofox)
- Staff can use EITHER system for bookings, check-ins, profile edits
- New features only in Meridian (automations, AI insights, campaigns)
- Conflict resolution active

**Staff training checklist:**
- [ ] Show staff how to book/check-in from Meridian
- [ ] Show the sync status dashboard (new admin page)
- [ ] Explain which actions sync back to Glofox
- [ ] Establish that Meridian will become primary

**Monitoring dashboard (new admin page):**
- Last sync time per entity type
- Records synced in last hour/day
- Active conflicts needing resolution
- Error count and last error message

---

## Phase 4: Cutover (Weeks 7-8)

### 4.1 Pre-Cutover Checklist

- [ ] All existing Glofox members have `glofox_id` mapped in Meridian
- [ ] 14+ days of parallel mode with zero data integrity issues
- [ ] Staff comfortable with Meridian for daily operations
- [ ] All member-facing features ready (booking portal, app)
- [ ] Stripe merchant account set up and tested
- [ ] Payment migration plan executed (see 4.3)
- [ ] Rollback plan tested

### 4.2 Cutover Sequence

**Day 0 (Sunday night — lowest traffic):**

1. **22:00** — Freeze Glofox: disable new bookings/purchases in Glofox
2. **22:15** — Run final full sync (Glofox → Meridian)
3. **22:30** — Verify final sync integrity (member counts, booking counts, transaction totals)
4. **23:00** — Switch DNS: member-facing URLs point to Meridian
5. **23:15** — Enable Stripe payment processing in Meridian
6. **23:30** — Smoke test: test booking, test check-in, test payment
7. **00:00** — Go live: Meridian is now primary

**Day 1 (Monday):**
- Keep Glofox inbound sync running (read-only, for safety)
- Monitor all operations closely
- Staff uses Meridian exclusively

**Day 7:**
- If no issues: disable Glofox sync
- Keep Glofox account active for 30 days (historical reference)

**Day 30:**
- Archive Glofox data export
- Cancel Glofox subscription

### 4.3 Payment Migration (Critical Path)

This is the riskiest step. Payments cannot have a gap.

**Pre-cutover (Week 6):**
1. Create Stripe account (already done ✅)
2. For each active member with a recurring subscription:
   - Create Stripe Customer
   - Collect payment method (card) via Meridian member portal
   - Create Stripe Subscription (set to start on their next billing date)
3. Verify all Stripe subscriptions are created correctly
4. Test one billing cycle on Stripe sandbox

**Cutover night:**
- Glofox stops processing payments (freeze)
- Stripe starts processing on next billing cycle
- Members with credits/packs: no change needed (credits are in Meridian DB)

**Fallback:** If Stripe payments fail for any member, manually process via Glofox for that member while debugging.

### 4.4 Rollback Plan

**If critical issues during cutover:**

| Timeframe | Action |
|-----------|--------|
| Within 1 hour of cutover | Revert DNS, re-enable Glofox, disable Stripe. Run reverse sync (Meridian → Glofox for any new bookings). |
| Within 24 hours | Same as above + email members about temporary system switch |
| After 24 hours | Partial rollback not recommended. Fix forward. Keep both systems running in parallel until resolved. |

**Data rollback:**
- Supabase has point-in-time recovery (PITR)
- Take a manual backup snapshot before cutover
- Glofox data is intact (we never delete from Glofox, only write back)

---

## Phase 5: Post-Cutover Cleanup (Week 9+)

1. Disable all Glofox sync functions
2. Remove `GLOFOX_API_TOKEN` and `GLOFOX_API_KEY` from env vars
3. Archive `glofox_sync_state` and `glofox_sync_conflicts` tables
4. Keep `glofox_id` columns for historical reference
5. Update member classification logic to use Stripe subscription status instead of Glofox
6. Run engagement status backfill with clean Stripe data
7. Cancel Glofox subscription

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Glofox API rate limiting | Medium | High — sync fails | Implement exponential backoff, batch requests, cache responses |
| Payment gap during cutover | Low | Critical | Overlap period where both can process, manual fallback |
| Data conflict during parallel mode | High | Medium | Per-field conflict resolution, conflict dashboard, audit log |
| Glofox API downtime | Low | Medium | Sync engine retries, degraded mode (show cached data) |
| Staff resistance to new system | Medium | Medium | Training, parallel mode gives time to adapt |
| Member payment method collection | Medium | High | Start collecting Stripe payment methods 2 weeks before cutover |
| Glofox revokes API access | Low | Critical | Full data export before starting, PITR backup |
| Schema migration breaks existing features | Low | High | Run on Supabase branch first, test all 229 tests |

---

## Testing Strategy

### Before Phase 2 (Schema)
- Run all 229 existing tests after schema migration (no test should break — all new columns are nullable/have defaults)

### Phase 2 (Sync Engine)
- Unit tests for ID mapping logic
- Unit tests for conflict resolution rules
- Integration tests: mock Glofox API → verify Supabase records created correctly
- Integration tests: create Supabase record → verify Glofox API called correctly

### Phase 3 (Transition)
- Daily automated integrity checks (counts, sums, spot checks)
- Manual spot-check 10 random members per day
- Verify booking ↔ Glofox booking status consistency

### Phase 4 (Cutover)
- Dry run cutover on staging (Supabase branch + Netlify preview deploy)
- Payment flow end-to-end test with real Stripe test mode
- Rollback drill

---

## Timeline Summary

| Week | Phase | Key Activities |
|------|-------|---------------|
| 1 | Schema Prep | Migrations, new columns, sync tables, API credentials |
| 2-3 | Sync Engine | Build API client, inbound sync, outbound sync, conflict resolution |
| 4 | Shadow Mode | Inbound sync live, validate accuracy, fix issues |
| 5-6 | Parallel Mode | Bidirectional sync, staff training, payment method collection |
| 7-8 | Cutover | Final sync, DNS switch, Stripe activation, monitoring |
| 9+ | Cleanup | Disable Glofox, archive, cancel subscription |

---

## Open Questions for Zach

1. **Glofox API credentials** — Do you have the `x-glofox-api-token` and `x-api-key` yet? Or do we need to request them?
2. **API rate limits** — Did Glofox specify any rate limits? (The docs don't mention them)
3. **Branch ID** — What's your Glofox branch MongoDB ObjectID? (Visible in Glofox admin URL)
4. **Payment timeline** — How soon do you want to move payments to Stripe? This can be decoupled from the data migration if needed.
5. **Staff readiness** — How many staff need training? Is there a preferred training approach?
6. **Member communication** — Do you want to notify members about the system change? When?
