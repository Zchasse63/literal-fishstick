# Assumptions Register — Phase 2 Marketing & Engagement
**Date:** 2026-03-20

## Critical Assumptions (Validate Before Sprint 1 Completes)

| # | Assumption | Source | Validation Method | If Wrong |
|---|---|---|---|---|
| A1 | Phase 1 Resend integration is live in production (not just dev) | Plan section 2 | Check Resend dashboard for sent emails | Campaign engine value is blocked |
| A2 | Vercel Pro is the deployment target for cron jobs | Inferred from project setup | Confirm hosting platform | Cron strategy changes |
| A3 | Studio's physical address is stored in `studios` table | Inferred from multi-tenant schema | Check Supabase schema | CAN-SPAM compliance blocked |
| A4 | Phase 1 churn prediction produces a queryable score on member profiles | Plan section 2 | Check `profiles` table for health_score or similar field | `churn_risk` automation trigger cannot be implemented |
| A5 | Member `profiles` table has a timezone field | Needed for birthday trigger | Check schema | Birthday trigger sends at wrong local time |

## Architectural Assumptions (Validate Before Sprint 2)

| # | Assumption | Source | Validation Method | If Wrong |
|---|---|---|---|---|
| A6 | `current_setting('app.studio_id')` RLS pattern works for cron routes | Inferred from Phase 1 | Test a cron route with Supabase client in isolation | Cron automation engine fails RLS checks |
| A7 | SSE streaming still works in Next.js 16 (breaking changes noted in AGENTS.md) | AGENTS.md warning | Test existing SSE send route in current version | Campaign send UI needs redesign |
| A8 | TanStack Query v5 is compatible with the app's data fetching patterns | package.json | Already in use in Phase 1 | No issue expected |
| A9 | `FOR UPDATE SKIP LOCKED` is available in Supabase's Postgres version | Standard Postgres 9.5+ | Confirm Supabase Postgres version | Need alternative claim pattern |

## Business Assumptions (Confirm with Studio Owner)

| # | Assumption | Source | Validation Method | If Wrong |
|---|---|---|---|---|
| A10 | Studio wants to send SMS campaigns (not just email) | Plan section 7 | Confirm with owner | Defer SMS to Phase 4 entirely |
| A11 | Studio has Twilio account or wants to set one up | Plan recommendation | Confirm with owner | Use Telnyx or stub-only in Phase 2 |
| A12 | The `churn_risk` automation trigger threshold is defined (e.g., score > 0.7) | Inferred | Get explicit threshold from owner | Trigger fires on wrong members |
| A13 | 8 automation templates cover the studio's primary retention use cases | Plan section 6 | Review template list with owner | Template library needs adjustment |
