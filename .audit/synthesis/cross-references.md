# Cross-Reference Analysis: Corroborated Findings

**Date:** 2026-04-08
**Synthesizer:** audit-synthesizer

---

## Findings Corroborated by Multiple Layers

### CR-001: DEFAULT_STUDIO_ID Multi-Tenancy Breach
**Corroborated by:** api-surface (CRIT-AS-001), security (HIGH-SEC-003), integration (MED-INT-001), data-model (schema context)

The Events API uses `DEFAULT_STUDIO_ID = '11111111-1111-1111-1111-111111111111'` instead of the authenticated user's `studio_id`. This is:
- A critical multi-tenancy violation (api-surface)
- A data access control failure for multi-studio scenarios (security)
- A fallback that affects Stripe customer creation (integration)
- Inconsistent with the multi-tenant isolation pattern applied to all other APIs (project-structure)

**Corroboration Strength: STRONG (4 layers)**

---

### CR-002: LLM SQL Execution Without Server-Side Validation
**Corroborated by:** ai-layer (CRIT-AI-001), security (CRIT-SEC-001), api-surface (endpoint noted), data-model (service-role key bypasses RLS)

The NL search feature generates SQL via Claude and executes it against the production database. Three layers independently flag this as a critical concern:
- No server-side SQL validation before execution (ai-layer)
- Potential data exfiltration from sensitive tables (security)
- Executes with service-role key that bypasses RLS (data-model/integration)

**Corroboration Strength: STRONG (3 layers)**

---

### CR-003: Missing Database Indexes on High-Traffic Queries
**Corroborated by:** data-model (HIGH-DM-001, MED-DM-002, MED-DM-003), performance-infra (SUPABASE_DB section)

Multiple layers identify the same missing indexes:
- `bookings(class_id, studio_id, status)` — capacity checks (data-model + performance-infra)
- `members(studio_id, membership_status)` — member directory (data-model + performance-infra)
- `daily_metrics(studio_id, metric_date)` — analytics queries (data-model + performance-infra)

**Corroboration Strength: STRONG (2 layers)**

---

### CR-004: Inconsistent API Authentication Patterns
**Corroborated by:** api-surface (HIGH-AS-001), security (auth section), testing-quality (inconsistency affects test patterns)

Corporate and Event routes use inline auth instead of `requireRole()`:
- The inline pattern doesn't get automatic improvements (api-surface)
- The inline corporate routes don't use the authenticated user's studio_id in some cases (security)
- Test patterns for corporate/events routes are different from the canonical pattern (testing-quality)

**Corroboration Strength: MODERATE (3 layers)**

---

### CR-005: No Migration Runner / Schema Drift Risk
**Corroborated by:** data-model (MED-DM-004), performance-infra (HIGH-PI-001), project-structure (scripts section)

Three layers all note that migration files are manually applied with no runner:
- `audit-fixes-migration.sql` must run after `phase2-migration.sql` (data-model)
- No migration history table or runner exists (performance-infra)
- SQL scripts live in `scripts/` as ad-hoc files (project-structure)

**Corroboration Strength: STRONG (3 layers)**

---

### CR-006: AI Layer Has No Observability
**Corroborated by:** ai-layer (HIGH-AI-002), integration (error handling section), performance-infra (MED-PI-003)

No error tracking for production failures:
- AI errors fall back silently (ai-layer)
- `console.error` calls don't appear in structured production logs (integration)
- No APM/error tracking configured anywhere (performance-infra)

**Corroboration Strength: STRONG (3 layers)**

---

### CR-007: execute-flow Automation Function Has No Tests
**Corroborated by:** testing-quality (HIGH-TQ-001), user-flow (automation flow section), ai-layer (Inngest background jobs)

The automation flow executor is:
- The most complex background function with no unit tests (testing-quality)
- A critical user journey path for marketing automation (user-flow)
- An AI-adjacent function that sends emails and waits between steps (ai-layer)

**Corroboration Strength: MODERATE (3 layers)**

---

### CR-008: Rate Limiting Only on AI + SMS Endpoints
**Corroborated by:** api-surface (HIGH-AS-002), integration (HIGH-INT-002 — rate limiter RPC may not exist), security (rate limiting section)

The rate limiter:
- Is missing from expensive non-AI operations (api-surface)
- Depends on a Supabase RPC that isn't verified to be deployed (integration)
- Fails open silently when RPC doesn't exist (security/integration)

**Corroboration Strength: MODERATE (3 layers)**

