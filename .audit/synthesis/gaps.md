# Coverage Gaps: What No Agent Fully Covered

**Synthesizer:** audit-synthesizer
**Completed:** 2026-03-20

---

## GAP-001 — Phase 1 Database Schema Not Available

**Description:** Only the Phase 2 migration SQL (`phase2-migration.sql`) and Phase 2 RPC functions (`phase2-rpc-functions.sql`) were available. The Phase 1 schema (tables: `profiles`, `classes`, `bookings`, `transactions`, `credit_packs`, `activity_log`, `email_send_log`, `ai_briefings`, `ai_cache`, `smart_segments`, `class_types`, `studios`) was inferred from API usage and TypeScript types but never directly verified against SQL.

**Risk:** Phase 1 schema may have additional drift, missing indexes, or RLS configuration issues not captured in this audit.

**Recommendation:** Obtain and review the Phase 1 migration SQL to close this gap.

---

## GAP-002 — Environment Variables Completeness Not Verified

**Description:** Required env vars were inferred from code usage but the actual `.env.local` was not read (it contains secrets). No audit was performed to verify all required env vars are documented and present in production Netlify environment.

**Risk:** Silent failures from missing env vars (e.g., `INNGEST_SIGNING_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_WEBHOOK_SECRET`) would appear as cryptic errors rather than clear configuration errors.

**Recommendation:** Create a `.env.example` file documenting all required environment variables with placeholder values.

---

## GAP-003 — Employee Portal Page Content Depth

**Description:** The employee portal was reviewed at layout and nav level. Page content for `timesheets`, `pay`, `performance`, `promo`, and `clock` sub-pages was not deeply inspected. Whether these pages have the same mock data issue as the admin marketing/analytics pages is unknown.

**Recommendation:** Review employee portal page implementations for hardcoded data before employee portal goes live.

---

## GAP-004 — Twilio and EasyPost Webhook Handlers

**Description:** The Stripe and Resend webhook handlers were fully reviewed. The Twilio and EasyPost webhook handlers at `/api/webhooks/twilio/route.ts` and `/api/webhooks/easypost/route.ts` were not inspected.

**Risk:** Unverified webhooks could allow spoofed SMS status or shipping events to corrupt order/delivery records.

**Recommendation:** Verify that both handlers perform proper signature/authentication verification before processing payloads.

---

## GAP-005 — OpenAPI Spec Content

**Description:** `GET /api/openapi` exists and returns an OpenAPI spec. The content of `apps/web/src/app/api/openapi/route.ts` was not reviewed. The quality, completeness, and accuracy of the spec is unknown.

**Recommendation:** Review the OpenAPI route to confirm it generates an accurate spec, and consider whether it should be gated behind authentication.

---

## GAP-006 — Supabase Storage Usage

**Description:** The `ShippingLabel` type references file URLs. Content posts can have image URLs. No Supabase Storage configuration or file upload logic was reviewed. Storage bucket policies, public vs private bucket configurations, and file size limits are unknown.

**Recommendation:** Review Supabase Storage bucket configuration for security (public vs private), file type allowlists, and size limits.

---

## GAP-007 — `use-command-center-data.ts` Implementation

**Description:** The Command Center's data hook (`use-command-center-data.ts`) was identified but not read in detail. This is the primary data-fetching hook for the most important page. Whether it uses polling (as documented) or WebSockets, how it handles errors, and whether it has any caching is unknown.

**Recommendation:** Review this file as part of the Command Center UX polish work.

---

## GAP-008 — Waivers and Legal Document System

**Description:** `Member.waiver_signed` and `waiver_signed_at` fields exist in types. `operations/documents` route exists. A waivers/documents system is implied. Neither the waiver signing UX nor the document storage/retrieval logic was reviewed.

**Risk:** If waiver signing is not properly enforced before a member's first class, the studio has liability exposure.

**Recommendation:** Verify the waiver signing flow is complete and enforced at the booking or check-in level.

---

## GAP-009 — Guest Pass System

**Description:** `packages/types/src/guests.ts` exists (detected in the types package index). Guest pass QR/link invite flow and conversion tracking are mentioned in CLAUDE.md as fully decided edge case policies. The implementation was not reviewed.

**Recommendation:** Review guest pass flow implementation for correctness against the edge case policy decisions.

---

## GAP-010 — `lib/ai/pricing-analyzer.ts` and `seasonal-predictor.ts`

**Description:** These AI modules exist but are not connected to any API routes. Their quality, prompt design, and output contracts were not reviewed.

**Recommendation:** These are presumably Phase 4 features. Ensure they are wired to routes before the analytics/pricing simulator goes live.
