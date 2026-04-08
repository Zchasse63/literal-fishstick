# Critical Findings

**Date:** 2026-04-08

---

## CRIT-1 (= CRIT-AS-001 / HIGH-SEC-003): Events API Multi-Tenancy Breach

**Source:** api-surface, security, integration
**Corroboration:** Cross-reference CR-001

The Events API (`/api/events`, `/api/events/[id]`) uses `DEFAULT_STUDIO_ID = '11111111-1111-1111-1111-111111111111'` (hardcoded in `lib/constants.ts`) instead of the authenticated user's `studio_id`. Every event query, creation, and modification is routed to the hardcoded default studio.

**Impact:** When a second studio is onboarded (Phase 3 SaaS expansion), users from Studio B would be able to read and modify Studio A's events. This is a data isolation failure that will be impossible to detect in production if not fixed beforehand.

**Fix:** Replace `DEFAULT_STUDIO_ID` usage in all event route handlers with `profile.studio_id` from the authenticated user. Mirror the pattern used in all other API domains.

---

## CRIT-2 (= CRIT-AI-001 / CRIT-SEC-001): LLM SQL Execution Without Server-Side Validation

**Source:** ai-layer, security
**Corroboration:** Cross-reference CR-002

The `/api/ai/search` endpoint accepts user input, sends it to Claude to generate SQL, and executes the LLM-generated query directly against the production database via `supabase.rpc('execute_read_query', ...)`. There is no server-side parse to verify the returned query is a single, safe SELECT statement before execution.

**Impact:** (1) Prompt injection via user search input could generate SELECT statements that exfiltrate sensitive data (employee direct deposit info, wallet balances, tax IDs). (2) A malformed or malicious SQL query (nested loops, CARTESIAN joins) could cause database denial-of-service. (3) If the read-only RPC doesn't exist or isn't configured correctly, the fallback may execute with service-role permissions.

**Fix:** Before executing any LLM-generated SQL: (1) Parse the string to verify it contains exactly one `SELECT` statement with no semicolons or DDL/DML keywords using a lightweight SQL parser. (2) Add a query timeout via `SET statement_timeout`. (3) Log all AI-generated queries for audit purposes.

