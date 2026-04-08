# Layer Report: User Flow

**Agent:** user-flow
**Date:** 2026-04-08
**Status:** Complete

---

## Executive Summary

Meridian supports three distinct user surfaces in the same Next.js application: the Admin Dashboard (studio owners and managers), the Employee Portal (trainers and staff), and the Auth surface (login via magic link). All three route groups are protected by the central middleware. User flows are well-defined for the core admin path. Key gaps include: the command palette quick actions don't reliably open the target modals, the employee portal's trainer-specific section is shown to all employees regardless of role, and several critical user journeys (booking creation, campaign sending, automation enrollment) have no dedicated error state handling in the UI.

---

## User Flow Map

### Flow 1: Admin Authentication
```
Browser → / (or any protected route)
  → middleware: no session
    → redirect → /login
      → login/page.tsx: magic link email form
        → POST to Supabase auth.signInWithOtp()
        → user receives email
        → clicks link → /auth/callback
          → route.ts: exchanges code for session
          → redirect → / (Command Center)
```
**Status:** Complete. No issues identified.

### Flow 2: Daily Admin Workflow
```
/ (Command Center)
  → AI briefing loaded (GET /api/ai/briefing, 30-min cache)
  → Live metrics displayed
  → Cmd+K → Command Palette
    → Navigate to any module (Cmd+1 through Cmd+9)
    → Quick actions: New Class, Add Member, Record Payment
```
**Status:** Partially complete. Quick action URL params (`?action=new-class`) destination handling is unverified.

### Flow 3: Member Management
```
/members (Member Directory)
  → Search/filter members
  → Click member row → MemberProfilePanel (slide-over)
    → View 360 data: bookings, transactions, AI health score
    → Actions: pause membership, upgrade membership, add note
  → OR navigate to /members/[id] (full profile page)
    → MemberProfileClient: full detail view
```
**Status:** Complete for viewing. Pause/upgrade modals exist as new files (MemberPauseModal, MemberUpgradeModal) recently added.

### Flow 4: Class Booking Flow
```
/schedule (Schedule Calendar)
  → View class grid
  → Select class slot
  → ClassFormModal: create/edit class
  → Booking management: view bookings for a class
    → Add booking for member
    → POST /api/bookings (atomic capacity check + Glofox write-back)
    → If full → 409 → waitlist entry
      → waitlist → Inngest cron promotes when slot opens
```
**Status:** Complete for admin-side booking. No self-service member booking (Phase 5).

### Flow 5: Campaign Creation and Send
```
/marketing/campaigns
  → New Campaign
  → Multi-step builder (CampaignsClient)
    → Step 1: Template selection
    → Step 2: Audience (segment or ad-hoc filter)
    → Step 3: Content (email subject, body, AI copy generation)
    → Step 4: A/B test configuration (optional)
    → Step 5: Schedule or send immediately
  → POST /api/campaigns/send
    → Recipients built from segment
    → Resend API sends emails in batches
    → Resend webhooks update delivery metrics
```
**Status:** Complete architecture. A/B test winner selection is manual.

### Flow 6: Employee Clock-In/Out
```
/employee (Employee Portal Home)
  → Clock-in button in header (quick toggle)
  → OR /employee/clock (dedicated clock page)
  → POST /api/clock
    → Geofence check (navigator.geolocation)
    → Clock entry created in DB
  → Clock-out: same flow, updates clock_out timestamp
```
**Status:** Complete. Geofence verification integrated.

### Flow 7: Lead Pipeline
```
/marketing/leads (Lead Pipeline)
  → View leads by status (Kanban or list)
  → Lead from /api/leads/capture (public form embed)
    → AI lead scoring on intake
  → Click lead → /marketing/leads/[id] (LeadDetailClient)
    → Update status, add notes, log interactions
    → Convert lead → POST /api/leads/[id]/convert
      → Creates member profile
      → Marks lead as converted
```
**Status:** Complete. Lead capture endpoint is public (no auth required).

### Flow 8: Automation Enrollment
```
/marketing/automations (Automation Flows)
  → View/create automation flows (ReactFlow visual builder)
  → Activate flow
  → Inngest evaluate-triggers function runs on events:
    - member_signup → new member enrolled
    - member_churn_risk → at-risk members enrolled
    - etc.
  → Enrollment: automation_enrollments row created
    → execute-flow Inngest function processes steps sequentially
    → Wait steps: Inngest sleep
    → Email steps: Resend send
    → Condition steps: branch based on member field
```
**Status:** Architecture complete. execute-flow has no unit tests (HIGH finding from testing-quality).

### Flow 9: Payroll Processing
```
/operations (Operations — Payroll tab)
  → View payroll periods
  → Create new period
  → POST /api/payroll/periods/[id]/calculate
    → Aggregate timesheets, trainer bonuses, promo commissions
  → Review line items
  → POST /api/payroll/periods/[id]/approve
  → POST /api/payroll/periods/[id]/export (CSV)
```
**Status:** Complete infrastructure. Integration with external payroll processor (ADP, Gusto) not yet built.

