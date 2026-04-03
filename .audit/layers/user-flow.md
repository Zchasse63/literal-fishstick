# User Flow Audit Report

**Agent**: user-flow
**Model**: claude-sonnet-4-6
**Timestamp**: 2026-04-02T00:00:00Z

---

## Scope

- **Pages examined**: 48 admin pages, 9 employee pages, 2 auth pages, 1 public page (60 total)
- **Navigation surfaces**: Admin sidebar, employee sidebar, breadcrumb system, in-page links
- **Flows traced**: Authentication, member management, booking/schedule, campaign builder, automation builder, lead pipeline, employee clock-in, payroll, promo codes
- **Cross-references**: API surface audit findings (missing promo code, waitlist, gift card, check-in history routes), project structure audit (orphaned directories)
- **Framework**: Next.js 16 App Router, route groups `(admin)`, `(employee)`, `(auth)`, middleware-based auth guard

---

## Executive Summary

The overall navigation graph is well-structured with a coherent sidebar, consistent back-link patterns, and clear breadcrumbs. The happy paths for core workflows — viewing members, browsing the schedule, reading analytics, and employee clock-in — function end-to-end with live Supabase data. However, several flows are **partially broken**: they present UI that invites user action but cannot complete the action because either the target page does not exist (404 dead links) or the UI component does not call any API (state-only mutations). The most impactful broken flows are the campaign launch path (the final "Send Campaign" button has no API call), the automation save path (same), and two "new" creation pages linked from navigation that 404. The employee portal has seven empty orphan directories that create 404 paths if directly accessed, though none are navigated to by the live sidebar. Authentication is complete and correct for the happy path but lacks any role-based routing boundary, meaning any authenticated user — regardless of role — can reach all 48 admin pages with no access check.

---

## Findings by Severity

---

### CRITICAL

---

#### UF-C-1: Campaign Builder "Send Campaign" Button Has No API Call

**Pages**: `/marketing/campaigns/new` (line 1343), `/marketing/campaigns/[id]` (similar pattern)

The 3-step campaign builder (Setup → Content → Review) is fully implemented with rich UI including A/B test configuration, scheduling options, and a test send button. However, the final "Send Campaign" / "Schedule Campaign" button on step 3 is a plain `<button>` with no `onClick` handler:

```tsx
<button
  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 text-white ..."
>
  <Send className="h-4 w-4" />
  {scheduleMode === 'schedule' ? 'Schedule Campaign' : 'Send Campaign'}
</button>
```

There is no `fetch('/api/campaigns', { method: 'POST', ... })`, no `router.push()`, and no success/error state. Clicking this button does nothing. The "Save as Draft" buttons (present twice in the UI — in the header and in the footer navigation) are also non-functional with the same pattern.

**Impact**: The entire campaign creation flow is a visual prototype. Admins cannot launch or save any new campaign. The `POST /api/campaigns` endpoint exists in the API surface and is functional, but is never called by the UI.

**Affected user journey**: Admin → Marketing → Campaigns → New Campaign → completes 3 steps → clicks Send → nothing happens.

---

#### UF-C-2: Automation Builder "Save & Activate" Button Has No API Call

**Page**: `/marketing/automations/new`

The ReactFlow-based automation builder allows users to construct multi-step flows with triggers, email/SMS steps, delays, and conditions. The header presents two action buttons:

```tsx
<button className="...">
  <Save className="h-4 w-4" />
  Save Draft
</button>
<button className="...">
  <Play className="h-4 w-4" />
  Save & Activate
</button>
```

Neither button has an `onClick` handler or any `fetch` call. Searching the entire file for `fetch(`, `supabase.from(`, and `POST` returns zero results. The flow nodes and edges exist only in React state and are never persisted.

**Impact**: Any automation flow built by an admin is lost on page navigation. The `POST /api/automations` endpoint exists; the UI never reaches it. This is the highest-value feature in the Marketing module and it cannot be saved.

---

### HIGH

---

#### UF-H-1: Two "New" Pages Are Linked but Do Not Exist (404 Dead Links)

