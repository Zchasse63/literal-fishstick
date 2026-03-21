# Medium Severity Findings

All MEDIUM severity findings, deduplicated.

---

## MED-001 — STUDIO_ID Hardcoded in 15+ Route Handlers and Inngest Functions
Blocks multi-tenant deployment. All Inngest background jobs only process one studio.

## MED-002 — No DB-Level Constraint Preventing Over-Capacity Bookings
Count-then-insert pattern has acknowledged race condition. A DB-level trigger or constraint is needed before member self-booking in Phase 5.

## MED-003 — `leads` Table Missing `email_hash` Column
TypeScript type defines `email_hash: string` for SHA-256 dedup but Phase 2 SQL does not add this column. Lead dedup functionality is non-functional.

## MED-004 — `automation_enrollments` UNIQUE Constraint Blocks Reenrollment
`UNIQUE(automation_id, member_id)` means no member can ever re-enroll in any flow, conflicting with `allow_reenrollment: BOOLEAN` feature.

## MED-005 — AI Cache Has No Invalidation Triggers on Member Data Changes
Stale 24h churn predictions remain after membership status changes or re-engagement events.

## MED-006 — No Prompt Versioning for AI Functions
Stale cached AI results are served after system prompt updates until TTL expires.

## MED-007 — No Anthropic API Cost Tracking or Token Usage Logging
No per-studio attribution of AI costs. As multi-tenancy activates, cost visibility is zero.

## MED-008 — Inconsistent `studio_id` Resolution Pattern Across Handlers
Some handlers use `profile?.studio_id ?? HARDCODED_UUID`, others use a `STUDIO_ID` constant. No shared `getStudioId(user, supabase)` utility exists.

## MED-009 — Sidebar User Identity Hardcoded in Both Layouts
Admin sidebar shows "Zach M. / Studio Owner". Employee sidebar shows "Whitney C. / Trainer". `AuthContext` is not wired to either layout.

## MED-010 — Dark Mode Non-Functional in Admin Layout
Admin sidebar dark mode toggle has no `onClick` handler. Employee portal dark mode works locally but is not persisted or app-wide.

## MED-011 — No Mobile Layout for Employee Portal
Fixed-sidebar layout is unusable on mobile. Employees clock in from phones.

## MED-012 — No Deep-Linkable Member Profile URL
Member profiles only open as slide-over panels. No URL like `/members/[id]` exists. Cannot link to a specific member from emails or notifications.

## MED-013 — No Custom Error Pages (404, error.tsx)
No `not-found.tsx` or `error.tsx` in the app. Unhandled errors show Next.js generic pages.

## MED-014 — No HTTP Caching on Read-Heavy Analytics Endpoints
All API responses are `no-cache`. Analytics summary endpoints are called on every page load without CDN or server-side caching.

## MED-015 — Supabase Realtime vs 60s Polling Strategy Inconsistent
`use-realtime.ts` uses WebSockets. Language detection says 60s polling. Actual strategy used on Command Center page is unknown.
