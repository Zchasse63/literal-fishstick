# Layer Report: User Flow (Comprehensive Audit)

**Audit Date:** 2026-04-05
**Agent:** user-flow
**Severity Scale:** Critical / High / Medium / Low / Info

---

## Executive Summary

Meridian has a well-structured navigation skeleton for an admin-focused SaaS product. The sidebar covers 10 of 11 modules, role-based routing at login is correct, and most deep pages have back navigation. However, several significant dead ends exist in the highest-traffic page (the Command Center), Settings is unreachable via the sidebar, the campaign save flow routes to the wrong parent page, and the Revenue module lacks any transaction drill-down. The Employee Portal is internally coherent, with a notable positive of a quick-toggle clock-in directly in the header bar.

Total admin routes: 51 page routes + 9 employee portal routes + 1 public unsubscribe route.

---

## 1. Entry Point Mapping

| Entry Point | URL | Role Routing | Notes |
|---|---|---|---|
| Direct login | `/login` | Password or magic link | Both modes on single page |
| Magic link callback | `/auth/callback` | Reads `profile.roles` | Correctly routes admin vs employee |
| Unauthenticated protected route | Any `/(admin)` or `/(employee)` route | Middleware redirects to `/login?redirect=<path>` | Redirect param preserved correctly |
| API unauthenticated | Any `/api/` route | Returns JSON `{ error: "Unauthorized" }` 401 | No redirect for API (correct) |
| Email unsubscribe | `/unsubscribe/[token]` | Public, no auth | Token-based, correct |
| Cron webhooks | `/api/cron/*`, `/api/webhooks/*` | Secret/signature verified, no user auth | Correct |

**Auth mechanics confirmed:** The middleware at `apps/web/src/middleware.ts` checks the session via Supabase SSR on every request. The login page at `apps/web/src/app/(auth)/login/page.tsx` supports both password and magic-link modes. After password sign-in, role-based routing runs client-side via `router.push()`. After magic-link, the callback route at `apps/web/src/app/(auth)/auth/callback/route.ts` performs the same role check server-side before redirecting.

**No signup flow exists.** Users are created by admins or imported from Glofox. There is no self-service registration page for admin/operator accounts. This is consistent with the B2B SaaS model but worth documenting as a deliberate gap.

**No password reset flow exists.** The login page offers "Sign in with Magic Link" as the fallback, which serves the same purpose, but there is no dedicated "Forgot password" route. Magic link is the recovery mechanism.

---

## 2. Navigation Structure

### Admin Sidebar (apps/web/src/components/layout/Sidebar.tsx)

The sidebar contains exactly 10 navigation items:

| Shortcut | Label | href | Page exists? |
|---|---|---|---|
| 1 | Command Center | `/` | Yes |
| 2 | Schedule | `/schedule` | Yes |
| 3 | Members | `/members` | Yes |
| 4 | Revenue | `/revenue` | Yes |
| 5 | Marketing | `/marketing` | Yes |
| 6 | Corporate | `/corporate` | Yes |
| 7 | Operations | `/operations` | Yes |
| 8 | Analytics | `/analytics` | Yes |
| 9 | Segments | `/segments` | Yes |
| 0 | Engagement | `/engagement` | Yes |

**Settings is not in the sidebar.** The `/settings` page and its sub-pages (`/settings/geofence`, `/settings/sms`) exist and are fully implemented, but there is no sidebar link, no header link, and no other navigational entry point to reach them from within the app. A user must know the URL directly or stumble upon a link from within the Settings page itself (which they cannot reach without already being there).

**The sidebar has no sign-out action when collapsed.** The logout button (LogOut icon) is rendered only when the sidebar is expanded (`!collapsed`). When the sidebar is collapsed to icon-only mode, the user has no visible way to sign out without expanding it first.

### Employee Portal Navigation (apps/web/src/app/(employee)/layout.tsx)

| Label | href | Page exists? | Role-gated? |
|---|---|---|---|
| Home | `/employee` | Yes | No |
| My Schedule | `/employee/schedule` | Yes | No |
| Timesheets | `/employee/timesheets` | Yes | No |
| Pay & Taxes | `/employee/pay` | Yes | No |
| My Profile | `/employee/profile` | Yes | No |
| My Classes | `/employee/classes` | Yes | Trainer section (not gated in code) |
| Performance | `/employee/performance` | Yes | Trainer section (not gated in code) |
| Promo Code | `/employee/promo` | Yes | Trainer section (not gated in code) |
| Switch to Admin | `/` (href) | — | No gate |

**Trainer-only nav items are shown to all employees.** The "Trainer" nav section (`My Classes`, `Performance`, `Promo Code`) is rendered unconditionally for all users of the employee portal. A non-trainer front desk employee sees these links even though the pages behind them will show trainer-specific data they do not own.

