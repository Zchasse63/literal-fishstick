# Contradictions Between Agent Reports

**Synthesizer:** audit-synthesizer
**Completed:** 2026-03-20

---

## CONTRADICTION-001 — Realtime Strategy: WebSockets vs 60s Polling

**Agent 1 (language-detection.json):** `"realtime": "60s polling (Phase 1)"`
**Agent 2 (ui-ux, integration):** `use-realtime.ts` implements Supabase Realtime WebSocket subscriptions, not polling

**Resolution:** The language detection metadata appears to be an outdated planning artifact. The actual codebase contains a WebSocket-based realtime hook. The Command Center (`use-command-center-data.ts`) may still use polling for its periodic data refreshes, meaning both patterns coexist. This is not a contradiction in the code itself but in the documentation vs implementation.

**Action:** Audit `use-command-center-data.ts` to determine whether the Command Center uses polling or WebSockets, then update the language-detection.json to reflect current reality.

---

## CONTRADICTION-002 — Automation Flow Status Field

**Agent 1 (data-model):** Identified as CRITICAL — SQL schema has `is_active BOOLEAN`
**Agent 2 (integration):** Confirmed as HIGH — `evaluate-triggers.ts` queries `status = 'active'`
**Agent 3 (user-flow):** Confirmed as MEDIUM — described as automation "silently broken"

**Resolution:** All three agents agree the bug exists. The severity discrepancy (CRITICAL vs HIGH vs MEDIUM) reflects different scoping. data-model rated it CRITICAL because it breaks all automation; integration rated it HIGH because it's a data contract violation; user-flow rated it MEDIUM because it was analyzed in the context of UX flow breakage. The true severity is CRITICAL — the entire automation engine is non-functional.

---

## CONTRADICTION-003 — SMS Provider Status

**Agent 1 (integration):** "Twilio is installed and real"
**Agent 2 (language-detection.json):** `"sms_provider": "Twilio (with stub fallback)"`
**Agent 3 (project-structure, data):** SMS abstraction layer has a StubProvider as default

**Resolution:** Twilio is installed as a real npm dependency and the `TwilioProvider` class exists. However, the factory `createSMSProvider()` defaults to `StubProvider` unless `SMS_PROVIDER=twilio` is set. All SMS sends are currently no-ops. This is intentional for Phase 2 — no contradiction, just documentation ambiguity.

---

## CONTRADICTION-004 — Testing: `test_frameworks` is Empty vs No Tests

**Agent 1 (language-detection.json):** `"test_frameworks": []`
**Agent 2 (testing-quality):** Confirms zero tests, but notes Vitest and Playwright would be appropriate additions

**Resolution:** No contradiction. Both are consistent: empty test_frameworks because nothing is installed.

---

## CONTRADICTION-005 — `automation_cooldowns` Schema

**Agent 1 (data-model):** Phase 2 SQL defines cooldowns with `last_automation_email_at` and `last_automation_sms_at` columns (per-channel timestamps)
**Agent 2 (integration, helpers.ts):** `checkAutomationCooldown()` queries `.select('last_sent_at').eq('channel', channel)` — expects a separate row per channel with a `channel` TEXT column and `last_sent_at` timestamp

**Resolution:** The SQL schema and the application code model the `automation_cooldowns` table differently. The SQL schema has one row per member with two timestamp columns (one per channel). The Inngest helper expects one row per member-channel combination with a `channel` TEXT discriminator. These schemas are incompatible. The helper's `upsert` with `{ onConflict: 'member_id,studio_id,channel' }` will fail because `channel` is not a column in the SQL-defined schema.

**This is an additional CRITICAL schema mismatch** beyond those identified in data-model.
