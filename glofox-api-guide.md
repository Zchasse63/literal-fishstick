# Glofox API Complete Reference Guide

**API Version:** 2.2.0 (OpenAPI 3.1.0)
**Base URL:** `https://gf-api.aws.glofox.com/prod/`
**Generated:** 2026-03-31

---

## Authentication

All requests require two headers:
- `x-glofox-api-token` — Your integrator API token (also acts as branch ID for branch-scoped calls)
- `x-api-key` — Your integrator API key

Optional: `x-glofox-impersonated-member-id` — Staff can perform actions on behalf of a member

---

## API Endpoints (57 total)

### Branches / Locations (3 endpoints)

| Method | Path | Summary |
|--------|------|---------|
| POST | `/v3.0/locations/retrieve` | Retrieve locations for allowed namespaces |
| GET | `/2.0/branches/{id}` | Get a single branch by ID |
| GET | `/v3.0/locations/{locationId}/products` | Get all products for a location |

**Branch response fields:** `_id`, `name`, `namespace`, `address` (street, city, state, country_code, district, lat/lng, currency, timezone_id, postal_code), `phone`, `email`, `facebook`, `instagram`, `website`, `about`, `corporate_id`

---

### Users / Members (14 endpoints)

| Method | Path | Summary |
|--------|------|---------|
| GET | `/2.0/members` | Get all clients (paginated) |
| GET | `/2.0/members/{userId}` | Get a single user |
| PUT | `/2.0/members/{userId}` | Update a user |
| POST | `/2.0/register` | Register a new user |
| POST | `/2.0/reset` | Request password reset link |
| GET | `/2.0/staff` | Get staff members |
| GET | `/2.0/staff/{staffId}` | Get a single staff member |
| GET | `/2.1/branches/{branchId}/users` | Search members by email |
| POST | `/2.1/branches/{branchId}/leads` | Create a lead [DEPRECATED] |
| POST | `/2.1/branches/{branchId}/leads/filter` | Get all leads (with filters) |
| POST | `/2.1/branches/{branchId}/leads/{userId}/interactions` | Add interaction/note |
| GET | `/2.1/branches/{branchId}/leads/{userId}/interactions` | Get user interactions |
| GET | `/2.2/users/{parentId}/linked-accounts` | Get child/family accounts |
| POST | `/assets/upload/users/{userId}/profile` | Upload profile image |

**Member data fields:** `_id`, `first_name`, `last_name`, `phone`, `email`, `type` (member/lead), `active`, `birth`, `emergency_contact`, `access_barcode`, `image_url`, `lead_status`, `joined_at`, `created`, `modified`, `parent_id`, `use_parent_email`, `use_parent_phone`, `source[]`, `consent` (email/sms/push), `membership` (see below), `leads` (contact_source, marketing_source), `address` (street, city, state, country, postal_code, country_code)

**Embedded membership on user:** `type` (payg/time/time_classes), `start_date`, `expiry_date`, `status` (ACTIVE/INACTIVE/CANCELED/etc), `membership_name`, `plan_code`, `plan_name`, `plan_price`, `plan_upfront_fee`, `user_membership_id`, `branches[]`, `subscription` object

**Staff data fields:** `_id`, `branch_id`, `namespace`, `active`, `bookable`, `type`, `first_name`, `last_name`, `description`, `name`, `image_url`, `modified`

**Lead filters available:** `branch_id`, `home_user`, `deleted`, `lead_status[]`, `source[]`, `name`, `created` (range), `modified` (range), `checkin_num` (range), `booking_num` (range), `last_booking` (range), `last_interaction` (range), `expiry` (range), `status_history` (range)

**Pagination:** `page` (int), `limit` (int) → response includes `has_more`, `total_count`
**Modified date filter:** `utc_modified_start_date`, `utc_modified_end_date` (for incremental sync)

---

### Memberships (5 endpoints)

| Method | Path | Summary |
|--------|------|---------|
| GET | `/2.0/memberships` | Get all membership plans |
| GET | `/2.0/memberships/{membershipId}` | Get a single membership plan |
| POST | `/2.2/branches/{branchId}/users/{userId}/memberships/{membershipId}/plans/{planCode}/purchase` | Purchase membership |
| POST | `/2.2/branches/{branchId}/charges/{chargeId}/finalize-flexible` | Purchase with flexible payment |
| POST | `/v3.0/memberships/{membershipId}/cancel` | Cancel a user membership |