**The "Switch to Admin" link has no role check.** Any employee-portal user can click it and be taken to `/`, which is then protected by the admin layout's auth check — but the middleware does not block non-admin users from visiting admin routes. The `requireRole()` guard is at the API level, not the page level. A staff-only user landing on `/` (Command Center) will see the admin UI. The page itself does not enforce role on page load.

---

## 3. Flow-by-Flow Analysis

### 3.1 Daily Operator Flow

**Goal:** Login → Command Center → check schedule → check revenue → review members.

**Click path:**
1. `/login` — enter credentials → routed to `/`
2. `/` (Command Center) — AI briefing loads, hero metrics load (60s poll), class status board, activity feed
3. Sidebar shortcut `2` or click → `/schedule`
4. Sidebar shortcut `4` or click → `/revenue` → tab to `Overview` for MRR/ARPM
5. Sidebar shortcut `3` or click → `/members` → search/filter

**Can they do this without leaving the Command Center?**

Partially. The Command Center shows:
- Today's revenue (via `useKpiData`)
- Today's attendance and fill rate (via `useCommandCenterData`)
- Live class status board with current/upcoming classes
- An activity feed with recent check-ins, bookings, payments

However, the Command Center does not surface an actionable drill-down. Each of these sections is a dead end:

- **Activity feed items** — rendered as `div.cursor-pointer` with a hover style suggesting clickability, but there is no `onClick` handler and no `href`. Clicking an activity item does nothing. The user has visual affordance of interactivity but no actual navigation.
- **"View All" button on Class Status Board** — renders as a `<button>` with no `onClick` handler. Clicking does nothing. Presumably should link to `/schedule` but does not.
- **AI insight action buttons** — the "action" text (e.g., "Review Members") renders as a `<button>` with no `onClick` or `href`. These buttons appear after each AI insight card but have no routing logic.
- **Hero metric cards** — rendered as `div.cursor-pointer` with `hover:shadow-md` but no click handler. Implies drillability but does nothing.

**Click path to a specific member's profile from the Command Center:**

There is no direct path. The user must navigate to `/members`, then search for the member, then click their row. The activity feed does not link member names to their profiles. The timeline attendee pill tags (e.g., "Sarah M.") are plain spans, not links.

**Click path to today's revenue breakdown from the Command Center:**

The `Revenue Today` hero card shows today's revenue number but clicking it does nothing. The user must navigate to `/revenue`, where the `Overview` tab shows a 30-day revenue chart and the `Transactions` tab shows the transaction list. There is no "today only" filter pre-applied.

---

### 3.2 Member Management Flow

**Goal:** View member list → Search/filter → Click member → View profile → See activity/bookings/transactions.

**Click path:**
1. Sidebar → `/members`
2. Search box (client-side filter), status tabs (All, Active, At Risk, etc.)
3. Click member row → `/members/[id]`
4. Member profile tabs: Overview, History, Financials

**Can they see the member's purchase history?**

Yes. The member profile page at `/members/[id]` fetches up to 20 transactions from the `transactions` table and displays them in the `Financials` tab.

**Can they see when the member last visited?**

Yes. `last_visit` is shown in the profile header and formatted as "X days ago" / "Today" / "Yesterday". The `History` tab shows the last 20 bookings.

**Can they send the member an email from the profile?**

Partially. There is an `<a href="mailto:${member.email}">` link that opens the user's native email client. There is no in-app email sending (e.g., composing a one-off Resend email from the profile). The only in-app email path is through a Campaign targeting that member's segment.

**Issues found:**

- The member list at `/members` has no link to `/members/[id]` from the list itself in certain scenarios — the list has a side panel for quick info (`MemberProfilePanel`) and a "View Full Profile" button that presumably links to the detail page, but the primary row-click opens the side panel, not the detail page. The navigation to the full profile page is a secondary action.
- Pagination is not implemented. The member list fetches all members into memory client-side and filters/sorts in JavaScript. At scale this degrades.

---

### 3.3 Revenue Review Flow

**Goal:** Revenue dashboard → MRR → Transaction list → Individual transaction detail.

**Click path:**
1. Sidebar → `/revenue`
2. `Overview` tab: MRR card, ARPM card, area chart, pie chart
3. `Transactions` tab: transaction list
4. Individual transaction: **no page exists**

**Can they drill from a revenue number to the underlying transactions?**

No. The metric cards on the Revenue Overview tab are rendered as `div.cursor-pointer` with hover styling but no click handlers. Clicking `MRR` does not navigate anywhere. The `Transactions` tab shows a table of transactions but each row has no link to a transaction detail page — no `/revenue/transactions/[id]` route exists.

**Can they see revenue by membership type, by month, by member?**

- By type: Yes, via the pie chart on the Overview tab (membership, drop-in, credit pack, etc.)
- By month: Yes, via the area chart on the Overview tab (30-day default, switchable)
- By member: No. There is no revenue-by-member view. The member profile's `Financials` tab shows that member's transactions, but you cannot reach it from the Revenue page.