**Broken links**:
- `/revenue/products/new` — linked from `/revenue/products` ("+ Add Product" button at line 210)
- `/analytics/pricing/new` — linked from `/analytics/pricing` ("+ New Simulation" button at lines 144 and 377)

Both targets have no `page.tsx` file. Next.js App Router will serve a 404 (the global `not-found.tsx`). The `not-found.tsx` page does not link back to the originating page or provide recovery navigation, so users who click these buttons land on a 404 with no obvious path back except the browser's back button.

**Evidence**:
```
/apps/web/src/app/(admin)/revenue/products/new/   — directory does not exist
/apps/web/src/app/(admin)/analytics/pricing/new/  — directory does not exist
```

**Impact for /revenue/products/new**: The product creation flow is completely broken. Admins cannot create new merchandise products via the UI. The `POST /api/products` API route exists and is functional.

**Impact for /analytics/pricing/new**: New pricing simulations cannot be initiated. Existing simulations can still be viewed at `/analytics/pricing/[id]`.

---

#### UF-H-2: No Role-Based Routing in Middleware or Layout — Any Authenticated User Reaches All Admin Pages

**File**: `apps/web/src/middleware.ts`

The middleware validates authentication (session exists) but performs no role check. Once authenticated, any user — regardless of whether their `roles` array contains `"admin"`, `"trainer"`, `"member"`, or any other value — can navigate to all 48 admin pages.

The `AuthContext` computes `isAdmin`, `isTrainer`, and `isMember` flags but no page or layout reads these flags to gate access. The `Sidebar` renders the same 10 nav items for all roles.

**Impact**: A trainer who also has a member account (a defined use case in the CLAUDE.md) would see the full admin dashboard. A former member whose account wasn't deactivated after staff departure retains admin navigation access. The API layer provides partial protection via `requireRole()` on some routes, but the frontend presents no indication of access levels.

**Note**: This is intentional for the current single-operator deployment where all users are staff. It becomes a real issue when the platform is sold as SaaS with studio members who share the same Supabase instance.

---

#### UF-H-3: Login Success Redirect Always Goes to Root — Ignores Role

**File**: `apps/web/src/app/(auth)/login/page.tsx` (line 40)

After successful password authentication:

```tsx
router.push("/");
router.refresh();
```

The magic link callback at `/auth/callback` similarly defaults to `"/"`. There is no role check to route trainers to `/employee` vs. admins to `/`. Both user types land at the admin Command Center, which may confuse trainer-only users who should see the employee portal.

The employee portal (`/employee`) and admin portal (`/`) are separate route groups with separate layouts. There is no automatic routing based on role post-login.

---

#### UF-H-4: Employee Clock-in Page Uses Local State, Not API Calls

**Page**: `apps/web/src/app/(employee)/employee/clock/page.tsx`

The dedicated Clock In/Out page (`/employee/clock`) loads existing clock entries from Supabase on mount. However, the clock action buttons — Clock In, Clock Out, Start Break, End Break — only mutate local React state:

```tsx
const handleClockIn = () => {
  setClockStatus('clocked-in')
  setClockedInSince(new Date())
  setEntries(prev => [...prev, { ... }])
  // No fetch('/api/clock/...') call
}
```

There is no `fetch` call in any of the four handlers. The weekly summary section (`weeklyHours`, `weeklyOT`) is initialized at `0` and never populated from any data source.

The employee home page (`/employee`) uses a different code path — the `useClockAction` hook — which does make API calls. This creates a split: the home page clock button works; the dedicated clock page's buttons are decorative.

**Impact**: An employee who navigates to `/employee/clock` and uses its large, prominent interface will appear to clock in/out but no record is written to the database. Their timesheet will show gaps for any session where they used the dedicated clock page instead of the home page widget.

---

#### UF-H-5: "Promotions" Member Profile Tab Is Populated But Has No Backend Data Source

**Page**: `apps/web/src/app/(admin)/members/[id]/page.tsx` (line 219)

The member detail page has a `ProfileTab` type that includes `'Promotions'` as a tab option. The tab system is defined but the API audit confirmed that there is no API route for promo code lookups or redemption history on a per-member basis. The tab content for "Promotions" renders empty because no data is fetched for it.