**Membership plan fields:** `_id`, `branch_id`, `namespace`, `active`, `name`, `description`, `buy_just_once`, `plans[]` (code, type, duration_time_unit, duration_time_unit_count, starts_on, price, upfront_fee)

**Cancellation options:** `when` (immediate/end_of_period), `local_date`, `reason`

---

### Credits (1 endpoint)

| Method | Path | Summary |
|--------|------|---------|
| GET | `/2.0/credits` | Get a user's credit packs |

**Credit pack fields:** `_id`, `branch_id`, `user_id`, `model`, `num_sessions`, `active`, `bookings[]`, `start_date`, `end_date`, `membership_id`, `membership_name`

---

### Classes / Events (5 endpoints)

| Method | Path | Summary |
|--------|------|---------|
| GET | `/2.0/events` | Get events/classes (with date range, filters) |
| GET | `/2.0/events/{id}` | Get a single event |
| GET | `/3.0/locations/{locationId}/courses` | Get courses for a location |
| GET | `/3.0/locations/{locationId}/facilities` | Get facilities for a location |
| POST | `/v3.0/locations/{locationId}/search-programs` | Search programs |

**Event/Class fields:** `_id`, `namespace`, `branch_id`, `type` (class/course/appointment/facility), `active`, `name`, `description`, `time_start` (unix), `duration` (minutes), `is_online`, `image_url`, `size` (capacity), `private`, `booked` (count), `waiting` (count), `modified`, `program_id`, `level`, `facility`, `trainers[]`, `status`, `open_booking_time`, `close_booking_time`

**Event query params:** `start` (unix), `end` (unix), `sort_by`, `limit`, `page`, `active`, `private`, `filter`, `programs` (comma-sep IDs), `facilities`, `trainers`, `model`, `model_id`, `utc_modified_start_date`, `utc_modified_end_date`

**Facility fields:** `_id`, `location_id`, `description`, `name`, `namespace`, `bookable`, `is_online`, `categories[]`, `list_visible`, `created_at`

---

### Bookings (7 endpoints)

| Method | Path | Summary |
|--------|------|---------|
| POST | `/2.0/bookings` | Create a booking (v2.0) |
| GET | `/2.0/bookings` | Get user's bookings |
| GET | `/2.0/branches/{branchId}/events/{eventId}/price` | Get booking price |
| POST | `/2.0/attendances` | Mark booking as attended |
| GET | `/2.2/branches/{branchId}/bookings` | Get ALL bookings in a studio |
| POST | `/2.3/branches/{branchId}/bookings` | Create a booking (v2.3) |
| DELETE | `/2.3/branches/{branchId}/bookings/{bookingId}` | Cancel a booking |
| POST | `/booking/{bookingId}/user/{userId}/cancel` | Cancel a booking (legacy) |

**Booking fields:** `_id`, `branch_id`, `namespace`, `user_id`, `user_name`, `status` (BOOKED/WAITING/CANCELED/RESERVED/FAILED), `type` (class/course/appointment/facility), `program_id`, `event_id`, `event_name`, `course_id`, `session_id`, `time_start`, `time_finish`, `duration`, `attended`, `paid`, `guest_bookings`, `is_from_waiting_list`, `is_late_cancellation`, `payment_method`, `is_first`, `canceled_at`, `modified`, `created`, `batch_id`, `model`, `model_id`, `model_name`

**Studio-wide booking query (v2.2):** Supports `start_date`, `end_date`, `modified_start_date`, `modified_end_date`, `time_start_start_date`, `time_start_end_date`, `status`, `event_type`, `event_id`, `course_id`

---

### Payments / Transactions (2 endpoints)

| Method | Path | Summary |
|--------|------|---------|
| GET | `/2.1/branches/{branchId}/payment-methods` | Get available payment methods |
| POST | `/Analytics/report` | Get all payments for a studio (date range) |

**Payment method fields:** `_id`, `branch_id`, `active`, `staff_only`, `type_id` (name, charge_percentage, fixed_charge, publishable_key, account_id, tokenization_handler), `iframe`

**Transaction fields:** `_id`, `id`, `transaction_status`, `transaction_provider_id`, `amount` (integer), `currency`, `paid`, `description`, `sold_by_user_id`, `created`, `modified`, `metadata`

**Payments report request:** `branch_id`, `namespace`, `start` (date), `end` (date), `secondStart` (unix), `secondEnd` (unix), `model`, `filter`

---

### Access / Door Entry (1 endpoint)

| Method | Path | Summary |
|--------|------|---------|
| POST | `/2.0/access` | Create an access/check-in event |