### Flow 10: AI Insights Review
```
/analytics/insights (AI Insights)
  → Insights generated by cron-ai-insights Inngest function
    → Runs on schedule (daily)
    → Calls /api/ai/insights/generate
    → Deduped by fingerprint (7-day window)
  → View insights by urgency (info, suggestion, attention, urgent)
  → Click insight → action_url deep link
  → Dismiss or mark actioned
```
**Status:** Complete. Fingerprint dedup prevents re-surfacing same insight within 7 days.

---

## Dead-End Flows Identified

### Dead End 1: Employee Portal Trainer Nav
The employee sidebar shows "My Classes", "Performance", "Promo Code" sections to ALL employees. For non-trainer staff, these navigation items lead to pages that may show empty data or fail (e.g., `/employee/performance` for a non-trainer employee would show no trainer metrics). The sidebar doesn't conditionally render the trainer nav based on role.

### Dead End 2: Command Palette Quick Actions with URL Params
Quick actions navigate to routes like `/schedule?action=new-class`. The Schedule page would need to detect `?action=new-class` in its URL params and automatically open the `ClassFormModal`. There is no verified handler for these URL params in the schedule page — the user would arrive at the page but the modal might not open.

### Dead End 3: SMS Channel in Campaigns
The campaign builder includes SMS as a channel option (`CampaignChannel = 'email' | 'sms' | 'push'`). If a user selects SMS as a campaign channel, the SMS infrastructure exists (Twilio) but is described as "stub" — the SMS send path may fail silently or be gated by a feature flag that isn't obvious from the UI.

### Dead End 4: Shipping in Revenue → Orders
The Orders section of Revenue shows order management. The `fulfillment_type` field includes `'shipping'` but is documented as "inactive Phase 1". If an admin attempts to mark an order for shipping fulfillment, the flow may be incomplete.

---

## Orphaned Pages

### Engagement Module (`/engagement`)
The route `/engagement` (and `(admin)/engagement/`) exists with an `EngagementClient` component. However, this route is NOT in `NAV_ITEMS` and NOT in the command palette. It's only reachable from the command palette's "Smart Segments" quick action which goes to `/segments`, and a hardcoded link in the command palette. The Engagement module appears partially built and detached from the main navigation.

### Segments Module (`/segments`)
Similar to Engagement — `/segments` has a page but is not in the primary navigation. Accessible only via command palette or direct URL.

### `(employee)/classes/` and `(employee)/pay/`
Under `apps/web/src/app/(employee)/`, there are top-level folders `classes/` and `pay/` and `performance/` and `profile/` and `promo/` that appear to be empty stubs or duplicates of the `/employee/*/` routes. These are likely orphaned route stubs.

---

## Missing Error States

1. **Booking failure (capacity)** — When booking fails due to capacity (409), the admin-side UI should show a clear error and offer to add to waitlist. No UI-level handler confirmed.
2. **AI service unavailable** — When Anthropic API fails, the rules-based fallback kicks in. The UI shows the fallback briefing without indicating "AI unavailable." Users may think the AI is working.
3. **Glofox sync failure** — If Glofox sync fails, the `glofox_write_status` field is updated to `'failed'` but there is no admin alert or notification surfaced in the UI.
4. **Automation flow execution error** — When an automation step fails, `status = 'failed'` and `error_message` is set on the enrollment. There is no mechanism to alert admins of failed enrollments.

---

## Findings

### CRITICAL
None.

### HIGH
- **HIGH-UF-001:** `/segments` and `/engagement` modules are not accessible from the primary navigation (`NAV_ITEMS`). These are implemented features that users cannot discover through normal navigation. At minimum, they should be accessible as sub-navigation under the Marketing or Members modules.

### MEDIUM
- **MED-UF-001:** Command palette quick actions use URL params (`?action=new-class`) that may not be consumed by destination pages. If the target pages don't detect and act on these params, the "quick action" UX promise is broken.
- **MED-UF-002:** The employee portal trainer nav section renders for all employees regardless of role. Non-trainer staff see "My Classes", "Performance", and "Promo Code" navigation items that may show empty or error states.
- **MED-UF-003:** No error state UI for Glofox write-back failures. Admin has no visibility into which bookings failed to sync to Glofox.
- **MED-UF-004:** No in-app notification when automation enrollments fail. Failed automations are silent from the admin's perspective.

### LOW
- **LOW-UF-001:** `(employee)/classes/`, `(employee)/pay/`, etc. are orphaned route stubs under the employee route group that duplicate the `/employee/*` routes. These should be cleaned up.
- **LOW-UF-002:** SMS campaign channel is visible in the campaign builder but may be non-functional. Users may configure SMS campaigns that never send, with no clear indication that SMS is unavailable.
- **LOW-UF-003:** The "Switch to Admin" link in the employee portal navigates to `/` (admin Command Center) but doesn't check if the user has admin privileges — a trainer-only employee who clicks it would be redirected to `/` and then encounter role-based access errors.

### INFO
- **INFO-UF-001:** The auth flow correctly uses magic link / OTP (no passwords) per the design spec. The callback route is correctly implemented.
- **INFO-UF-002:** The Cmd+K command palette provides excellent power-user navigation with keyboard shortcuts — a strong UX feature for admin users.
- **INFO-UF-003:** 10 major user flows identified, 8 fully implemented, 2 partially complete (quick actions, SMS campaigns).