**Revenue sub-pages:**
- `/revenue/products` — product catalog (memberships, drop-ins, credit packs)
- `/revenue/orders` — order list (merch/event orders)
- `/revenue/products/new` — create new product
- `/revenue/products/[id]` — product detail/edit

These sub-pages are not linked from the main Revenue tab navigation. The user must know to look for them or discover them via the sidebar's Revenue item (which goes to the main revenue page, not the sub-pages). The revenue page itself has no navigation to `/revenue/products` or `/revenue/orders`.

---

### 3.4 Campaign Creation Flow

**Goal:** Marketing → Campaigns → New → Select audience → Write email → Preview → Send.

**Click path:**
1. Sidebar → `/marketing`
2. Click "Campaigns" nav card or "New Campaign" link on the hub → `/marketing/campaigns/new`
3. Step 1: Name campaign, pick channel (Email/SMS), select audience (behavior segment or custom segment)
4. Step 2: Write subject + body, live preview (desktop/mobile toggle), AI generate panel, template picker
5. Step 3: A/B test toggle, schedule (now or scheduled date/time)
6. Submit

**Is the flow linear and clear?**

Yes. The campaign builder uses a `StepIndicator` component showing steps 1, 2, 3. Navigation between steps uses `ArrowLeft`/`ArrowRight` buttons. The back button on step 1 goes to `/marketing` (not `/marketing/campaigns`), which means abandoning a new campaign drops the user at the Marketing hub rather than the Campaigns list. This is a minor UX inconsistency — the user may expect to be returned to the list they came from.

**Can they save as draft and come back?**

Yes. A "Save as Draft" action exists in step 3. The draft is saved via `POST /api/campaigns` with `status: 'draft'`, then the user is navigated back via the back button. However, the success path after draft save routes to `/marketing` (the hub), not `/marketing/campaigns` (where the draft list lives). The user must re-navigate to find their draft.

**Can they see the estimated reach before sending?**

Yes. Step 1 loads segment member counts from `member_360` in real time (excluding unsubscribed/bounced). The count is displayed next to each segment option. Behavior segment counts are fetched in parallel, with exclusion of unsubscribed profiles. Custom segment counts are loaded from `smart_segments.member_count`.

**Issues found:**
- Campaign detail page (`/marketing/campaigns/[id]`) uses `window.location.pathname` to extract the campaign ID on the client, which is fragile and bypasses the proper Next.js params mechanism (`params: Promise<{ id: string }>`). The `params` prop is passed to the component but the resolved ID reads from `window.location` instead.
- Back navigation from both new and detail campaign pages goes to `/marketing` (the hub), not `/marketing/campaigns`. If the user arrived from the campaigns list, they lose their place.

---

### 3.5 Automation Setup Flow

**Goal:** Marketing → Automations → New → Template or scratch → Configure trigger → Build steps → Activate.

**Click path:**
1. Sidebar → `/marketing` → click "Automations" nav card → `/marketing/automations`
2. "New Automation" button → `/marketing/automations/new`
3. Step 1: Name, pick trigger type (11 options: signup, no-show, churn risk, credit expiry, birthday, milestone, membership change, booking completed, failed payment, inactivity, referral)
4. Step 2: ReactFlow canvas — add nodes (Email, Wait, Condition, SMS, Tag), connect with edges
5. Step 3: Review + Activate

**Are templates discoverable?**

The automation new page loads with a pre-built example flow in the ReactFlow canvas (trigger → wait → email → condition → tag/wait branches). This serves as an implicit template. There is no explicit template picker UI or "start from template" modal, unlike the campaign builder which has `TemplateCard` components. The automation builder's "template" is the hardcoded default flow.

**Is the flow builder intuitive?**

The ReactFlow canvas is functional. Nodes can be added from a palette on the left. Edges are drawn by connecting node handles. However, on mobile viewports the canvas will be cramped since ReactFlow is not responsive by default. For the admin-only Phase 1/2 use case this is acceptable.

**Back navigation:** The automations new page has an `ArrowLeft` link back to `/marketing/automations` (the list), not to `/marketing`. This is correct — it is more specific than the campaign builder's back navigation.

---

### 3.6 Analytics Flow

**Goal:** Analytics hub → KPI deep dive → Revenue trend → Attendance trend → Trainer performance → Individual trainer → Reports → Custom report builder.

**Click paths:**
1. Sidebar → `/analytics` — analytics hub with 6 KPI cards, revenue breakdown chart, member movement chart, heatmap, cohort table, AI recommendations, and navigation cards at the bottom
2. Navigation cards link to: `/analytics/kpi`, `/analytics/dashboards`, `/analytics/trainers`, `/analytics/reports`
3. `/analytics/kpi` — KPI deep dive (Since Takeover comparison vs baseline, revenue + attendance + new members, weekly trends)
4. `/analytics/trainers` — trainer performance list → click row → `/analytics/trainers/[id]`
5. `/analytics/reports` — report library → "New Report" → `/analytics/reports/new` (4-step report builder)
6. `/analytics/dashboards` — 3 sub-dashboards: Executive, Growth, Operations, each with back navigation to `/analytics/dashboards`

