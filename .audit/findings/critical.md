# Critical Findings

Generated: 2026-04-02
Deduplicated and cross-referenced from 10 layer audit reports.

---

## CRIT-01: In-Memory Rate Limiter is Non-Functional in Production (Serverless)

**Root cause**: `lib/rate-limit.ts` uses a module-level `Map` that resets on every Netlify cold start.

**Corroboration**: 7 of 10 layers (project-structure, api-surface, testing-quality, ai-layer, integration, security, performance-infra). This is the most corroborated finding in the entire audit.

**Impact**: All 13 AI endpoints, the SMS send endpoint, and the leads capture endpoint have zero rate limiting in production. A single authenticated user can invoke the Anthropic API without throttling, creating unbounded cost exposure. The leads capture endpoint (public, rate-limited by IP) is also unprotected, enabling form spam.

**Evidence**: The file's own comment acknowledges this: "Suitable for single-instance deployments. For multi-instance / serverless, replace with a Redis-backed implementation."

**File**: `apps/web/src/lib/rate-limit.ts`
**Effort**: Medium (requires Upstash Redis or Supabase-backed implementation)
**Confidence**: 100%

---

## CRIT-02: Role Alias Mismatch -- "owner" Role Silently Denied by ~20 Routes

**Root cause**: `requireRole()` normalizes "owner" and "admin" as equivalent, but ~20 routes bypass it and check only `["admin", "manager"]`, excluding the canonical "owner" role.

**Corroboration**: 3 layers (api-surface C-1, security SEC-C2, project-structure HIGH-003 indirectly)

**Impact**: An account with the canonical "owner" role is silently refused from: managing leads, converting leads to members, managing content posts, activating automations, exporting financial reports, generating PDFs, sending SMS, and accessing payroll data. The highest-privilege account cannot access critical business functions.

**Affected routes**: `api/leads/*`, `api/content/*`, `api/automations/*`, `api/reports/*/export`, `api/reports/*/generate`, `api/sms/send`, `api/payroll/periods/*/approve`, `api/payroll/periods/*/calculate`, `api/payroll/periods/*/export`

**File**: ~20 route files with `ALLOWED_ROLES = ["admin", "manager"]`
**Effort**: Low (search-replace "admin" with "owner" in ALLOWED_ROLES, or migrate to `requireRole()`)
**Confidence**: 95%

---

## CRIT-03: Automation Cooldown System is Non-Functional (Schema/Code Mismatch)

**Root cause**: Phase 2 migration defines `last_automation_email_at`/`last_automation_sms_at` columns, but `helpers.ts` queries a non-existent `channel` column and upserts on a non-existent three-column constraint.

**Corroboration**: 2 layers (data-model C-002, integration I-C1)

**Impact**: `checkAutomationCooldown()` always returns false (no row matched). `updateCooldown()` silently fails. Every automation enrollment sends email and SMS on every trigger evaluation cycle with no throttling. Members enrolled in automations receive unbounded duplicate messages.

**Files**: `scripts/phase2-migration.sql` (lines 344-356), `apps/web/src/lib/inngest/helpers.ts` (lines 143-175)
**Effort**: Low (either add `channel` column to schema or rewrite helpers to use existing columns)
**Confidence**: 100%

---

## CRIT-04: `classes` Table API Writes to Non-Existent Columns

**Root cause**: API route handlers for `/api/classes` use `start_time`/`end_time` but the database columns are `starts_at`/`ends_at`.

**Corroboration**: 1 layer directly (data-model C-001), corroborated by seed SQL, Inngest cron, and SCHEMA_CONTEXT all using `starts_at`.

**Impact**: Class creation via the admin dashboard inserts rows with NULL `starts_at`/`ends_at`. Existing classes display correctly (imported via seed SQL with correct columns), but new classes created through the UI will have no time information.

**Files**: `apps/web/src/app/api/classes/route.ts`, `apps/web/src/app/api/classes/[id]/route.ts`
**Effort**: Low (rename `start_time` to `starts_at` and `end_time` to `ends_at` in both files)
**Confidence**: 95%

---

## CRIT-05: Campaign Builder "Send" and "Save as Draft" Buttons Have No API Call

**Root cause**: The campaign builder's final action buttons are `<button>` elements with no `onClick` handler and no `fetch` call.

**Corroboration**: 1 layer directly (user-flow UF-C-1), supported by testing-quality's finding that E2E tests never test mutations.

**Impact**: The entire campaign creation flow is a visual prototype. Admins cannot launch, schedule, or save any new campaign. The `POST /api/campaigns` and `POST /api/campaigns/send` endpoints exist and are functional but are never called by the UI. The 3-step campaign builder (Setup, Content, Review) is fully interactive but produces no result.

**File**: `apps/web/src/app/(admin)/marketing/campaigns/new/page.tsx` (line 1343)
**Effort**: Low (add onClick handler that calls the existing API endpoint)
**Confidence**: 100%

---

## CRIT-06: Automation Builder "Save" and "Activate" Buttons Have No API Call

**Root cause**: Same pattern as CRIT-05. ReactFlow-based automation builder stores nodes/edges only in React state; neither Save Draft nor Save & Activate has an onClick handler.

**Corroboration**: 1 layer (user-flow UF-C-2)

**Impact**: Any automation flow built by an admin is lost on page navigation. The `POST /api/automations` endpoint exists but is never called. This is the highest-value feature in the Marketing module.

**File**: `apps/web/src/app/(admin)/marketing/automations/new/page.tsx`
**Effort**: Low (serialize ReactFlow state to request body, call existing API endpoint)
**Confidence**: 100%

---

## CRIT-07: Node Version Mismatch -- CI (Node 22) vs Netlify (Node 20)

**Root cause**: `package.json` requires `>=22.0.0`, CI uses Node 22, `netlify.toml` sets `NODE_VERSION = "20"`.

**Corroboration**: 2 layers (project-structure CRIT-001, performance-infra PERF-04). Performance-infra adds that `@types/node` is `^20`, creating a third inconsistency.

**Impact**: Code that passes CI on Node 22 may fail or behave differently on Netlify's Node 20. Next.js 16 with React 19 may use Node 22-specific APIs. A production build failure would take the platform offline.

**Files**: `netlify.toml` (line 10), `package.json` (engines), `apps/web/package.json` (@types/node)
**Effort**: Low (change `NODE_VERSION = "22"` in netlify.toml, update @types/node to ^22)
**Confidence**: 100%

---

## CRIT-08: AI-Generated SQL Has Bypassable Studio Isolation (Multi-Tenant Risk)

**Root cause**: `/api/ai/search` executes AI-generated SQL. The studio_id check is a string presence check (`sql.includes(studio_id)`) which can be satisfied while still querying other tenants via JOINs or UNIONs. No LIMIT enforcement.

**Corroboration**: 2 layers (security SEC-C3, ai-layer M-03 and M-06)

**Impact**: In a multi-tenant deployment, a crafted natural language query could extract data from other studios. Current single-tenant deployment prevents cross-tenant leakage (only one studio exists). This is a blocking pre-condition for SaaS multi-tenancy.

**Note**: The SQL forbidden keyword check and SELECT-only enforcement are strong baseline protections. The gap is specifically in the studio isolation guarantee.

**Files**: `apps/web/src/app/api/ai/search/route.ts`, `apps/web/src/lib/anthropic.ts` (translateToSQL)
**Effort**: Medium (rewrite `execute_readonly_sql` RPC to enforce studio_id server-side)
**Confidence**: 85% (exploitability depends on `execute_readonly_sql` implementation, which was not found in the repo)
