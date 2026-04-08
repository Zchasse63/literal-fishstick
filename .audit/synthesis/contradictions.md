# Synthesis: Contradictions Between Layers

**Date:** 2026-04-08

---

## CON-001: "CRIT-AS-001 Events DEFAULT_STUDIO_ID" Severity
**Layers in tension:** api-surface (CRITICAL), security (HIGH)

api-surface classifies the Events API DEFAULT_STUDIO_ID as CRITICAL (multi-tenancy breach). Security classifies it as HIGH. The difference: api-surface views it as a data isolation failure even in single-studio deployments (bypasses the multi-tenant isolation pattern), while security views it as only becoming a data access control failure in multi-studio scenarios (which haven't launched yet). 

**Resolution:** CRITICAL classification is correct. Even for current single-studio use, the hardcoded constant bypasses established architectural patterns and will cause a silent data leak the moment a second studio is onboarded. Fix should be done before Phase 3.

---

## CON-002: Supabase anon key (NEXT_PUBLIC_ prefix) — Risk Level
**Layers in tension:** project-structure (MEDIUM — non-standard naming), security (INFO — intentional per Supabase design)

project-structure flags `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` as a concern (non-standard name may cause auth failures). security notes that the `NEXT_PUBLIC_` prefix is intentional — the Supabase anon key is meant to be client-side.

**Resolution:** Both concerns are valid but independent. (1) The non-standard variable name is a naming inconsistency that could cause configuration mistakes — worth fixing to `NEXT_PUBLIC_SUPABASE_ANON_KEY` for clarity. (2) The key being in the client bundle is intentional and correct per Supabase architecture. RLS enforces data access regardless of key exposure.

---

## CON-003: Glofox Sync Timeout Workaround
**Layers in tension:** project-structure (MED-PS-001 — cron not configured), performance-infra (HIGH-PI-002 — streaming workaround inadequate), integration (MED-INT-002 — no circuit breaker)

Each layer views the Glofox sync problem from a different angle: project-structure sees it as an incomplete infrastructure setup, performance-infra sees it as a timeout workaround that will fail at scale, integration sees it as a reliability concern.

**Resolution:** These are complementary, not contradictory. The root cause is architectural: Glofox sync should be an Inngest background function (not an HTTP endpoint), which would solve all three concerns simultaneously — no timeout limit, proper retry/backoff, and scheduled execution via Inngest's cron.

---

## CON-004: CSP "unsafe-eval" Assessment
**Layers in tension:** security (HIGH-SEC-001 — disables XSS mitigation), project-structure (noted in next.config.ts comments with Phase 5 plan)

Security flags `unsafe-eval` in CSP as HIGH risk. The project-structure layer notes this is a documented temporary decision with a concrete Phase 5 remediation plan (nonce-based CSP). 

**Resolution:** Both are accurate. The risk is real (HIGH severity) AND there's an existing mitigation plan. The finding should be labeled HIGH but with the Phase 5 timeline noted. It is not an oversight — it's a tracked technical debt item.