Additionally, the engagement leaderboard at `/engagement` renders `currentStreak: 0` and `referrals: 0` for all members with comments in the code explicitly noting these are not tracked:

```tsx
currentStreak: 0, // Not tracked in members table
referrals: 0,     // Not tracked in members table
```

These fields are visible columns in the leaderboard UI, making the leaderboard display inaccurate data (everyone shows 0 streak).

---

### MEDIUM

---

#### UF-M-1: "Save as Draft" on Campaign Builder Is Non-Functional

The campaign builder (`/marketing/campaigns/new`) has a "Save as Draft" button in both the top header and in the step navigation footer. Neither has an `onClick` handler. This is related to UF-C-1 but specifically affects the draft save path, which users might click at any point during a multi-step flow. A user who builds a campaign over multiple sessions has no way to preserve progress.

---

#### UF-M-2: Settings Sub-Pages Are Not Linked From the Settings Page

**Pages affected**: `/settings/sms`, `/settings/geofence`

The main settings page (`/settings`) does not contain any links to `/settings/sms` or `/settings/geofence`. These pages are only accessible via direct URL or via the sidebar (which does not list them). The breadcrumb map in `AdminLayout` does define them (`'/settings/sms': 'Settings > SMS Configuration'`), but no page navigates to them.

The geofence settings page does link back to `/settings` ("← Settings" link), but there is no inbound navigation from the settings page itself.

**Impact**: SMS configuration and geofence radius configuration are effectively orphaned from the main settings flow. A new admin would not discover them through normal navigation.

---

#### UF-M-3: Trainer Link in Analytics Report Points to Member Profile (Wrong Page)

**Page**: `apps/web/src/app/(admin)/analytics/reports/[id]/page.tsx` (line 444)

In the class attendance report table, the trainer name is a hyperlink:

```tsx
<Link href={`/members/${row.trainerId}`}>
  {row.trainer}
</Link>
```

This navigates to the member detail page (`/members/[id]`) using the trainer's profile ID. This will work if the trainer is also a member (which is a common Meridian use case), but it semantically opens the wrong page. A trainer detail page exists at `/analytics/trainers/[id]` — the link should point there instead.

---

#### UF-M-4: Lead Convert-to-Member Flow Missing Membership Assignment Step

**Page**: `apps/web/src/app/(admin)/marketing/leads/[id]/page.tsx`

The lead detail page has a full "Convert to Member" panel that calls `POST /api/leads/{id}/convert`. On success, it displays a success state with a "View Member Profile" button that navigates to `/members/{newMemberId}`. This path works end-to-end.

However, the conversion creates a member profile with no membership plan assigned. There is no step in the convert panel to select a membership type or plan. The new member profile will exist in the members table with `membership_status: null` or a default, and will immediately show as "at-risk" in the member directory.

**Impact**: Converted leads require a second manual step (opening the member profile, then assigning a plan via the membership upgrade UI) before they have an active membership. This is not discoverable from the success confirmation.

---

#### UF-M-5: Employee Portal Trainer-Specific Pages Shown to All Employees

**File**: `apps/web/src/app/(employee)/layout.tsx`

The employee sidebar renders trainer-specific navigation items (My Classes, Performance, Promo Code) for all authenticated users unconditionally. The layout does read `profile?.roles` but uses it only for the display label ("Trainer" vs "Employee"), not to hide the trainer nav section.

A front-desk employee or non-trainer staff member sees "My Classes", "Performance", and "Promo Code" links. Clicking them loads pages that call `useEmployeeProfile()` → `useEmployeeClasses(trainer?.id)`. If `trainer?.id` is null (non-trainer), the hook returns empty data. The pages render empty states with no explanation of why there is no data.

---

#### UF-M-6: No Redirect from /employee for Non-Employee Admin Users

The admin sidebar at `/` has a "Switch to Admin" footer link from the employee portal. The reverse path — an admin accidentally visiting `/employee` — is not redirected. Any authenticated user can access `/employee` and the employee portal layout/sidebar. An admin who types `/employee` directly gets the employee home page.

---

#### UF-M-7: Engagement Page Achievements and Challenges Tabs Are Fully Static