**Missing from analytics hub navigation cards:**
- `/analytics/insights` — exists as a page but is not linked from the analytics hub navigation cards
- `/analytics/pricing` — exists as a page but is not linked from the hub navigation cards
- `/analytics/migration` — exists as a page but is not linked from the hub navigation cards

These three pages are orphaned from the hub. Users who don't know the URL cannot discover them through the hub.

**Can they compare periods?**

On the analytics hub: Yes, there is a time range picker (7d / 30d / 90d / 12m) for the revenue breakdown and member movement charts.

On the KPI deep dive (`/analytics/kpi`): Yes, it compares "since takeover" vs a baseline period, but the periods are hardcoded to `TAKEOVER_DATE = '2026-03-01'` and `BASELINE_START = '2024-01-01'`. Users cannot select custom comparison periods.

**Can they export data?**

On the analytics hub: No export button visible.

On the report library (`/analytics/reports`): The report viewer has an "Export" button (`ReportViewerClient`). The export mechanism was not traced to confirm it produces a file download vs. a copy-to-clipboard action.

---

### 3.7 Settings Flow

**Goal:** Navigate to Settings → SMS config → Geofence → Studio profile.

**How do they get to Settings?**

There is no sidebar link for `/settings`. The 10-item sidebar does not include Settings. The Header component does not include a Settings link. There is no settings gear icon in the bottom of the sidebar (unlike many admin dashboards). The only ways to reach `/settings`:
1. Know the URL and type it directly
2. Find a link from within another page (no such cross-page link was found in the audit)
3. The Settings page itself links to `/settings/geofence` and `/settings/sms`, but you must already be on Settings to see those links

The geofence page (`/settings/geofence`) has an `ArrowLeft` back link to `/settings`. The SMS page (`/settings/sms`) is linked from within the Settings client under "Messaging" tab, with a `NextLink` to `/settings/sms`. Neither provides a way to reach Settings initially.

**Settings page content (SettingsClient.tsx tabs):**

| Tab | Content |
|---|---|
| Studio | Studio profile, logo, operating hours |
| Hours | Operating hours detail |
| Memberships | Membership plan management |
| Geofence | Link to `/settings/geofence` for clock-in radius configuration |
| Notifications | Notification toggles |
| Integrations | Glofox sync trigger, API key display |
| Data | Glofox data sync button |

Settings is comprehensive but completely unreachable through normal navigation. This is a critical discoverability failure.

---

### 3.8 Employee Portal Flow

**Goal:** Login → Employee dashboard → Clock in → View schedule → Check pay.

**Click path:**
1. `/login` — employee with trainer/staff role → `router.push("/employee")`
2. `/employee` (Home) — shows greeting, clock status, today's classes, recent timesheet summary
3. Clock-in is available in two places: the header bar (quick toggle button) and `/employee/clock` (full clock page with geofencing details)
4. `/employee/schedule` — upcoming classes
5. `/employee/pay` — pay stubs and tax documents

**Is clock-in geofenced properly?**

The employee home page (`/employee/page.tsx`) uses a `useClockAction` hook that calls `POST /api/clock`. The dedicated clock page (`/employee/clock/page.tsx`) implements full geofencing: it uses the browser's Geolocation API, checks the user's distance against a `geoRadius` fetched from Supabase, and displays `withinRadius: boolean` per clock entry. The home page's header bar clock toggle calls the same `clockIn()` function from `useClockAction` but does not perform any geofence check client-side — it delegates entirely to the API.

The dedicated `/employee/clock` page clearly shows whether the user is within the geofence radius. The quick-toggle in the header does not show this feedback. A staff member could attempt to clock in from a remote location and the only feedback is a success/failure from the API.

**Can they see their performance metrics?**

Yes, at `/employee/performance`. This page is part of the Trainer section of the employee portal nav and shows class-level performance data.

**Employee portal back navigation:**

All employee portal pages use the sidebar for navigation rather than in-page back links. There are no `ArrowLeft` back buttons on employee portal pages — the sidebar is the primary navigation mechanism, which is appropriate.

**"Switch to Admin" link:**

The employee layout sidebar has a "Switch to Admin" link that always navigates to `/`. No role check is performed on this link. If a pure-staff user clicks it, they reach the Command Center admin view. The Command Center page itself (`(admin)/page.tsx`) has no server-side role enforcement — it is a client component that loads data from hooks. The APIs called by those hooks do use `requireRole()`, so data will not leak, but the admin UI shell renders for any authenticated user.

---

## 4. Dead-End Detection

