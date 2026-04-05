# Layer Report: User Flow

**Audit Date:** 2026-04-05
**Agent:** user-flow
**Severity Scale:** Critical / High / Medium / Low / Info

---

## Executive Summary

Meridian's admin dashboard has 10 top-level modules mapped to distinct user journeys. The primary flows (member management, revenue review, campaign creation, automation setup, class scheduling) are scaffolded and mostly functional. User flows are structured around a left sidebar with Cmd+1-0 shortcuts and drill-down navigation within each module.

Key flow issues: the Engagement module has a dead-end with placeholder data; the Analytics Executive Dashboard has a broken data path; the automation flow builder has no unsaved-changes protection; and the onboarding path for a new studio has no guided setup. The credit pack flow is entirely broken (empty table). There are no error state pages for common failures.

---

## Primary User Journeys

### Journey 1: Daily Studio Operations (Command Center)
1. Owner opens app → sees Command Center (/) with AI briefing, live metrics, schedule timeline
2. AI briefing fetched from `/api/ai/briefing` (30-minute cache)
3. Metrics: classes today, bookings, check-ins, revenue today, MRR
4. Revenue displayed from `daily_metrics` table — **KNOWN WRONG** (see DM-001)
5. Activity feed shows recent bookings, check-ins, member events

**Flow issue:** Revenue on the Command Center is incorrect. This is the first thing an owner sees daily.

### Journey 2: Member Management
1. Admin navigates to Members (/members) — client-side rendered, direct Supabase query
2. Search/filter by status, tier, tag
3. Click member → Member Detail (/members/[id]) — RSC, queries `member_360` view
4. Member detail shows: profile, membership, bookings history, transactions, credit packs, tags, AI health score
5. Admin can edit profile, add tags, upgrade/downgrade membership

**Flow issue:** Credit packs tab shows empty data (table never populated). Member's credit balance is always 0.

### Journey 3: Campaign Creation (Marketing)
1. Marketing → Campaigns → New Campaign
2. 5-step wizard: (1) Name/type, (2) Audience/segment, (3) Content/template, (4) Schedule, (5) Review/send
3. AI campaign copy available in step 3 via `/api/ai/campaign-copy`
4. A/B test variant splitting in step 3
5. Send executes via `/api/campaigns/send` (streaming SSE response)
6. Email tracking via Resend webhooks

**Flow issue:** Recipient count in step 2 does not account for unsubscribed/bounced members (see UX-005). User may see 200 recipients, then only 150 actually receive emails.

### Journey 4: Automation Flow Setup
1. Marketing → Automations → New Automation
2. Select trigger type from dropdown
3. Build flow visually using ReactFlow graph editor
4. Configure steps: email, wait, condition, tag, sms, update_field
5. Activate flow → evaluated every 10 minutes by Inngest

**Flow issue:** 6 new trigger types (`never_booked`, `classpass_repeat`, `one_and_done`, `cooling_off`, `plan_upgrade_candidate`, `class_type_fan`) cannot be saved — database CHECK constraint rejects them.

### Journey 5: Employee Clock-In/Out
1. Employee opens Employee Portal (/employee)
2. Clock widget on home page
3. Tap "Clock In" → triggers geofence check
4. On success: records time entry in database
5. Clock-out: records end time, calculates duration

**Flow status:** Functional based on test coverage.

### Journey 6: Engagement/Gamification (NEW - broken)
1. Admin navigates to Engagement (/engagement)
2. Sees leaderboard: member name, visits, streak, referrals, LTV, badge
3. Streak column: "--" (not tracked)
4. Referrals column: "--" (not tracked)

**Flow issue:** This module is a dead-end. Two of the four leaderboard metrics are always "--".

---

## User Flow Sequence Diagram (Primary: Member Onboarding + First Class)

```mermaid
sequenceDiagram
    participant ADMIN as Admin
    participant UI as Admin Dashboard
    participant API as API Routes
    participant DB as Supabase DB
    participant GLOFOX as Glofox API
    participant STRIPE as Stripe

    ADMIN->>UI: Navigate to Members > New Member
    UI->>API: POST /api/members
    API->>DB: INSERT profiles + members
    DB-->>API: member created

    API->>GLOFOX: registerMember (async write-back)
    Note over API,GLOFOX: Fire-and-forget; Glofox may fail silently

    ADMIN->>UI: Navigate to Revenue > Memberships
    UI->>API: POST /api/members/[id]/upgrade
    API->>STRIPE: createSubscription
    STRIPE-->>API: subscription.created
    API->>DB: UPDATE members (stripe_subscription_id)

    Note over STRIPE,DB: Stripe webhook fires async
    STRIPE->>API: POST /api/webhooks/stripe
    API->>DB: UPDATE members (membership_status=active)

    ADMIN->>UI: Navigate to Schedule > Book Class
    UI->>API: POST /api/bookings
    API->>DB: CHECK capacity (trigger), INSERT bookings
    API->>GLOFOX: createBooking (async write-back)

    ADMIN->>UI: Check In Member (QR scan or manual)
    UI->>API: POST /api/check-in
    API->>DB: UPDATE bookings (status=checked_in, attended=true)
    API->>DB: UPDATE members (total_visits++)
    API->>GLOFOX: markAttendance (async write-back)
```

---

## Findings

### HIGH-UF-001: Command Center revenue metrics display wrong data — first thing owner sees daily