**Page**: `apps/web/src/app/(admin)/engagement/page.tsx`

The Achievements tab renders `ACHIEVEMENTS` (a hardcoded array of 6 achievement types, all with `memberCount: 0`) and the Challenges tab renders `CHALLENGES` (3 hardcoded entries with `progress: 0`, `participants: 0`). Neither tab fetches any data from the database. The database does not have an achievements or challenges table based on the API surface audit.

The Leaderboard tab does fetch live data, but the streak and referral columns always display 0 for all members (see UF-H-5).

**Impact**: The Engagement module as a whole delivers partial value — leaderboard works, but half the page is hardcoded placeholder content presented as live data.

---

### LOW

---

#### UF-L-1: Login Page Has No "Forgot Password" Path

**Page**: `apps/web/src/app/(auth)/login/page.tsx`

The login page offers password sign-in and magic link. There is no "Forgot Password" link or flow. If a user has a password-based account and forgets their password, their only recovery path is the magic link (if they know this option exists) or contacting the studio admin directly.

For an admin-facing tool this is lower severity, but for trainer or employee accounts it creates a real friction point.

---

#### UF-L-2: Not-Found Page Has No Navigation

**File**: `apps/web/src/app/not-found.tsx`

The global 404 page exists but does not contain any navigation links. Users who land on a 404 (e.g., via the broken `/revenue/products/new` link or any mistyped URL) have no UI option to navigate back — they must use the browser back button or manually type a URL.

---

#### UF-L-3: "New Code" Button in Revenue Promo Section Has No Handler

**Page**: `apps/web/src/app/(admin)/revenue/page.tsx` (line 643)

The Memberships tab of the Revenue page contains a "Trainer Promo Codes" section with a "+ New Code" button:

```tsx
<button className="px-3.5 py-2 bg-indigo-600 text-white ...">
  <Tag className="w-3.5 h-3.5" />
  New Code
</button>
```

This button has no `onClick` handler and no associated flow. Promo codes are assigned to trainers in the Operations page, not created here. The button is a dead end.

---

#### UF-L-4: API Key "Reveal" and "Generate" Buttons Are Non-Functional

**Page**: `apps/web/src/app/(admin)/settings/page.tsx` (lines 794–814)

The Settings → Integrations → API Keys section shows production and test keys (masked) with "Reveal" and "Generate New API Key" buttons. None have `onClick` handlers. The API key management is entirely presentational — there is no underlying key management API.

---

#### UF-L-5: Geofence "Allow Location Access" Button Has No Real Geolocation Call

**Page**: `apps/web/src/app/(employee)/employee/clock/page.tsx` (line 365)

The geofence verification section includes a "Allow Location Access" button:

```tsx
<button onClick={() => setLocationPermission('granted')}>
  Allow Location Access
</button>
```

This only updates local state — it does not call `navigator.geolocation.getCurrentPosition()`. The `currentDistance` state remains at `0` (initialized value), so the distance display always shows "0m" and the "within radius" check always passes (0 ≤ geoRadius). Geofence verification is entirely simulated.

**Impact**: Clock-in geofencing does not function. Any employee can clock in from anywhere and the system reports them as "At Studio". This undermines the operational integrity of the clock-in system.

---

#### UF-L-6: QR Code Placeholder in Employee Promo Page

**Page**: `apps/web/src/app/(employee)/employee/promo/page.tsx` (line 116)

The promo code hero card contains a QR code placeholder:

```tsx
<div className="w-32 h-32 rounded-xl bg-white/20 ...">
  <QrCode className="w-12 h-12 text-white/60 mb-1" />
  <span className="text-[10px] ...">QR Code</span>
</div>
```

No QR code is generated. The `QRCode` package is installed in `package.json` and the API route `/api/qr` exists for QR generation, but the promo page never calls it.

---

#### UF-L-7: Breadcrumb Map Missing Several Valid Pages

**File**: `apps/web/src/app/(admin)/layout.tsx`

