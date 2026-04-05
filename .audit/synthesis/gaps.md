# Coverage Gaps

**Generated:** 2026-04-05
**Source layers:** 10

---

## Areas No Agent Covered

### GAP-001: Supabase Storage usage and access control

No agent audited Supabase Storage. The codebase references Storage URLs in `content_posts.image_url` (enforced to be Supabase Storage URLs at the API layer). Storage bucket policies, public vs. private bucket settings, and URL signing are not evaluated. For Phase 5 (member-facing surfaces), storage access control becomes critical.

---

### GAP-002: Email template security (Handlebars XSS)

The campaign send route uses Handlebars for email template rendering with `isomorphic-dompurify` for sanitization. No agent specifically evaluated whether DOMPurify is correctly applied to all user-generated content before rendering in email HTML. Handlebars auto-escapes by default, but triple-stache `{{{...}}}` patterns bypass escaping. This should be audited separately.

---

### GAP-003: Stripe subscription lifecycle edge cases

The Stripe webhook handler covers the main event types (subscription.created/updated/deleted, invoice events). No agent evaluated edge cases:
- What happens if `checkout.session.completed` fires but the member does not exist in Meridian yet
- Trial period subscription handling
- Prorated upgrade/downgrade webhook event sequencing
- Stripe subscription cancellation at period end vs. immediate cancellation

---

### GAP-004: Glofox API auth token lifecycle

The Glofox client uses an API token + API key pair. No agent evaluated:
- What happens when the Glofox token expires
- Whether there is a refresh mechanism
- How token rotation would be handled
- How Glofox auth failures surface in the sync state

---

### GAP-005: Magic link auth flow for members (Phase 5)

The current auth system uses Supabase Auth with magic links. No agent evaluated the planned member-facing magic link flow, email deliverability for magic links (separate from campaign emails), token expiry handling, or the mobile deep link handling for the iOS app (Phase 5).

---

### GAP-006: Inngest function failure budget and alert configuration

No agent evaluated Inngest Cloud configuration beyond basic function definitions. Key gaps: whether failure notifications are configured in the Inngest dashboard, what the retry behavior is for step-level failures (vs. function-level failures), and whether there are any concurrency limits that could cause Inngest job queuing under high load.

---

### GAP-007: Multi-tenant data isolation correctness at Phase 4 SaaS scale

Every agent noted the `DEFAULT_STUDIO_ID` fallback as a multi-tenancy risk, but no agent performed a comprehensive audit of every query to verify `studio_id` filtering. A complete audit would require checking each of the 150 route handlers and 20 Inngest functions to confirm every database query includes a `WHERE studio_id = ?` clause (or uses RLS). This gap is particularly important given the Phase 4 SaaS launch target.

---

### GAP-008: Dependency vulnerability scan

No agent audited npm dependencies for known CVEs. Key dependencies with historical vulnerability records include: `handlebars` (prototype pollution CVEs in older versions — version 4.7.8 is being used which should be patched), `reactflow`, `stripe` SDK. A `npm audit` or Snyk scan should be run as a separate security task.

---

### GAP-009: Employee portal geofence implementation

The geofence API (`/api/geofence/`) exists. The employee clock-in flow includes a geofence check. No agent audited the geofence distance calculation logic, whether the geofence center and radius are configurable, or what happens if a mobile device has location services disabled.

---

### GAP-010: Phone normalization coverage completeness

Phone normalization was added to 14 API routes in the recent sprint. No agent verified which routes still lack phone normalization or whether the normalization is applied consistently to both input (POST bodies) and stored data (existing records in the database).