**Severity:** High
**Location:** `apps/web/src/app/(admin)/page.tsx` (Command Center), `apps/web/src/app/api/analytics/daily-metrics/route.ts`

The Command Center displays revenue from `daily_metrics`. This table contains incorrect revenue data for all historical dates (see DM-001). The daily briefing AI also receives this wrong revenue context. Every day, the first screen the owner sees shows incorrect revenue figures.

**Recommendation:** As an immediate workaround, replace the Command Center revenue fetch with a direct `transactions` table query. The backfill of `daily_metrics` (DM-001) should resolve this long-term.

---

### HIGH-UF-002: New automation trigger types cannot be saved — create flow is broken for 6 types

**Severity:** High
**Location:** Automation create flow, `apps/web/src/app/api/automations/route.ts`

When an admin creates an automation with any of the 6 new trigger types, the database INSERT will fail with a constraint violation. The error may surface as a generic "Failed to save" message with no indication of which field is invalid. This is a silent failure mode from the user's perspective.

**Recommendation:** This is blocked by DM-003. Apply the schema migration to update the CHECK constraint. Additionally, add client-side validation that displays the available trigger types from a server-fetched enum, not a hardcoded client list.

---

### HIGH-UF-003: Credit pack flow is completely broken — members cannot see their credits

**Severity:** High
**Location:** Member detail → Credits tab, `/api/members/[id]` (credit_packs query)

A member with credit packs in Glofox will always see zero credits in Meridian. If they try to book using credits, the system will deny them based on incorrect data. This is a direct impact on member-facing functionality when the member portal is built in Phase 5.

**Recommendation:** Blocked by DM-002. Populate `credit_packs` via Glofox backfill.

---

### MEDIUM-UF-004: No error state pages — navigation errors show blank screens

**Severity:** Medium
**Location:** `apps/web/src/app/(admin)/` — no `error.tsx` files found

The App Router supports `error.tsx` files for each route segment to display friendly error states when an RSC page throws. None were found in the admin route directories. If a server component fails (e.g., Supabase connection timeout), the user sees a blank page or a raw Next.js error screen.

**Recommendation:** Add `error.tsx` files to at least the high-traffic pages: `/`, `/members`, `/members/[id]`, `/revenue`, `/analytics`.

---

### MEDIUM-UF-005: No new studio onboarding flow

**Severity:** Medium
**Location:** `apps/web/src/app/(auth)/` — only login + auth callback

There is no guided setup flow for a new studio. The login redirects directly to the Command Center. For a SaaS launch (Phase 4), a new studio would see an empty dashboard with no guidance on:
1. Connecting Glofox (or manually importing members)
2. Setting up Stripe
3. Configuring classes and schedule
4. Adding staff

**Recommendation:** Plan a studio onboarding wizard for Phase 4 that covers the minimum viable configuration steps. Track completion state in the `studios` table.

---

### LOW-UF-006: Engagement module is a navigational dead end for key metrics

**Severity:** Low
**Location:** `apps/web/src/app/(admin)/engagement/page.tsx`

The Engagement module is reachable via nav item (shortcut: Cmd+0). It shows a leaderboard where streak and referral columns display "--". There is no contextual explanation for why these fields are empty, no ETA, and no alternative action for the user. Users who navigate here will be confused.

**Recommendation:** Add a placeholder state card explaining these features are coming soon, or hide the streak/referral columns until the data pipelines are built.

---

### LOW-UF-007: No breadcrumb or back-navigation on deep detail pages

**Severity:** Low
**Location:** Member detail `/members/[id]`, Analytics drill-down pages

The admin layout has a `breadcrumbs` mapping for top-level routes. Deep pages like `/members/[id]` and `/analytics/trainers/[id]` need dynamic breadcrumbs (e.g., "Members > Jane Smith"). Static breadcrumbs do not handle dynamic IDs.

**Recommendation:** Implement dynamic breadcrumb generation for `[id]` segments using the page's server-fetched entity name.

---

### INFO-UF-008: Glofox write-back is fire-and-forget — failures are silent to admins

**Severity:** Info
**Location:** `apps/web/src/lib/glofox/client.ts` — `createBooking`, `markAttendance`, `cancelBooking`

Glofox write-back (creating bookings, marking attendance, cancelling bookings in Glofox when admins take action in Meridian) is fire-and-forget. Failures are logged to `glofox_write_status = 'failed'` on the relevant record, but there is no admin notification or retry mechanism exposed in the UI.

**Recommendation:** Surface Glofox sync failures in the admin UI — either a notification badge on the Glofox sync status page or a failed-writes count on the relevant list views.

---

## Summary Table

| ID | Severity | Category | Title |
|----|----------|----------|-------|
| HIGH-UF-001 | High | Data | Command Center shows wrong revenue — daily_metrics backfill needed |
| HIGH-UF-002 | High | Flow | 6 new automation trigger types fail on save |
| HIGH-UF-003 | High | Flow | Credit pack flow broken — members show zero credits |
| MEDIUM-UF-004 | Medium | UX | No error.tsx pages — failures show blank screens |
| MEDIUM-UF-005 | Medium | Product | No new studio onboarding flow for Phase 4 SaaS |
| LOW-UF-006 | Low | UX | Engagement module is dead-end with unexplained placeholder data |
| LOW-UF-007 | Low | UX | Dynamic breadcrumbs missing on detail pages |
| INFO-UF-008 | Info | Operations | Glofox write-back failures are silent — no admin notification |