**Access fields:** `user_id`, `namespace`, `branch_id`, `entry_at` (unix), `status`, `door`, `door_type`

---

### Electronic Agreements / Waivers (5 endpoints)

| Method | Path | Summary |
|--------|------|---------|
| GET | `/TermsConditions/view` | Get studio waivers/documents |
| GET | `/2.2/branches/{branchId}/users/{userId}/agreements/` | Get user's agreements |
| POST | `/2.2/branches/{branchId}/users/{userId}/agreements/send` | Send agreement for signature |
| POST | `/2.2/branches/{branchId}/users/{userId}/agreements/{agreementId}/send` | Send specific agreement [DEPRECATED] |
| GET | `/2.3/branches/{branchId}/agreements-template/trigger/{trigger}` | Get agreement template by trigger |

**Agreement fields:** `id`, `member_id`, `studio_id`, `document_id`, `status`, `external_reference`, `created_at`, `updated_at`
**Triggers:** `member-authenticated`, `membership-purchased`

---

### Reports / Analytics (2 endpoints)

| Method | Path | Summary |
|--------|------|---------|
| GET | `/2.0/analytics/trainer-performance` | Trainer performance report |
| POST | `/Analytics/report` | Payment/transaction report |

**Trainer report params:** `start` (unix), `end` (unix)
**Trainer report fields:** `events` (count), `bookings` (count), `attendance` (count), `capacity` (total)

---

### Price Calculator (5 endpoints)

| Method | Path | Summary |
|--------|------|---------|
| POST | `/2.1/branches/{branchId}/events/{eventId}/calculate-price` | Event price |
| POST | `/2.1/branches/{branchId}/appointments/{appointmentId}/calculate-price` | Appointment price |
| POST | `/2.1/branches/{branchId}/courses/{courseId}/calculate-price` | Course price |
| POST | `/2.1/branches/{branchId}/facilities/{facilityId}/calculate-price` | Facility price |
| POST | `/2.2/branches/{branchId}/price-breakdown` | Generic price breakdown |

---

### Cart / Checkout (4 endpoints)

| Method | Path | Summary |
|--------|------|---------|
| POST | `/v3.0/carts` | Create a new cart |
| PATCH | `/v3.0/carts/{cartID}` | Update a cart |
| POST | `/v3.0/carts/{cartID}/checkout` | Checkout a cart |
| POST | `/v2.0/carts/pre-checkout` | Pre-checkout (price preview) |

---

### Lead Sources (2 endpoints)

| Method | Path | Summary |
|--------|------|---------|
| GET | `/2.3/branches/{branchId}/leads/contact-sources` | Get contact sources |
| GET | `/2.3/branches/{branchId}/leads/marketing-sources` | Get marketing sources |

---

## Glofox → Meridian Data Mapping

### What Glofox Provides vs What Meridian Needs

| Meridian Table | Glofox Endpoint | Data Available | Coverage |
|----------------|-----------------|----------------|----------|
| `profiles` | `GET /2.0/members` + `GET /2.0/staff` | name, email, phone, birth, image, emergency_contact, roles | **FULL** |
| `members` | `GET /2.0/members` (embedded membership) | membership type/status/plan/price, start_date, expiry, subscription | **FULL** |
| `classes` | `GET /2.0/events` | name, time, duration, capacity, booked count, trainers, facility, type | **FULL** |
| `class_types` | `GET /2.0/events` (program_id + type) | Derivable from program groupings | **DERIVABLE** |
| `bookings` | `GET /2.2/branches/{id}/bookings` | user, event, status, attended, payment, timestamps, waitlist, late cancel | **FULL** |
| `transactions` | `POST /Analytics/report` | amount, currency, status, description, timestamps, sold_by | **FULL** |
| `credit_packs` | `GET /2.0/credits` | sessions, active, bookings, dates, linked membership | **FULL** |
| `membership_plans` | `GET /2.0/memberships` | plans with pricing, duration, type, restrictions | **FULL** |
| `leads` | `POST /2.1/branches/{id}/leads/filter` | full lead data with sources, interactions, status history | **FULL** |
| `waivers` / `waiver_signatures` | `GET /TermsConditions/view` + agreements endpoints | templates + signed status | **FULL** |
| `trainer_class_log` | `GET /2.0/analytics/trainer-performance` | events, bookings, attendance, capacity per trainer | **PARTIAL** (aggregated, not per-class) |
| `products` | `GET /v3.0/locations/{id}/products` | name, description, presentations, categories | **FULL** |
| `clock_entries` | None | Not in Glofox API | **MISSING** |
| `automation_flows` | None | Not in Glofox API | **MISSING** |
| `campaigns` | None | Not in Glofox API | **MISSING** |
| `smart_segments` | None | Not in Glofox API | **MISSING** |
| `daily_metrics` | None (must be computed) | Can compute from transactions + bookings | **DERIVABLE** |
| `activity_log` | None | Must generate during import | **DERIVABLE** |
| `gift_cards` | None | Not in Glofox | **MISSING** |
| `orders` / `order_items` | None | Not in Glofox | **MISSING** |
| `corporate_invoices` | None | Not in Glofox | **MISSING** |
| `company_accounts` | None | Not in Glofox | **MISSING** |