| Location | Type | Description | Severity |
|---|---|---|---|
| Command Center — Activity Feed items | Dead end | Items styled as `cursor-pointer` with hover state but no `onClick` and no `href`. Clicking does nothing. | High |
| Command Center — "View All" on Class Status Board | Dead end | `<button>` with no `onClick` or `href`. Should link to `/schedule`. | High |
| Command Center — AI insight action buttons | Dead end | `<button>` after each AI insight (e.g., "Review Members") with no routing. | High |
| Command Center — Hero metric cards | Dead end | `div.cursor-pointer` with hover shadow but no click handler. Implies drillability. | Medium |
| Revenue metric cards | Dead end | Same pattern — `cursor-pointer` styling but no click handler on MRR, ARPM, etc. | Medium |
| `/settings` | Orphaned from nav | No sidebar entry, no header link, no cross-page link. Unreachable through normal navigation. | Critical |
| `/analytics/insights` | Orphaned from nav | Analytics hub does not link to this page in its navigation cards. | Medium |
| `/analytics/pricing` | Orphaned from nav | Analytics hub does not link to this page in its navigation cards. | Medium |
| `/analytics/migration` | Orphaned from nav | Analytics hub does not link to this page in its navigation cards. | Medium |
| Campaign new/detail back nav | Wrong parent | Back button goes to `/marketing` (hub) instead of `/marketing/campaigns` (list). | Low |
| Magic link sent screen | No back nav | After `setSent(true)`, the only option is "Use a different email" — no "Back" to login form. | Low |
| Sidebar collapsed — no sign-out | Dead end | LogOut button is hidden when sidebar is collapsed. | Low |

---

## 5. Form Flow Analysis

### Campaign Builder (3-step wizard)

- **Step back/forward:** ArrowLeft/ArrowRight buttons at each step. Step 1 back goes to `/marketing` (hub). Steps 2 and 3 back go to the previous step. Correct internally.
- **Progress saved between steps:** Yes, all state is held in React `useState` within the page component. Navigating back a step does not lose state.
- **Browser close mid-flow:** All state is lost. No draft auto-save is triggered between steps — only on explicit "Save as Draft" action in step 3.
- **Validation errors:** Client-side validation present. Required fields prevent forward step navigation. Error messages shown inline.

### Automation Builder (3-step wizard with ReactFlow canvas)

- **Step back/forward:** Same ArrowLeft/ArrowRight pattern. Back from step 1 goes to `/marketing/automations` (correct, unlike campaigns).
- **ReactFlow state:** Node/edge state held in `useNodesState`/`useEdgesState`. Navigating steps preserves the canvas.
- **Browser close mid-flow:** All state is lost. No auto-save.

### Report Builder (4-step wizard)

- **Back navigation:** ArrowLeft link from step header goes to `/analytics/reports` (abandons builder). Step-to-step navigation uses forward/back buttons.
- **After save:** `router.push('/analytics/reports')` navigates to report library. Correct.
- **Validation:** Required field checks on each step before advancing.

### Member Profile — Plan Upgrade/Downgrade

- **Confirmation modal:** A confirm modal appears before executing the plan change. This is good.
- **Error state:** `planActionMsg` state shows success/error inline after the API call.
- **No back from error:** If an upgrade fails, the modal closes and an inline message shows. The user can try again. This is adequate.

---

## 6. Authentication Flow

### Password Sign-in

1. User enters email + password → `supabase.auth.signInWithPassword()`
2. On success: fetch `profile.roles` → role-based `router.push()` to `/` or `/employee`
3. On failure: inline error message, form stays editable. Recovery: toggle to magic link.

**Gap:** If the user's `profiles` row does not exist or has no `roles` field, they land on `/` (admin dashboard) by default — the fallback `destination = "/"` in login is not role-gated.

### Magic Link Sign-in

1. User enters email → `supabase.auth.signInWithOtp()` → `setSent(true)` (no back navigation at this point)
2. User clicks email link → hits `/auth/callback?code=...`
3. Callback exchanges code for session, checks roles, redirects

**Gap:** The "Check your email" success screen has only "Use a different email" as the action. If the magic link email does not arrive, the user has no way to resend without entering their email again from the start.

### Session Expiry

The middleware refreshes the session via `updateSession()` on every request. If the session is expired:
- For page routes: the user is redirected to `/login?redirect=<path>` — the redirect param is preserved so the user returns to their destination.
- For API routes: a 401 JSON response is returned. The client-side code does not intercept this and redirect to login. The user sees a data-loading failure with no login prompt.

**Gap:** No client-side 401 interceptor. `useCommandCenterData` and other hooks use `fetch()` without a global 401 handler. A session expiry during normal dashboard use shows broken/empty data states rather than a redirect to login.

---

## 7. State Machine Analysis

### Member Lifecycle

```
Lead Only → New & Unused → Active → Cooling → At Risk → Lapsed → Churned
                                 ↘ Subscriber (unlimited plan)
                                 ↘ Paused
```