The `breadcrumbs` record in `AdminLayout` is missing entries for several real pages:
- `/analytics/dashboards/executive`
- `/analytics/dashboards/growth`
- `/analytics/dashboards/operations`
- `/marketing/content/new`
- `/marketing/content` (listed but not `/marketing/content/new`)
- `/analytics/trainers/[id]` (dynamic, not in the map)

These pages fall through to the `"Meridian"` default breadcrumb, showing no contextual location information.

---

## User Journey Analysis

### Journey 1: Admin Creates and Sends a Campaign

| Step | Page | Status | Notes |
|------|------|--------|-------|
| 1. Navigate to Marketing | `/marketing` | Working | Shows campaign list, recent sends |
| 2. Click "New Campaign" | `/marketing/campaigns/new` | Working | Page loads |
| 3. Complete Step 1 — Setup | | Working | Campaign name, channel, segment load from DB |
| 4. Complete Step 2 — Content | | Working | AI suggestions load, templates work |
| 5. Complete Step 3 — Review | | Working | Summary renders correctly |
| 6. Click "Send Campaign" | | **BROKEN** | Button has no onClick — nothing happens |
| 6a. Click "Save as Draft" | | **BROKEN** | Same — no handler |

**Outcome**: The flow cannot be completed. The campaign builder is a UI-only prototype.

---

### Journey 2: Admin Adds a New Member

| Step | Page | Status | Notes |
|------|------|--------|-------|
| 1. Navigate to Members | `/members` | Working | Live Supabase data |
| 2. Click "+ Add Member" modal | `/members` | Working | Modal opens, form renders |
| 3. Submit the form | `/api/members` POST | Working | API route exists and functions |
| 4. View new member profile | `/members/[id]` | Working | Live data loads |
| 5. Assign membership plan | In-page upgrade flow | Working | Plan upgrade calls API |

**Outcome**: This journey is complete end-to-end.

---

### Journey 3: Admin Creates a Pricing Simulation

| Step | Page | Status | Notes |
|------|------|--------|-------|
| 1. Navigate to Analytics → Pricing | `/analytics/pricing` | Working | Lists existing simulations |
| 2. Click "+ New Simulation" | `/analytics/pricing/new` | **BROKEN — 404** | Page does not exist |

**Outcome**: Flow dead-ends immediately at step 2. Cannot be recovered without browser back button.

---

### Journey 4: Employee Clocks In

| Step | Page | Status | Notes |
|------|------|--------|-------|
| 1. Load Employee Home | `/employee` | Working | Clock status loads from API |
| 2. Click Clock In button (home page) | `useClockAction` hook | Working | Calls `POST /api/clock/in` |
| 3. Navigate to Clock page | `/employee/clock` | Working | Page loads, shows today's entries from DB |
| 4. Click Clock Out (clock page) | Local state only | **BROKEN** | No API call — DB not updated |
| 5. Navigate back to home | `/employee` | Desynced | Home page shows still clocked in |

**Outcome**: The dedicated clock page and the home page widget are desynchronized. Using the clock page's buttons creates a false record in local state only.

---

### Journey 5: Admin Converts a Lead to Member

| Step | Page | Status | Notes |
|------|------|--------|-------|
| 1. Navigate to Leads | `/marketing/leads` | Working | Live data |
| 2. Click lead row | `/marketing/leads/[id]` | Working | Detail page loads |
| 3. Click "Convert to Member" | Panel opens | Working | UI renders correctly |
| 4. Confirm conversion | `POST /api/leads/{id}/convert` | Working | API call executes |
| 5. Success state | Shows "View Member" link | Working | Routes to `/members/{id}` |
| 6. New member has no plan | `/members/{id}` | Warning | `membership_status` is null, no plan assigned |

**Outcome**: Mostly complete. Missing plan assignment step post-conversion.

---

### Journey 6: Trainer Views and Shares Promo Code

| Step | Page | Status | Notes |
|------|------|--------|-------|
| 1. Login as trainer | `/login` | Working | Lands on `/` (admin) not `/employee` |
| 2. Navigate to employee portal | Manual URL or sidebar | Working | No auto-route |
| 3. Click "Promo Code" | `/employee/promo` | Working | Code loads from DB |
| 4. Click "Copy Code" | Clipboard API | Working | Copies promo code |
| 5. Share via QR Code | Placeholder UI | **BROKEN** | No QR code generated |