### Data That Was NOT Available Before (New with API)

1. **Incremental sync** — `utc_modified_start_date`/`utc_modified_end_date` on members AND events allows pulling only changed records since last sync
2. **Full booking history** — `GET /2.2/branches/{id}/bookings` returns ALL bookings for the studio (previously had to reconstruct from per-member data)
3. **Membership plan details** — pricing, duration, plan codes
4. **Lead interactions/notes** — full CRM activity timeline
5. **Family/linked accounts** — parent/child relationships
6. **Consent preferences** — email/sms/push opt-in status
7. **Payment methods** — what payment options are configured
8. **Trainer performance** — aggregated report endpoint
9. **Lead sources** — contact and marketing source tracking
10. **Products catalog** — merch/retail items

### Data Gaps (Not in Glofox API)

1. **Employee clock in/out** — Glofox doesn't track this. Meridian's clock_entries table stays empty until staff start using Meridian.
2. **Marketing campaigns** — No campaign history in Glofox. Fresh start in Meridian.
3. **Automation flows** — Meridian-only feature.
4. **Gift cards** — Not a Glofox concept. Meridian-only.
5. **Smart segments** — Meridian-only (AI-powered).
6. **Corporate accounts** — Not in Glofox API (may exist internally but not exposed).
7. **Stripe data** — Glofox uses its own payment processor. Stripe integration is Meridian-only.
8. **AI insights/cache** — Meridian-only.
9. **Per-class trainer log** — Glofox only provides aggregated trainer performance, not per-class detail. We can derive per-class from bookings + events though.

---

## Recommended Sync Strategy

### Phase 1: Initial Full Import
1. `GET /2.0/members?page=1&limit=100` — paginate all members → `profiles` + `members`
2. `GET /2.0/staff` — all staff → `profiles` (with trainer/staff roles)
3. `GET /2.0/memberships` — all plans → `membership_plans`
4. `GET /2.0/events?start=0&end=NOW` — all historical events → `classes` + `class_types`
5. `GET /2.2/branches/{id}/bookings?start_date=2020-01-01` — all bookings → `bookings`
6. `POST /Analytics/report` — all transactions → `transactions`
7. `GET /2.0/credits?user_id=EACH` — credit packs per member → `credit_packs`
8. `GET /TermsConditions/view` + agreements — waivers → `waivers` + `waiver_signatures`
9. `GET /v3.0/locations/{id}/products` — products → `products`
10. `POST /2.1/branches/{id}/leads/filter` — all leads → `leads`

### Phase 2: Ongoing Delta Sync (Daily Cron)
Use `utc_modified_start_date` = last sync timestamp:
1. `GET /2.0/members?utc_modified_start_date=LAST_SYNC` — changed members
2. `GET /2.0/events?utc_modified_start_date=LAST_SYNC` — changed events
3. `GET /2.2/branches/{id}/bookings?modified_start_date=LAST_SYNC` — changed bookings
4. `POST /Analytics/report` with date range — new transactions

### Phase 3: Real-time Sync (If Available)
Glofox doesn't document webhooks in the public API. If they offer webhook/event subscriptions, those would enable:
- New booking → instant sync
- Membership change → instant status update
- Payment → instant transaction record

---

## Technical Notes

- **IDs:** Glofox uses MongoDB ObjectIDs (24-char hex strings). Meridian uses UUIDs. Store Glofox ID in a `glofox_id` column for mapping.
- **Timestamps:** Glofox uses Unix timestamps (seconds). Convert to ISO 8601 for Meridian.
- **Money:** Glofox `amount` is integer (smallest currency unit). Same as Meridian's cents convention.
- **Pagination:** All list endpoints use `page`/`limit` with `has_more`/`total_count` in response.
- **Branch ID:** Sent as `x-glofox-api-token` header for most endpoints, or as path param for v2.1+ endpoints.