All states are computed from `member_360.engagement_status`. The state is read-only from the UI perspective — there is no admin UI to manually move a member between engagement states (e.g., manually marking a churned member as re-engaged). States update via background cron job (`cron-member-enrichment`).

**Gap:** No manual override for engagement state. If data is stale or incorrect, admins have no correction path.

### Campaign Lifecycle

```
Draft → Scheduled → Sent
      ↘ (send now) → Sent
```

The `CampaignStatus` type is `'sent' | 'active' | 'scheduled' | 'draft'`. `'active'` status appears in the UI badge but is not fully defined in the state machine — it may represent an in-progress send. No cancel-scheduled-send UI was found.

**Gap:** A scheduled campaign has no "cancel schedule" button visible in the campaign detail or list pages. The user would need to edit the campaign's scheduled time or delete it.

### Automation Lifecycle

```
Draft → Active
      ← Deactivate
```

Automations can be activated/deactivated via `POST /api/automations/[id]/activate` and `/deactivate`. The list page shows active/inactive status. The detail/edit page has a "Go Live" button. The transition back from Active to Draft is via Deactivate, though the UI labels this as "Deactivate" not "Move to Draft".

---

## 8. Error Recovery Paths

| Scenario | Current Behavior | Gap |
|---|---|---|
| Member not found (`/members/[id]`) | "Member not found." with "Back to Members" link | Good — error state has recovery |
| Lead not found (`/marketing/leads/[id]`) | "Lead not found" with "Back to Leads" link | Good |
| Trainer not found (`/analytics/trainers/[id]`) | Renders `TrainerDetailClient` with all null props — unclear what the user sees | Medium — no explicit "not found" message confirmed |
| Campaign send fails | Client-side catch shows inline error — user can retry | Adequate |
| Report save fails | Inline error shown | Adequate |
| Product not found (`/revenue/products/[id]`) | "Back to Products" link shown | Good |
| Clock-in API fails (employee portal) | `catch` logs to console, `setClockBusy(false)` — no user-visible error | Gap — clock failure is silent |
| Session expiry during data fetch | Empty/broken data states, no redirect | Gap — needs 401 interceptor |
| API rate limit hit (AI routes) | API returns 429 — client shows no user-friendly message | Gap — all AI hooks use silent `catch(() => {})` |

---

## 9. Sidebar Link Verification

All 10 sidebar links point to existing pages. No broken sidebar links found.

Sub-module pages that the sidebar does not directly link to:

**Revenue sub-pages** (accessible only via in-page tabs or direct URL, no sidebar link):
- `/revenue/products`
- `/revenue/orders`

**Marketing sub-pages** (accessible via nav cards on `/marketing` hub):
- `/marketing/campaigns`
- `/marketing/automations`
- `/marketing/leads`
- `/marketing/content`

**Analytics sub-pages** (accessible via nav cards on `/analytics` hub, but 3 are missing):
- `/analytics/kpi` — linked via hub
- `/analytics/dashboards` — linked via hub
- `/analytics/trainers` — linked via hub
- `/analytics/reports` — linked via hub
- `/analytics/insights` — NOT linked from hub
- `/analytics/pricing` — NOT linked from hub
- `/analytics/migration` — NOT linked from hub

**Operations sub-pages** (accessible from within `/operations` page — no sub-navigation cards, just in-page tabs):
- `/operations/payroll`
- `/operations/documents`

**Settings sub-pages** (accessible only from within `/settings`):
- `/settings/geofence`
- `/settings/sms`

---

## 10. Findings

### CRITICAL-UF-001: Settings page is unreachable through normal navigation

**Severity:** Critical
**Location:** `apps/web/src/components/layout/Sidebar.tsx`, `apps/web/src/components/layout/Header.tsx`

The `/settings` page and its sub-pages (`/settings/geofence`, `/settings/sms`) contain complete, functioning implementations for studio profile, operating hours, membership plan management, geofencing, notifications, and integrations. None of these pages are reachable through any navigational affordance — no sidebar link, no header settings gear, no footer link. An operator who does not know the URL cannot configure the studio or set up the geofence.

**Recommendation:** Add a Settings gear icon to the bottom of the `Sidebar` component (below the dark mode toggle), or add a settings link to the `Header` component. The existing `navItems` array can be extended.

---

### HIGH-UF-002: Command Center dead-end interactive elements (activity feed, View All, AI actions, metric cards)

**Severity:** High
**Location:** `apps/web/src/app/(admin)/page.tsx` lines 179–181 (AI actions), 268–270 (View All), 456–468 (activity items), 202–219 (metric cards)

Four distinct UI elements on the highest-traffic admin page present interactive affordances (cursor-pointer, hover states, button elements) but perform no action when clicked:

1. Activity feed items: `div` with `cursor-pointer` and hover style — no onClick, no href
2. "View All" button on Class Status Board: `<button>` with no onClick
3. AI insight action buttons (e.g., "Review Members"): `<button>` with no onClick
4. Hero metric cards: `div.cursor-pointer` with hover shadow — no onClick

These create a broken trust relationship with the user — the UI promises interactivity that does not exist.

**Recommendation:**
- Activity feed items: Link to the member profile when a member_id is available; link to `/schedule` for class events; link to `/revenue` for payment events.
- "View All" button: `<Link href="/schedule">View All <ChevronRight /></Link>`
- AI insight action buttons: Map each insight `action` string to a route. At minimum, add an `actionHref` field to `AIInsight` and render as `<Link>`.
- Hero metric cards: Wrap in `<Link href="/revenue">` (Revenue Today), `<Link href="/members">` (Attendance), etc.

---

### HIGH-UF-003: Settings page inaccessible; settings sidebar entry missing

**Severity:** High
**Note:** This duplicates CRITICAL-UF-001 at a different level — the finding is also catalogued as Critical above. Listed here for the numbered findings list completeness.

---

### MEDIUM-UF-004: Revenue module has no transaction drill-down

**Severity:** Medium
**Location:** `apps/web/src/app/(admin)/revenue/page.tsx` (TransactionsTab)

The Revenue Transactions tab shows a table of transactions but no `/revenue/transactions/[id]` page exists. Individual transaction detail (full metadata, Stripe charge ID, refund history, linked member) cannot be accessed from within the Revenue module. The only path to a member's transaction history is via `/members/[id]` Financials tab, which requires knowing the member first.

**Recommendation:** Either add a transaction detail page `/revenue/transactions/[id]` with Stripe charge linkage, or make transaction rows expand inline to show detail.

---

### MEDIUM-UF-005: Revenue sub-pages unreachable from revenue page

**Severity:** Medium
**Location:** `apps/web/src/app/(admin)/revenue/page.tsx`

The Revenue page has three tabs: Overview, Memberships, Transactions. It does not link to `/revenue/products` or `/revenue/orders`. These two pages exist but are only reachable by direct URL. A user looking for the product catalog or order list within the Revenue section will not find them.

**Recommendation:** Add sub-navigation links on the revenue page, or add `Products` and `Orders` as additional tabs alongside the existing three.

---

### MEDIUM-UF-006: Three analytics sub-pages are orphaned from the hub

**Severity:** Medium
**Location:** `apps/web/src/app/(admin)/analytics/page.tsx` (navigation cards section)

The analytics hub navigation cards link to `/analytics/kpi`, `/analytics/dashboards`, `/analytics/trainers`, and `/analytics/reports`. Three more pages exist but have no hub entry:
- `/analytics/insights` — AI-generated insights with dismiss/act actions
- `/analytics/pricing` — pricing simulator
- `/analytics/migration` — Glofox migration tracking

**Recommendation:** Add three more navigation cards to the analytics hub for Insights, Pricing Simulator, and Migration.

---

### MEDIUM-UF-007: Campaign back navigation routes to hub instead of campaigns list

**Severity:** Medium
**Location:** `apps/web/src/app/(admin)/marketing/campaigns/new/page.tsx` line 341, `apps/web/src/app/(admin)/marketing/campaigns/[id]/page.tsx` line 212

Both the new campaign and campaign detail pages use `<a href="/marketing">` for their back/close button. This routes the user to the Marketing hub page rather than the Campaigns list (`/marketing/campaigns`). A user who arrived at the campaign builder from the list is not returned to the list.

Additionally, these are plain `<a>` tags (hard navigation) rather than Next.js `<Link>` components, which forfeits client-side routing benefits.

**Recommendation:** Change back navigation targets to `/marketing/campaigns`. Replace `<a>` with `<Link>` from `next/link`.

---

### MEDIUM-UF-008: Session expiry has no client-side 401 interceptor

**Severity:** Medium
**Location:** All client-side data hooks (`use-command-center-data.ts`, `use-kpi-data.ts`, etc.)

When a user's session expires, authenticated API calls return 401 JSON. No client-side code intercepts 401 responses and redirects to `/login`. The user sees stale or missing data without any prompt to re-authenticate. They must manually navigate to `/login` or refresh.

**Recommendation:** Add a global `fetch` wrapper or Supabase auth state change listener that redirects to `/login` when a 401 is received.

---

### LOW-UF-009: Trainer-only employee nav items shown to all employees

**Severity:** Low
**Location:** `apps/web/src/app/(employee)/layout.tsx` lines 150–182

The "Trainer" section of the employee sidebar (`My Classes`, `Performance`, `Promo Code`) is rendered for all employee portal users regardless of their role. A front desk staff member sees trainer-specific pages.

**Recommendation:** Conditionally render the trainer nav section based on `profile?.roles?.includes('trainer')`. The `displayRole` variable is already computed but not used to gate navigation.

---

### LOW-UF-010: "Switch to Admin" link in employee portal has no role gate