**Outcome**: Functional for the core use case (viewing and copying the code). QR sharing is non-functional.

---

## Entry Point Mapping

| Entry Point | URL | Auth Required | Notes |
|---|---|---|---|
| Password login | `/login` | No | Works; lands on `/` regardless of role |
| Magic link initiation | `/login` (magic-link mode) | No | Works; sends OTP email |
| Magic link callback | `/auth/callback?code=...` | No | Works; validates code and redirects |
| Admin dashboard | `/` | Yes | Protected by middleware |
| Employee portal | `/employee` | Yes | Protected; no role guard |
| Email unsubscribe | `/unsubscribe/[token]` | No | Public; token-based |
| Inngest webhook | `/api/inngest` | No (signing key) | Background job entry |
| Stripe webhook | `/api/webhooks/stripe` | No (signature) | Payment events |
| Lead capture form | `/api/leads/capture` | No | Public embed endpoint |

**Missing entry points**:
- No password reset flow
- No first-time account setup flow
- No studio onboarding wizard
- No OAuth / SSO provider flow (only password + magic link implemented)

---

## Authentication Flow Analysis

### What Works

- Password sign-in via `supabase.auth.signInWithPassword()` — complete
- Magic link via `supabase.auth.signInWithOtp()` — complete
- Auth callback code exchange — complete with open-redirect protection
- Middleware session validation on every request — complete
- Session auto-refresh via `updateSession()` in middleware — complete
- Sign out via `supabase.auth.signOut()` + `window.location.href = '/login'` — complete
- Unauthenticated API requests return `401 JSON` (not a redirect) — correct behavior

### What Is Missing or Broken

1. **No redirect-to-login after session expiry for page routes.** The middleware redirects unauthenticated users to `/login?redirect={pathname}`. However, if a session expires while the user is on a page (not making a navigation request), the client-side `AuthContext` will update `user` to `null` but no automatic redirect occurs. The user sees the page with empty/loading state until they manually navigate or refresh.

2. **Auth callback failure path is minimal.** If `exchangeCodeForSession` fails (expired code, reused link), the callback redirects to `/login` with no error message. The login page has no mechanism to display an error from the callback.

3. **No post-login role routing.** Password sign-in always pushes to `"/"`. A trainer logging in with a password will land on the admin Command Center, not the employee portal.

4. **`?redirect=` parameter preserved in magic link flow but not in password flow.** The magic link `emailRedirectTo` uses `window.location.origin + '/auth/callback'` without the `?redirect=` param from the original middleware redirect. A user who was redirected from `/marketing/campaigns` to `/login` and then uses magic link will land at `/` after auth, not at the original page.

---

## State Transition Analysis

### Booking Lifecycle

States: `confirmed` → `checked_in` → `no_show` (terminal) / `waitlisted` → `confirmed`

The schedule page loads and displays all booking states. The attendee list in the class detail panel shows check-in status with correct color coding. Check-in can be triggered from the schedule UI. Waitlisted members show correctly.

**Gap**: There is no UI path to manually move a member from `waitlisted` to `confirmed` in the admin schedule view. The `POST /api/cron/waitlist-promote` exists for automated promotion, but manual admin promotion is not surfaced in the UI.

### Campaign Lifecycle

States: `draft` → `scheduled` → `sent` | `active`

The campaign list at `/marketing/campaigns` and the campaign detail at `/marketing/campaigns/[id]` both display campaign status correctly, loading live Supabase data. The `[id]` page also implements state transitions (pause, duplicate, schedule winner for A/B tests) that call the appropriate API routes.

**Gap**: The `new` campaign creation path (UF-C-1) cannot transition out of local state into any database state.

### Event Lifecycle (Corporate)

States: `inquiry` → `quoted` → `confirmed` → `deposit_paid` → `completed` → `invoiced` → `paid`

The event detail page (`/corporate/events/[id]`) shows the full state machine with a horizontal progress tracker and a "Move to Next Stage" button that calls `PATCH /api/events/{id}/status`. This is one of the most complete state machine implementations in the application.

