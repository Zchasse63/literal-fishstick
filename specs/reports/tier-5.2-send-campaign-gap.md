# Tier 5.2 — Marketing: Send Campaign (GAP-FILED)

**Date:** 2026-04-10
**Status:** DEFERRED to feature-dev backlog B12
**Reason:** Send pipeline is wired to phantom schema

## Summary

Tier 5.2 was to exercise `POST /api/campaigns/send` with a mocked Resend client. Preliminary route analysis during Tier 5.1 discovered that the entire campaigns subroute surface (7 files, 1,663 LOC) is wired to a deprecated column set that no longer exists in the `campaigns` table:

- `body_template` (replaced by `body_html` / `body_text` / `sms_body`)
- `variant_a_subject`, `variant_a_body`, `variant_b_subject`, `variant_b_body` (replaced by `ab_variants jsonb`)
- `ab_split_percentage`, `ab_auto_select_winner` (live inside `ab_variants` now)
- `opened_count`, `clicked_count`, `bounced_count`, `failed_count`, `unsubscribed_count` (renamed to singular `open_count`, `click_count`, `bounce_count`, `unsubscribe_count`; `failed_count` has no replacement)
- `deleted_at` soft-delete column does not exist on `campaigns`

Without rewriting `send/route.ts` (385 LOC) AND its callers (`process-scheduled/route.ts` 348 LOC, `[id]/schedule/route.ts` 139 LOC, `[id]/select-winner/route.ts` 126 LOC), the send pipeline cannot execute even against mocked Resend — every query selects phantom columns and 500s before the mock is reached.

## Decision

Per the QA pipeline's narrow-scope doctrine, Tier 5.2 is filed as a deferred gap:

1. **No tests written** — they would fail deterministically against the broken routes.
2. **No route fixes applied** — scope is too large for a single tier and crosses into feature-dev territory.
3. **Full rewrite tracked in B12** (see `specs/bugs/feature-dev-backlog.md`).

## What a future Tier 5.2 should cover (post-B12)

| # | Scenario | Priority |
|---|---|---|
| 1 | `POST /api/campaigns/send` with draft campaign → Resend called with rendered HTML + text | @p0 |
| 2 | Send with A/B enabled → two Resend batches, one per variant with split percentage respected | @p0 |
| 3 | Send with SMS type → currently stubbed, test for provider-agnostic enqueue | @p0 |
| 4 | Idempotent retry — resending an already-`sent` campaign 409s | @p1 |
| 5 | Resend 500 error → campaign moves to `paused`, activity_log captures reason | @p1 |
| 6 | `POST /api/campaigns/[id]/send-test` with stub recipient → Resend called once, no state change | @p1 |

## Dependencies

- **B12 resolution** — rewrite 9 campaign subroute files to match real schema
- **Resend mock fixture** — `e2e/fixtures/resend.ts` (not yet created, would be shared with Tier 5.10 AI email draft tests)
- **Tier 5.1 regression** — already green; new Tier 5.2 specs must not break the list/create path