**Severity:** Low
**Location:** `apps/web/src/app/(employee)/layout.tsx` line 187–194

Any employee portal user can click "Switch to Admin" and be taken to `/` (Command Center). The admin page shell renders for any authenticated user. Only the API calls within it are protected by `requireRole()`.

**Recommendation:** Either: (a) check `profile.roles` before rendering the "Switch to Admin" link and hide it for non-admin roles; or (b) add a server-side role check to the `(admin)/layout.tsx` and return a 403 page for non-admin users.

---

### LOW-UF-011: Sidebar collapsed state hides logout button

**Severity:** Low
**Location:** `apps/web/src/components/layout/Sidebar.tsx` lines 168–175

The sign-out (LogOut icon) button is conditionally rendered `{!collapsed && (...)}`. When the sidebar is collapsed to icon-only mode, the user has no sign-out affordance without first expanding the sidebar.

**Recommendation:** In collapsed mode, render the LogOut icon without the label text, or add a sign-out option to the user avatar tooltip shown on hover.

---

### LOW-UF-012: Magic link sent screen has no resend action

**Severity:** Low
**Location:** `apps/web/src/app/(auth)/login/page.tsx` lines 102–134

After requesting a magic link, the user sees a "Check your email" confirmation with only a "Use a different email" action. If the magic link email does not arrive (spam filter, delay), the user cannot resend it without clearing their email and starting over.

**Recommendation:** Add a "Resend magic link" button that re-calls `supabase.auth.signInWithOtp()` with the same email after a cooldown (e.g., 60 seconds).

---

### LOW-UF-013: Clock-in failure in employee portal is silent

**Severity:** Low
**Location:** `apps/web/src/app/(employee)/layout.tsx` lines 75–88 (clock toggle handler)

The quick-clock-in handler in the employee layout catches errors with `console.error('Clock toggle failed:', err)` but shows no user-facing error message. If the API call fails (network error, geofence rejection, etc.), the user sees the button return to its previous state with no explanation.

**Recommendation:** Show a toast or inline error message when `clockIn()`/`clockOut()` throws.

---

### INFO-UF-014: No in-app email compose from member profile

**Severity:** Info
**Location:** `apps/web/src/app/(admin)/members/[id]/_components/MemberProfileClient.tsx` line 478

The "Email" button on member profiles opens `mailto:` (native email client). There is no in-app option to compose a one-off transactional email to a specific member using the Resend integration. The only in-app email path is via a Campaign targeting a segment.

**Recommendation:** Add a "Send Email" modal on member profiles that composes a simple one-off email via `POST /api/campaigns/send` or a new `/api/members/[id]/email` endpoint.

---

### INFO-UF-015: Password-reset flow is absent; magic link is the recovery path

**Severity:** Info
**Location:** `apps/web/src/app/(auth)/login/page.tsx`

There is no dedicated "Forgot password" or "Reset password" page. The magic-link toggle on the login page serves as the implicit password recovery mechanism. This is consistent with the passwordless-first design philosophy stated in `CLAUDE.md` and is not a bug, but should be documented.

---

## Summary Table

| ID | Severity | Category | Title |
|---|---|---|---|
| CRITICAL-UF-001 | Critical | Navigation | Settings page unreachable through normal navigation |
| HIGH-UF-002 | High | Dead ends | Command Center: activity feed, View All, AI actions, metric cards are non-functional |
| MEDIUM-UF-004 | Medium | Navigation | Revenue module has no transaction drill-down page |
| MEDIUM-UF-005 | Medium | Navigation | Revenue products and orders sub-pages unreachable from revenue page |
| MEDIUM-UF-006 | Medium | Navigation | Three analytics sub-pages orphaned from analytics hub |
| MEDIUM-UF-007 | Medium | Navigation | Campaign back navigation routes to hub instead of campaigns list |
| MEDIUM-UF-008 | Medium | Auth | No client-side 401 interceptor for session expiry |
| LOW-UF-009 | Low | Role gating | Trainer-only nav items shown to all employees |
| LOW-UF-010 | Low | Role gating | "Switch to Admin" link has no role gate |
| LOW-UF-011 | Low | UX | Sidebar collapsed state hides logout button |
| LOW-UF-012 | Low | Auth UX | Magic link sent screen has no resend action |
| LOW-UF-013 | Low | Error handling | Clock-in failure in employee portal is silent |
| INFO-UF-014 | Info | Feature gap | No in-app email compose from member profile |
| INFO-UF-015 | Info | Design decision | Password reset absent; magic link is recovery path |

---

## Diagrams

See `.audit/diagrams/user-flow.mmd` for:
- Sequence diagram: primary admin user journey (login → command center → members → revenue → campaign creation → analytics)
- Flowchart: full page navigation map with color-coded node health (green = healthy, yellow = minor issue/orphaned, red = critical issue, gray = public/system)