### Membership Status

States: `active` → `paused` → `cancelled` (implied)

Member detail page shows status correctly. Plan upgrade flow calls the API. Paused status renders in the member directory filter. No UI for re-activating a paused membership or cancelling was observed in the pages reviewed.

---

## Dead-End Detection

| Page | Dead-End Type | Severity |
|---|---|---|
| `/revenue/products/new` | 404 — page does not exist | HIGH |
| `/analytics/pricing/new` | 404 — page does not exist | HIGH |
| `not-found.tsx` | No outbound navigation | LOW |
| Campaign builder step 3 | Send button has no handler | CRITICAL |
| Automation builder | Save/Activate buttons have no handlers | CRITICAL |
| `/engagement` Achievements tab | Static data, no creation path | MEDIUM |
| `/engagement` Challenges tab | Static data, no creation path | MEDIUM |
| Revenue page "New Code" button | No handler | LOW |
| Settings page "Reveal"/"Generate API Key" | No handler | LOW |

---

## Missing Backend Support for UI Features

These UI elements reference features for which the API audit confirmed no API route exists:

| UI Feature | Page | Missing API | Impact |
|---|---|---|---|
| Gift card balance display | Revenue page transaction filter includes "Gift Cards" | No `/api/gift-cards` route | Filter works but gift card management UI would have no backend |
| Trainer promo code redemption history | `/revenue` Memberships tab, promo code table shows "revenue" and "uses" columns | No `/api/promo-codes` route for aggregated stats | Columns would display 0 or empty |
| Check-in history on member profile | Member detail "History" tab | No `/api/members/{id}/checkins` route | Tab fetches from `bookings` table only, not a dedicated check-in history |
| Waitlist manual promotion | Schedule attendee list shows waitlisted status | No `POST /api/waitlists/promote` (only cron route) | Admins cannot manually promote waitlisted members from the UI |
| Trainer public profiles | Referenced in CLAUDE.md for member-facing surfaces | No `/api/trainers/{id}/public` route | Phase 5 dependency, not yet needed |
| QR code on promo page | `/employee/promo` | `/api/qr` exists but is not called | Promo QR code placeholder never generates a real code |

---

## Cross-Module Flow Analysis

### Member → Booking → Payment

- Member detail page links to booking history (from `bookings` table) — working
- Booking records show class title and status — working
- Transaction history on member profile loads from `transactions` table — working
- No direct UI to create a new booking on behalf of a member from the member detail page; admin must use the schedule page

### Lead → Member → Revenue

- Lead conversion creates member profile — working (see Journey 5)
- Member profile links to transaction history — working
- Promo code attribution from trainer referral tracked in `promo_attributions` table and shown in employee promo page — working
- Gap: no direct cross-link from a member profile to the lead it was converted from

### Campaign → Segment → Member

- Campaign builder loads smart segments from `smart_segments` table for recipient selection — working
- Segments page at `/segments` manages segment definitions — working
- Campaign send (once fixed) would use segment membership to determine recipients
- No direct link from a sent campaign's report back to the member profiles of who clicked/opened

---

## Orphaned Pages and Directories

### Empty Orphan Directories (Employee Portal)

Seven directories exist inside `(employee)` at the root level with no `page.tsx`:

```
(employee)/classes/
(employee)/pay/
(employee)/performance/
(employee)/profile/
(employee)/promo/
(employee)/schedule/
(employee)/timesheets/
```

These are not in the Next.js routing graph (they contain no files) and no navigation links point to them. They are likely filesystem artifacts from a reorganization where pages were moved into the `(employee)/employee/` nested path. They pose no user-facing risk but may cause confusion during development.

### Orphaned Library Modules (No API Route)

From the project structure audit, these AI library modules have no corresponding API route and thus no UI can trigger them:
- `lib/ai/cross-sell.ts`
- `lib/ai/pricing-analyzer.ts`
- `lib/ai/seasonal-predictor.ts`
- `lib/ai/report-narrative.ts`
- `lib/ai/trainer-comparison.ts`

---

## Error Recovery Analysis

