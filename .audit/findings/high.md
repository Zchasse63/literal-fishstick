# High Severity Findings

All HIGH severity findings, deduplicated and consolidated.

---

## HIGH-001 — No Centralized Auth Middleware

**Source layers:** api-surface, security, project-structure (3 agents)

Any new route handler that omits the `supabase.auth.getUser()` boilerplate is immediately publicly accessible. Before Phase 5 (member-facing routes added to the same app), a `middleware.ts` must protect all `/api/*` routes with an explicit public allowlist.

---

## HIGH-002 — Missing Role-Based Authorization on ~95% of Admin Endpoints

**Source layers:** api-surface, security, user-flow (3 agents)

Only `/api/campaigns` checks user roles. All other admin endpoints authenticate but do not authorize. A member-role account can read revenue metrics, modify member records, access payroll data, and delete bookings.

---

## HIGH-003 — No Rate Limiting on AI Endpoints or Public Lead Capture

**Source layers:** api-surface, security, performance-infra (3 agents)

13 AI endpoints call Anthropic Claude with zero rate limiting — each call has real monetary cost. `/api/leads/capture` is public with no rate limit or CAPTCHA.

---

## HIGH-004 — Mock/Hardcoded Data Displayed as Real Data on Production Pages

**Source layers:** ui-ux, user-flow (2 agents)

`/marketing/page.tsx` renders hardcoded `RECENT_CAMPAIGNS` data. `/analytics/page.tsx` renders hardcoded KPI values. Administrators are making business decisions based on fabricated numbers.

---

## HIGH-005 — Employee Clock Badge Disconnected from Database

**Source layers:** ui-ux, user-flow (2 agents)

The employee portal header clock badge uses local React state only. Toggling it does not call `/api/clock`. Employees believe they are clocking in but their timesheet receives no entry, breaking payroll accuracy.

---

## HIGH-006 — Campaign Batch Send Has No Chunking for Large Lists

**Source layers:** performance-infra

`sendBatchEmails()` enforces a 100-email maximum and returns an error when exceeded. A campaign targeting 500+ members will fail at send time with no automatic retry or chunking.

---

## HIGH-007 — Netlify Function Timeout Risk for Inngest Step Functions

**Source layers:** performance-infra, integration

Inngest functions are invoked via the `/api/inngest` Next.js route. Netlify's foreground function timeout is 26 seconds. `evaluate-triggers.ts` iterates over all flows and all trigger types in a single execution — at scale, this risks timeout mid-execution.

---

## HIGH-008 — Supabase Publishable Key Environment Variable Non-Standard Name

**Source layers:** integration, security

Both `packages/supabase/src/client.ts` and `server.ts` use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` instead of the standard `NEXT_PUBLIC_SUPABASE_ANON_KEY`. If this variable is missing in a deployment environment, all Supabase operations will silently fail with auth errors.

---

## HIGH-009 — `FROM` Email Address Hardcoded to 'The Sauna Guys' Domain

**Source layers:** integration

`lib/resend.ts` defaults `FROM_ADDRESS` to `'The Sauna Guys <noreply@thesaunaguys.com>'`. This must become a studio settings field before the platform can be used by any studio other than The Sauna Guys.

---

## HIGH-010 — AI JSON Parsing Without try/catch in Multiple Functions

**Source layers:** ai-layer, testing-quality

`insights-generator.ts` and several other AI modules call `JSON.parse(claudeResponse)` without a surrounding try/catch. A single malformed Claude response will crash the route handler with an unhandled exception, returning a 500 error to the client with no graceful degradation.
