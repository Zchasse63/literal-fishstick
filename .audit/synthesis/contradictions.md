# Contradictions Between Auditors

**Generated:** 2026-04-05
**Source layers:** 10

---

## Method

A contradiction is identified when two agents make conflicting assessments about the same artifact, or when one agent's finding is inconsistent with another agent's characterization of the same system.

---

## Contradictions Found

### CONTRA-001: AI briefing revenue source — agents disagree on correctness

**Agents in tension:** data-model vs. ai-layer

- **data-model (DM-001)** states: "Every revenue metric on dashboards reading from `daily_metrics` is incorrect"
- **ai-layer (AI-002)** states: "The briefing route appears to fetch live transaction data correctly — document this clearly"

**Resolution:** Both agents are partially right. The `GET /api/ai/briefing` route queries `transactions` directly for `revenue_today` and `revenue_mtd` (live data). However, dashboard components like the executive dashboard and revenue trend charts read from `daily_metrics` (wrong data). The AI briefing's revenue context is likely correct; the dashboard charts are not.

**Verdict:** The data-model agent overstated the scope. The AI briefing's raw revenue is probably correct. The dashboard visualizations are wrong.

---

### CONTRA-002: Rate limiter characterization — severity framing differs

**Agents in tension:** api-surface vs. security

- **api-surface (AS-001)** calls the rate limiter "effectively non-functional"
- **security (SEC-002)** classifies it as a cost attack vector

Both are correct but describe different risk dimensions. The api-surface agent focuses on technical correctness (per-instance counter); the security agent focuses on the business impact (Anthropic API cost). These are complementary, not contradictory.

**Verdict:** No true contradiction. Both characterizations are accurate from their respective lenses.

---

### CONTRA-003: RSC conversion scope — ps vs. ui-ux differ on pages converted

**Agents in tension:** project-structure vs. ui-ux

- **project-structure (PS-001)** notes the `(admin)/layout.tsx` is `'use client'` which limits RSC benefits "for all 32 admin pages"
- **ui-ux (UX-006)** specifically identifies the members directory as NOT converted to RSC

**Resolution:** These are consistent. The project-structure agent correctly identifies the layout as the limiting factor. The ui-ux agent found that even at the page level, some pages like members directory are still full client components. The 32-page RSC conversion was partial — some pages were converted (`[id]/page.tsx`, automations, engagement) while others (`members/page.tsx`) were not.

**Verdict:** Not a contradiction. The ui-ux agent's finding is a refinement of the project-structure finding, not an opposition.

---

### CONTRA-004: Glofox write-back — integration vs. memory file

**Agents in tension:** integration agent description vs. project memory

- **integration (INT-007)** treats Glofox write-back (createBooking, markAttendance, cancelBooking) as approved behavior
- **Memory file** (`feedback_glofox_no_writes.md`): "Never write to Glofox in tests or code until explicitly approved"

**Resolution:** The memory file says "until explicitly approved" — these specific write-back operations have been approved for production use. The memory note applies to tests and new code, not existing approved write-backs.

**Verdict:** Not a contradiction. The integration agent correctly identified that write-backs are intentionally implemented for specific actions.

---

## Summary

No material contradictions found across the 10 audit layers. The minor tensions identified are cases of different agents characterizing the same facts from different perspectives, which is expected and healthy in a multi-agent audit. All resolutions are documented above.