| Failure Scenario | What User Sees | Recovery Path |
|---|---|---|
| API call fails on schedule page | No visible error — data doesn't load, skeletons persist or empty state shows | None — no retry button |
| Magic link expired or invalid | Redirected to `/login` with no error message | Must request new magic link — but nothing on login page indicates why they're there |
| Member not found at `/members/[id]` | "Member not found." text with back link | Back to member list via Link |
| Form validation error in "Add Member" modal | Field-level validation messages | Correct — user can fix and resubmit |
| Campaign send fails (when implemented) | Not applicable — button has no handler | N/A |
| Lead conversion API fails | `convertError` state shown in panel | Retry button available in convert panel |
| Corporate account creation fails | `router.push('/corporate')` on success only; on error, error state is shown | Correct |

The most consistent gap is that API fetch failures (GET requests on page load) typically show a persistent loading state or empty state with no error message and no retry mechanism.

---

## Navigation Graph Summary

**Total pages**: 60 (48 admin + 9 employee + 2 auth + 1 public)

**Pages with inbound navigation**: 55
**Pages with no inbound navigation from any other page** (accessible only by direct URL or sidebar):
- `/settings/sms` — not linked from settings page
- `/settings/geofence` — not linked from settings page
- `/docs/api` — sidebar entry, not linked from any content page
- `/unsubscribe/[token]` — email link only
- `/employee/clock` — sidebar link only, not linked from employee home despite being related

**Links pointing to missing pages (404)**:
- `/revenue/products/new` (1 link, from products page)
- `/analytics/pricing/new` (2 links, from pricing page)

**Diagrams**: `/Users/zach/Desktop/literal-fishstick/.audit/diagrams/user-flow.mmd`

---

## Recommendations by Priority

### Immediate (Block-Level)

1. **Wire up campaign send button** — The `POST /api/campaigns` and `POST /api/campaigns/{id}/send` routes exist. Add `onClick` to the Send Campaign button that calls these routes, handles loading state, and redirects to the campaign detail on success.

2. **Wire up automation save button** — `POST /api/automations` exists. Serialize ReactFlow nodes/edges to the request body. Redirect to `/marketing/automations/{id}` on success.

3. **Create `/revenue/products/new`** — A product creation page with the standard form (name, price, category, inventory count) calling `POST /api/products`. The pattern is identical to `/corporate/new`.

4. **Create `/analytics/pricing/new`** — A simulation creation form calling `POST /api/pricing-simulator`. Can be as simple as name + description fields to start.

### High Priority

5. **Role-based post-login redirect** — Check `profile.roles` after sign-in and route trainers/employees to `/employee`, admins to `/`.

6. **Fix clock page action handlers** — Replace local state mutations in `handleClockIn`, `handleClockOut`, `handleStartBreak`, `handleEndBreak` with calls to `POST /api/clock/in`, `POST /api/clock/out`, etc. Sync with the `useClockAction` hook pattern already used on the home page.

7. **Implement real geolocation** — Replace `setLocationPermission('granted')` with `navigator.geolocation.getCurrentPosition()`. Calculate `currentDistance` against studio coordinates from `geofence_locations`.

8. **Link settings sub-pages from settings page** — Add navigation cards or sidebar links to `/settings/sms` and `/settings/geofence` from the main `/settings` page.

### Medium Priority

9. **Add retry/error UI to page-load API failures** — Standardize on an error boundary or inline error component with a retry button for data-fetch failures.

10. **Fix magic link redirect preservation** — Pass `?redirect=` param through the magic link `emailRedirectTo` URL so users land on the originally requested page.

11. **Fix trainer link in attendance report** — Change `href={`/members/${row.trainerId}`}` to `href={`/analytics/trainers/${row.trainerId}`}` in `/analytics/reports/[id]/page.tsx`.

12. **Add membership plan assignment step to lead conversion** — After successful conversion, show a "Assign Plan" prompt or step before the "View Member" CTA.

13. **Generate real QR code on promo page** — Call `GET /api/qr?data={promoCode}` and render the response image.

14. **Hide trainer nav items from non-trainer employees** — Check `profile?.roles?.includes('trainer')` before rendering the trainer section in the employee layout.
