# Synthesis: Coverage Gaps

**Date:** 2026-04-08

---

## GAP-001: Stripe Webhook Event Coverage
No layer fully audited which Stripe events are handled in the webhook. The webhook handler processes `customer.subscription.*`, `invoice.*`, and `payment_intent.*` events, but the complete set of handled vs. unhandled events wasn't mapped. Missing handlers for events like `customer.deleted`, `payment_method.detached`, or `subscription_schedule.*` could cause data inconsistencies.

---

## GAP-002: Inngest Function Cron Schedules
The 11 cron-type Inngest functions were inventoried but their cron schedules were not read. It's unclear if `cron-daily-metrics` runs at midnight, `cron-member-enrichment` runs hourly or daily, etc. Overlapping schedules or missing schedules could cause data freshness issues.

---

## GAP-003: RLS Policy Coverage Map
The middleware comment notes "11 Phase 2 tables use `current_setting('app.studio_id')::uuid` in RLS policies." The complete RLS policy map across all 50+ tables was not produced. Tables from Phase 1 (bookings, classes, members, etc.) may have different or no RLS policies that weren't audited.

---

## GAP-004: Supabase Storage Usage
Supabase Storage is used for product images (`/api/products/[id]/images`), employee documents, and report exports. The storage bucket configuration, access policies, and potential exposure of sensitive documents (employee W-2s, I-9s) via storage URLs was not audited.

---

## GAP-005: Auth Context for Multi-Role Users
The dual-role scenario (admin who is also a member, trainer who is also a member) is mentioned in the PRD as a key differentiator. The actual implementation of how the auth context handles role switching, and whether there are any UI affordances or API considerations for multi-role users, was not deeply audited.

---

## GAP-006: Handlebars Template Security
The email template system uses Handlebars for rendering. The specific templates and whether any templates accept user-controlled input via triple-stache `{{{ }}}` (unescaped HTML) were not fully audited.

---

## GAP-007: Glofox Write-Back Conflict Resolution
The `glofox_sync_conflicts` table exists for tracking write-back conflicts, but the conflict resolution workflow and any admin UI for resolving conflicts was not audited. If Glofox write-backs fail at scale, this table could accumulate thousands of unresolved conflicts with no actionable workflow.

---

## GAP-008: pgvector / Vector Search
The PRD mentions pgvector for AI-powered search and retrieval. The current implementation uses NL-to-SQL for search. Whether pgvector is enabled on the Supabase instance and whether any vector embedding tables exist was not audited.

---

## GAP-009: Member-Facing API Security
Phase 5 will add a web booking portal and iOS app that call the same API. The current API has no CORS headers, no versioning, and no API key mechanism for mobile clients. The readiness of the current API surface for member-facing use was not formally assessed.

---

## GAP-010: Twilio Webhook Verification
The `/api/webhooks/twilio` endpoint exists but its signature verification implementation was not inspected. Twilio uses a different verification mechanism than Stripe or Resend (HMAC SHA-1 of the request body with the auth token). If not verified, this endpoint is an open webhook.

