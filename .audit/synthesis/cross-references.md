# Cross-Reference Analysis

Generated: 2026-04-02
Source layers: 10 (project-structure, data-model, api-surface, testing-quality, ui-ux, user-flow, ai-layer, integration, security, performance-infra)

---

## File Hotspots

Files referenced by 3 or more independent layer auditors, indicating architectural centrality and outsized impact if issues exist in them.

---

### `lib/rate-limit.ts` -- Referenced by 7 layers

- **project-structure**: Flagged as MED-008 -- in-memory Map incompatible with Netlify serverless deployment.
- **api-surface**: Flagged as C-2 -- rate limiter provides zero protection; all 13 AI endpoints and SMS/leads endpoints are unbounded.
- **testing-quality**: Noted rate limiter unit tests as "excellent" (boundary conditions, cleanup). Tests pass because they test single-process behavior which is correct for that context.
- **ai-layer**: Flagged as H-03 -- in-memory rate limiter bypassed in serverless; Anthropic cost exposure unbounded.
- **integration**: Flagged as I-H1 -- confirmed carryover; neither AI nor leads capture rate limiting is enforced in production.
- **security**: Flagged as SEC-H3 -- unlimited AI API cost exposure with no production throttling.
- **performance-infra**: Flagged as PERF-01 -- runaway AI costs; promoted to CRITICAL.

**Combined assessment**: This is the single most corroborated finding in the entire audit. Seven of ten layers independently identified the same root cause: the in-memory Map resets on every cold start in Netlify Functions. The testing-quality layer confirmed the code logic is correct in isolation -- the problem is purely architectural (serverless deployment model). Confidence: 100%. This finding is consolidated as **ROOT-CAUSE-01** in the findings.

---

### Hardcoded `STUDIO_ID = '11111111-...'` -- Referenced by 8 layers

- **project-structure**: HIGH-002 -- 218 occurrences across 179 files; `getStudioId()` utility exists but only 10 files migrated.
- **data-model**: H-001 -- same 218 hardcoded IDs; single-tenancy embedded in code.
- **api-surface**: H-3 -- 43 API routes define this as a module-level constant.
- **ui-ux**: M-4 -- 104 page files contain the hardcoded ID; if changed, every page breaks with no compile-time warning.
- **ai-layer**: H-01 -- 7 AI API routes hardcode it, processing sensitive behavioral data against wrong studio.
- **integration**: I-M2 (Stripe), I-M5 (Inngest), I-M6 (campaigns) -- hardcoded in Stripe metadata, all 10 Inngest cron jobs, and the campaign send route.
- **security**: SEC-M5 -- 43 API routes create multi-tenant data exposure risk; blocking for SaaS.
- **performance-infra**: (Indirectly via Inngest cron jobs using `DEFAULT_STUDIO_ID || '11111111...'`)

**Combined assessment**: Eight layers flagged this. The count varies by report (218 total occurrences, 179 files, 43 API routes, 104 pages, 7 AI routes, 10 Inngest functions) because each layer measured a different subset. The root cause is singular: the codebase was built for a single tenant and the migration utility `getStudioId()` has not been applied. This is not a bug -- everything works for The Sauna Guys -- but it is the number one blocker for the SaaS goal. Consolidated as **ROOT-CAUSE-02**.

---

### `e2e/.auth/admin.json` and `e2e/.auth/employee.json` -- Referenced by 4 layers

- **project-structure**: CRIT-002 -- live JWT credentials committed; no `.gitignore` inside `e2e/.auth/`.
- **testing-quality**: C1 -- refresh token `iealmrlfxkby` still valid; Supabase project ref exposed via cookie name.
- **security**: SEC-C1 -- credential exposure in version control; httpOnly: false, secure: false visible in the committed files.
- **integration**: (Referenced indirectly as a credential hygiene issue)

**Combined assessment**: Three layers independently flagged this with CRITICAL severity, and testing-quality provided the most detailed evidence (specific token values, expiry timestamps). The security layer added the cookie attribute analysis. The testing-quality layer confirmed via `git log --all --full-history` that the files were never committed to git history -- the risk is working-directory exposure only. However, the `apps/web/.gitignore` does contain `e2e/.auth/` (line 17), which means the root `.gitignore` gap identified by security is a defense-in-depth concern. Consolidated as **ROOT-CAUSE-03**.

---

### `lib/anthropic.ts` (1,699 lines) -- Referenced by 4 layers

- **project-structure**: HIGH-005 -- misnamed file; should be in `lib/ai/` directory with siblings.
- **ai-layer**: H-04 -- 11 distinct AI features crammed into one file; inconsistent import paths with `lib/ai/`.
- **data-model**: Referenced as source of `SCHEMA_CONTEXT` string (which contains stale table references).
- **performance-infra**: (Indirectly -- file exceeded read limits during audit, indicating maintenance burden)

**Combined assessment**: The file is architecturally misplaced and too large. It contains the briefing, recommendations, campaign copy, health score, NL search, lead scoring, subject lines, send-time optimization, campaign summary, automation recommendations, and `SCHEMA_CONTEXT`. The `lib/ai/` directory was built specifically to hold these features but only received the newer modules. This is a refactoring debt, not a bug. Consolidated under **ROOT-CAUSE-04** (code organization).

---

### `automation_cooldowns` table -- Referenced by 3 layers

- **data-model**: C-002 -- schema defines `last_automation_email_at`/`last_automation_sms_at`; code queries `channel` + `last_sent_at`.
- **integration**: I-C1 -- confirmed the mismatch with code samples from both sides; cooldown check always returns false.
- **ai-layer**: (Indirectly -- automation flows referenced in AI insights)

**Combined assessment**: Two layers independently discovered the same schema/code mismatch and both rated it CRITICAL. The integration layer provided the most complete evidence (both the DDL and the TypeScript code). The impact is confirmed: automation sends are unbounded because the cooldown check silently fails. Consolidated as **ROOT-CAUSE-05**.

---

### `requireRole()` vs ad-hoc auth -- Referenced by 5 layers

- **project-structure**: HIGH-003 -- only 58 of 148 routes use `requireRole()`; 90 use ad-hoc patterns.
- **api-surface**: C-1 (role alias mismatch), M-1 (114 ad-hoc routes) -- the ad-hoc routes check `["admin", "manager"]` instead of `["owner", "manager"]`.
- **security**: SEC-C2 -- role alias mismatch causes silent authorization bypass for "owner" accounts across ~20 routes.
- **data-model**: H-001 -- ad-hoc routes also hardcode studio ID, creating a compound problem.
- **performance-infra**: PERF-13 -- ad-hoc routes duplicate the auth pattern, causing an extra profiles query per request.

**Combined assessment**: The role alias mismatch is CRITICAL -- the "owner" role (the highest privilege) is silently refused by ~20 routes including leads, content, automations, reports, payroll, and SMS. The ad-hoc auth pattern is the root cause: if all routes used `requireRole()`, the alias handling would be automatic. Consolidated as **ROOT-CAUSE-06** (auth fragmentation) and **ROOT-CAUSE-07** (role alias bug).

---

### Webhook signature verification bypasses -- Referenced by 3 layers

- **api-surface**: H-1 -- EasyPost and Twilio webhooks skip verification when env vars absent.
- **integration**: I-H2 (EasyPost), I-H3 (Twilio) -- same finding with code samples.
- **security**: SEC-H1 -- same two handlers; security layer also noted Stripe and Resend are correctly always-verified.

**Combined assessment**: All three layers agree on the finding and the fix. The risk is real but situational: it only matters if the env vars are absent in production, which is likely in preview/staging deployments. Consolidated as **ROOT-CAUSE-08**.

---

### Inngest signing key not enforced -- Referenced by 3 layers

- **api-surface**: H-2 -- no explicit signing key in serve() call; comment claims verification but key may be absent.
- **integration**: I-L5 -- same finding; no `INNGEST_SIGNING_KEY` found in any config file.
- **security**: SEC-H2 -- all 19 background jobs can be triggered externally if key absent.

**Combined assessment**: Three layers confirm. The risk is that anyone who discovers `/api/inngest` can trigger arbitrary background functions (backfills, automation flows, cron jobs) if the signing key is not configured. Consolidated as **ROOT-CAUSE-09**.

---

### `classes` table column name mismatch -- Referenced by 2 layers

- **data-model**: C-001 -- API writes `start_time`/`end_time` but DB columns are `starts_at`/`ends_at`.
- **user-flow**: (Indirectly -- schedule page functionality confirmed working, suggesting the read path uses different columns or the data was imported correctly via seed SQL which uses `starts_at`)

**Combined assessment**: The data-model layer identified this as CRITICAL with strong evidence from three independent sources (seed SQL, Inngest cron, SCHEMA_CONTEXT all use `starts_at`). The class creation API route is confirmed broken. However, the schedule page displays classes correctly, which means the read path in the hook (`useClasses`) likely uses the correct column name. The bug is isolated to the `/api/classes` POST/PUT route handler. Consolidated as **ROOT-CAUSE-10**.

---

### Campaign builder and automation builder -- non-functional save buttons -- Referenced by 2 layers

- **user-flow**: UF-C-1 (campaign send), UF-C-2 (automation save) -- buttons have no onClick handlers; no fetch calls exist in the files.
- **testing-quality**: (Indirectly -- E2E tests only check page loads, never test mutations, so these dead buttons are invisible to the test suite)

**Combined assessment**: The user-flow layer provided the definitive evidence. The campaign builder and automation builder are fully built UI prototypes with no backend wiring. The API routes exist and are functional (`POST /api/campaigns`, `POST /api/automations`). The gap is purely in the frontend button handlers. Consolidated as **ROOT-CAUSE-11**.

---

## Entity Cross-References

### Auth/Session System
- Referenced by: project-structure, api-surface, security, testing-quality, user-flow, performance-infra
- Findings: `getSession()` vs `getUser()` (security), no role-based routing (user-flow), ad-hoc auth in 90+ routes (api-surface, project-structure), cookie security attributes unverified (security)
- Combined confidence: 95% -- all layers agree the auth core is sound but the enforcement surface is fragmented

### AI Module Architecture
- Referenced by: project-structure, ai-layer, testing-quality, performance-infra, security
- Findings: 5 dead-code modules (ai-layer, project-structure), stale model IDs in 6 modules (ai-layer), no API tests for any AI route (testing-quality), no timeouts (ai-layer, integration, performance-infra)
- Combined confidence: 95% -- consistent across all layers that examined AI

### Supabase Client Instantiation
- Referenced by: project-structure, data-model, security
- Findings: 4 different instantiation paths (project-structure), `@meridian/supabase` package entirely unused (project-structure, data-model), auth context imports directly from `@supabase/ssr` instead of centralized client (project-structure, security)
- Combined confidence: 85% -- well-evidenced but lower impact than other findings

### Dark Mode
- Referenced by: ui-ux (C-1), performance-infra (indirectly via client-only rendering)
- Findings: Toggle exists and persists state, CSS tokens defined correctly, but zero pages use `dark:` variant classes. Recharts hex colors hardcoded.
- Combined confidence: 100% -- single-layer finding but exhaustive evidence

### No Phase 1 Schema DDL
- Referenced by: data-model (H-002), project-structure (indirectly via missing migration ordering)
- Findings: ~40 Phase 1 tables exist only in the live Supabase instance with no source-controlled DDL
- Combined confidence: 100% -- verified by absence in the file system
