# Glofox API Complete Reference Guide

**API Version:** 2.2.0 (OpenAPI 3.1.0)
**Base URL:** `https://gf-api.aws.glofox.com/prod/`
**Generated:** 2026-04-04 (corrected against official OpenAPI spec + developer portal)

---

## Authentication

All requests require **three** headers:

| Header | Description |
| --- | --- |
| `x-glofox-branch-id` | Branch ID for the current request |
| `x-api-key` | API key for the integration |
| `x-glofox-api-token` | API token for the integration |

Optional: `x-glofox-impersonated-member-id` -- Staff/integrators can perform actions on behalf of a member (supported on booking creation, cancellation, and membership cancellation endpoints).

**Important:** Always proxy API key and token requests through a secure backend. Never expose credentials in client-side applications.

### Rate Limiting

The API enforces per-second limits and burst allowances:

- **Live accounts:** 10 requests per second with a burst of 1,000
- **Sandbox accounts:** 3 requests per second with a burst of 300

_Burst_ is the maximum number of requests you can send in a short time window before the per-second limit applies.

HTTP 429 responses indicate rate limiting. Implement exponential backoff with Retry-After header support.

### Payments Collector iFrame

If you use the payment collector iFrame, request domain authorization via email or Slack. The domain `https://localhost` is pre-authorized for local development.

### Contact Information

- **API access/credentials and webhook enablement:** apiactivation@abcfitness.com
- **Technical questions, troubleshooting, API behavior:** glofox.apisupport@abcfitness.com

---

## Webhooks

Glofox supports webhooks for real-time updates. Webhook setup requires emailing apiactivation@abcfitness.com with:

```
Subject: Webhooks Setup Request

Business / Studio name:
Contact name & email:
Branch ID(s) / Namespace (if known):
Environments required (Production / Staging + Production):
Target start date:
Webhook event domains and their callback URLs. Example:
  BOOKINGS: https://mydomain.com/webhooks/bookings;
  MEMBERSHIPS: https://mydomain.com/webhooks/memberships
```

### Available Webhook Event Domains

| Domain | Description |
|--------|-------------|
| `access` | Barcode create and update events (NOT access granted/denied) |
| `booking` | Booking lifecycle events |
| `course_booking` | Course booking events |
| `eagreement` | Electronic agreement events |
| `event` | Event/class schedule events |
| `invoice` | Invoice events |
| `member` | Member create/update events |
| `membership` | Membership lifecycle events |
| `service` | Service events |

You can configure webhook URLs per event domain or use a single URL for all events.

**Webhook Signature:** Each payload includes a `signature` HTTP header for source validation. The signature is computed as: `Signature = Hex( HMAC-SHA256( YourSecretKey, StringToSign ))`. ABC Glofox provides the secret key with your API credentials.

**Best practice:** Supplement webhooks with a daily sync for data consistency (e.g., daily sync of `/2.0/members` with modified-date filters).

---

## Common Concepts (Entity Model)

| Entity | Definition | Purpose |
| --- | --- | --- |
| **Location (Branch)** | Physical space where services are offered | Stores membership details, class schedules, geographical info |
| **Member** | Registered individual (includes leads, ex-members) | Owns membership, books services |
| **Plan** | Service arrangement defining terms/conditions | Defines activities, duration, pricing, restrictions |
| **Membership** | Record of member's subscription to a Plan | Tracks membership status, supports access and billing |
| **Credits** | Unit of value for service access | Tracks purchased access for bookings |
| **Events** | Scheduled activities | Manage class schedules, attendance, availability |
| **Bookings** | Record of intent to attend an event | Captures booking history |
| **Purchase** | Payment and pricing endpoints | Enables payment integrations and transactions |

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
| GET | `/2.1/branches/{branchId}/leads/{userId}/interactions` | Get user interactions (requires `page` query param) |
| GET | `/2.2/users/{parentId}/linked-accounts` | Get child/family accounts |
| POST | `/assets/upload/users/{userId}/profile` | Upload profile image |

**Registration:** Use `POST /2.0/register` (NOT `/2.0/members`). The register endpoint creates a user account.

**Interactions:** `GET /2.1/branches/{branchId}/leads/{userId}/interactions` requires `page` as a required query parameter (integer, minimum 1).

**Member data fields:** `_id`, `first_name`, `last_name`, `phone`, `email`, `type` (member/lead), `active`, `birth`, `emergency_contact`, `access_barcode`, `image_url`, `lead_status`, `joined_at`, `created`, `modified`, `parent_id`, `use_parent_email`, `use_parent_phone`, `source[]`, `consent` (email/sms/push), `membership` (see below), `leads` (contact_source, marketing_source), `address` (street, city, state, country, postal_code, country_code)

**Embedded membership on user:** `type` (payg/time/time_classes), `start_date`, `expiry_date`, `status` (ACTIVE/INACTIVE/CANCELED/etc), `membership_name`, `plan_code`, `plan_name`, `plan_price`, `plan_upfront_fee`, `user_membership_id`, `branches[]`, `subscription` object

**Staff data fields:** `_id`, `branch_id`, `namespace`, `active`, `bookable`, `type` (ADMIN/MEMBER/RECEPTION/TRAINER), `first_name`, `last_name`, `description`, `name`, `image_url`, `modified`

**Staff query params:** `type` (ADMIN/MEMBER/RECEPTION/TRAINER), `active` (true/false/any)

**Lead filters available:** `branch_id`, `home_user`, `deleted`, `lead_status[]`, `source[]`, `name`, `created` (range), `modified` (range), `checkin_num` (range), `booking_num` (range), `last_booking` (range), `last_interaction` (range), `expiry` (range), `status_history` (range)

**Pagination:** `page` (int), `limit` (int) -> response includes `has_more`, `total_count`
**Modified date filter:** `utc_modified_start_date`, `utc_modified_end_date` (for incremental sync)

---

### Lead Sources (2 endpoints)

| Method | Path | Summary |
|--------|------|---------|
| GET | `/2.3/branches/{branchId}/leads/contact-sources` | Get contact sources |
| GET | `/2.3/branches/{branchId}/leads/marketing-sources` | Get marketing sources |

**NOTE:** These are under the `Leads` tag, versioned at 2.3, and require `branchId` as a path parameter.

---

### Memberships (5 endpoints)

| Method | Path | Summary |
|--------|------|---------|
| GET | `/2.0/memberships` | Get all membership plans |
| GET | `/2.0/memberships/{membershipId}` | Get a single membership plan |
| POST | `/2.2/branches/{branchId}/users/{userId}/memberships/{membershipId}/plans/{planCode}/purchase` | Purchase membership |
| POST | `/2.2/branches/{branchId}/charges/{chargeId}/finalize-flexible` | Purchase with flexible payment |
| POST | `/v3.0/memberships/{userMembershipId}/cancel` | Cancel a user membership |

**Membership cancellation:** The path parameter is `userMembershipId` (the user's specific membership instance ID, NOT the membership plan ID). Also requires `x-glofox-impersonated-member-id` header. Request body: `when` (immediate/end_of_period), `local_date`, `reason`.

**Membership purchase:** The full path includes branchId, userId, membershipId, and planCode as path segments.

**Membership plan fields:** `_id`, `branch_id`, `namespace`, `active`, `name`, `description`, `buy_just_once`, `plans[]` (code, type, duration_time_unit, duration_time_unit_count, starts_on, price, upfront_fee)

---

### Credits (1 endpoint)

| Method | Path | Summary |
|--------|------|---------|
| GET | `/2.0/credits` | Get a user's credit packs |

Requires `user_id` as a query parameter.

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

**Facilities:** `GET /3.0/locations/{locationId}/facilities` (NOT `/2.0/facilities`)

**Programs:** `POST /v3.0/locations/{locationId}/search-programs` (NOT `GET /2.0/programs`). This is a POST with a request body for search filters.

**Event/Class fields:** `_id`, `namespace`, `branch_id`, `type` (class/course/appointment/facility), `active`, `name`, `description`, `time_start` (unix), `duration` (minutes), `is_online`, `image_url`, `size` (capacity), `private`, `booked` (count), `waiting` (count), `modified`, `program_id`, `level`, `facility`, `trainers[]`, `status`, `open_booking_time`, `close_booking_time`

**Event query params:** `start` (unix string), `end` (unix string), `sort_by`, `limit` (max 100), `page`, `active`, `private`, `filter` (event/timeslot/course), `programs` (comma-sep IDs), `facilities`, `trainers`, `model` (appointments/facilities), `model_id`, `utc_modified_start_date`, `utc_modified_end_date`

**Facility fields:** `_id`, `location_id`, `description`, `name`, `namespace`, `bookable`, `is_online`, `categories[]`, `list_visible`, `created_at`

---

### Appointments Availability (1 endpoint)

| Method | Path | Summary |
|--------|------|---------|
| GET | `/2.1/branches/{branchId}/appointments-availability` | Retrieve available appointments for a branch |

**NOTE:** This is NOT `/2.0/appointments`. The correct path requires the branchId.

---

### Bookings (8 endpoints)

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

**Studio-wide booking query (v2.2):** Supports `start_date`, `end_date`, `modified_start_date`, `modified_end_date`, `time_start_start_date`, `time_start_end_date`, `time_finish_start_date`, `time_finish_end_date`, `status`, `event_type`, `event_id`, `course_id`

---

### Payments / Transactions (2 endpoints)

| Method | Path | Summary |
|--------|------|---------|
| GET | `/2.1/branches/{branchId}/payment-methods` | Get available payment methods |
| POST | `/Analytics/report` | Get all payments for a studio (date range) |

**Payment method fields:** `_id`, `branch_id`, `active`, `staff_only`, `type_id`, `provider` (name, charge_percentage, fixed_charge, publishable_key, account_id, tokenization_handler), `iframe` (parameters, domain, full_path)

#### Analytics/report (Transaction Report) -- CRITICAL DETAILS

**Request body (PaymentsReportRequest):**

```json
{
  "model": "TransactionsList",
  "branch_id": "Branch ID",
  "namespace": "Customer's namespace",
  "start": "1773187200",
  "end": "1773791999",
  "secondStart": 1773187200,
  "secondEnd": 1773791999,
  "filter": {
    "ReportByMembers": false,
    "CompareToRanges": false,
    "PaymentMethods": [
      {"id": "cash"},
      {"id": "credit_card"},
      {"id": "bank_transfer"},
      {"id": "paypal"},
      {"id": "direct_debit"},
      {"id": "complimentary"},
      {"id": "wallet"}
    ]
  }
}
```

**CRITICAL NOTES on Analytics/report:**
1. `model` field is REQUIRED and must be `"TransactionsList"`
2. `start` and `end` are **string** representations of UNIX timestamps (e.g., `"1773187200"`), NOT ISO date strings
3. `secondStart` and `secondEnd` are integer UNIX timestamps (required only if `filter.CompareToRanges` is true)
4. Response wraps in `TransactionsList.details[]` (NOT `data[]`)

**Response (PaymentsReportResponse):**

```json
{
  "TransactionsList": {
    "details": [
      { "_id": "...", "amount": 25.00, ... }
    ]
  }
}
```

**Transaction fields:** `_id`, `id` (incremental int), `transaction_status` (PAID/REFUNDED/ERROR/PENDING/PARTIAL_REFUNDED/SUBSCRIPTION_CYCLE_PAYMENT_FAILED), `transaction_provider_id`, `amount` (number -- in DOLLARS, not cents), `currency`, `paid` (boolean), `description`, `sold_by_user_id`, `created`, `modified`, `metadata` (namespace, branch_id, glofox_event, payment_method)

**IMPORTANT:** The `amount` field is in DOLLARS (not cents/smallest currency unit). This differs from many payment APIs.

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

**Trainer report params:** `start` (string), `end` (string)
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

**`discount_ids` and `promo_code` are mutually exclusive** in price-breakdown requests. `discount_ids` is staff/integrator only; `promo_code` can be used by any user.

---

### Cart / Checkout (4 endpoints)

| Method | Path | Summary |
|--------|------|---------|
| POST | `/v3.0/carts` | Create a new cart |
| PATCH | `/v3.0/carts/{cartID}` | Update a cart |
| POST | `/v3.0/carts/{cartID}/checkout` | Checkout a cart |
| POST | `/v2.0/carts/pre-checkout` | Pre-checkout (price preview) |

---

### Facilities (1 endpoint -- separate from Classes section)

| Method | Path | Summary |
|--------|------|---------|
| GET | `/3.0/locations/{locationId}/facilities` | Get facilities for a location |

---

### Courses (1 endpoint)

| Method | Path | Summary |
|--------|------|---------|
| GET | `/3.0/locations/{locationId}/courses` | Get courses for a location |

---

### Programs (1 endpoint)

| Method | Path | Summary |
|--------|------|---------|
| POST | `/v3.0/locations/{locationId}/search-programs` | Get all programs for a location |

---

### Products (1 endpoint)

| Method | Path | Summary |
|--------|------|---------|
| GET | `/v3.0/locations/{locationId}/products` | Get all products for a location |

---

## Flows (Step-by-Step Guides)

The Glofox developer portal documents these integration flows:

1. **Lead Sale** -- Register a member, get waiver templates, purchase membership
2. **Payment Collector** -- Retrieve cards/mandates, get payment history, iFrame tokenization flow
3. **Purchase Product** -- List products, create cart, checkout
4. **Login** -- Member authentication flow
5. **Avatar** -- Profile image upload flow
6. **Book** -- Class/appointment booking workflow with credits and waitlist handling
7. **Agreements** -- Electronic agreement signing flow

---

## Error Handling

| Status Code | Description |
| --- | --- |
| **400 Bad Request** | Invalid input |
| **401 Unauthorized** | Not authenticated |
| **403 Forbidden** | No permission |
| **404 Not Found** | Resource does not exist |
| **429 Throttle Down** | Rate limit exceeded |
| **500 Internal Server Error** | Server-side problem |

**Note:** Older endpoints sometimes return HTTP 200 with `success: false`. Recommend adding middleware to transform those to 400.

Error response structure:
```json
{
  "message": "Human-readable explanation",
  "message_code": "MACHINE_READABLE_CODE"
}
```

---

## Glofox -> Meridian Data Mapping

### What Glofox Provides vs What Meridian Needs

| Meridian Table | Glofox Endpoint | Data Available | Coverage |
|----------------|-----------------|----------------|----------|
| `profiles` | `GET /2.0/members` + `GET /2.0/staff` | name, email, phone, birth, image, emergency_contact, roles | **FULL** |
| `members` | `GET /2.0/members` (embedded membership) | membership type/status/plan/price, start_date, expiry, subscription | **FULL** |
| `classes` | `GET /2.0/events` | name, time, duration, capacity, booked count, trainers, facility, type | **FULL** |
| `class_types` | `GET /2.0/events` (program_id + type) | Derivable from program groupings | **DERIVABLE** |
| `bookings` | `GET /2.2/branches/{id}/bookings` | user, event, status, attended, payment, timestamps, waitlist, late cancel | **FULL** |
| `transactions` | `POST /Analytics/report` | amount (DOLLARS), currency, status, description, timestamps, sold_by | **FULL** |
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

1. **Incremental sync** -- `utc_modified_start_date`/`utc_modified_end_date` on members AND events allows pulling only changed records since last sync
2. **Full booking history** -- `GET /2.2/branches/{id}/bookings` returns ALL bookings for the studio
3. **Membership plan details** -- pricing, duration, plan codes
4. **Lead interactions/notes** -- full CRM activity timeline
5. **Family/linked accounts** -- parent/child relationships
6. **Consent preferences** -- email/sms/push opt-in status
7. **Payment methods** -- what payment options are configured
8. **Trainer performance** -- aggregated report endpoint
9. **Lead sources** -- contact and marketing source tracking (v2.3 endpoints)
10. **Products catalog** -- merch/retail items
11. **Webhooks** -- real-time event notifications for 9 event domains

### Data Gaps (Not in Glofox API)

1. **Employee clock in/out** -- Glofox doesn't track this
2. **Marketing campaigns** -- No campaign history in Glofox
3. **Automation flows** -- Meridian-only feature
4. **Gift cards** -- Not a Glofox concept
5. **Smart segments** -- Meridian-only (AI-powered)
6. **Corporate accounts** -- Not in Glofox API
7. **Stripe data** -- Glofox uses its own payment processor
8. **AI insights/cache** -- Meridian-only
9. **Per-class trainer log** -- Only aggregated trainer performance available

---

## Recommended Sync Strategy

### Phase 1: Initial Full Import
1. `GET /2.0/members?page=1&limit=100` -- paginate all members -> `profiles` + `members`
2. `GET /2.0/staff` -- all staff -> `profiles` (with trainer/staff roles)
3. `GET /2.0/memberships` -- all plans -> `membership_plans`
4. `GET /2.0/events?start=0&end=NOW` -- all historical events -> `classes` + `class_types`
5. `GET /2.2/branches/{id}/bookings?start_date=2020-01-01` -- all bookings -> `bookings`
6. `POST /Analytics/report` (with `model: "TransactionsList"`, `start`/`end` as unix timestamp strings) -- all transactions -> `transactions`
7. `GET /2.0/credits?user_id=EACH` -- credit packs per member -> `credit_packs`
8. `GET /TermsConditions/view` + agreements -- waivers -> `waivers` + `waiver_signatures`
9. `GET /v3.0/locations/{id}/products` -- products -> `products`
10. `POST /2.1/branches/{id}/leads/filter` -- all leads -> `leads`

### Phase 2: Ongoing Delta Sync (Daily Cron)
Use `utc_modified_start_date` = last sync timestamp:
1. `GET /2.0/members?utc_modified_start_date=LAST_SYNC` -- changed members
2. `GET /2.0/events?utc_modified_start_date=LAST_SYNC` -- changed events
3. `GET /2.2/branches/{id}/bookings?modified_start_date=LAST_SYNC` -- changed bookings
4. `POST /Analytics/report` with date range (unix timestamp strings) -- new transactions

### Phase 3: Real-time Sync (Webhooks)
Glofox supports webhooks for 9 event domains. Enable by emailing apiactivation@abcfitness.com:
- `member` webhook -> instant member sync
- `booking` webhook -> instant booking sync
- `membership` webhook -> instant membership status update
- `invoice` webhook -> instant transaction record
- `access` webhook -> barcode updates (NOT access granted/denied events)

---

## Technical Notes

- **IDs:** Glofox uses MongoDB ObjectIDs (24-char hex strings, pattern `^[a-f\d]{24}$`). Meridian uses UUIDs. Store Glofox ID in a `glofox_id` column for mapping.
- **Timestamps:** Glofox uses Unix timestamps (seconds) for most fields. Convert to ISO 8601 for Meridian.
- **Money:** Glofox `amount` in the Analytics/report is in **DOLLARS** (not cents). This is different from Stripe convention. When syncing to Meridian, convert to cents if needed (multiply by 100).
- **Pagination:** All list endpoints use `page`/`limit` with `has_more`/`total_count` in response.
- **Branch ID:** Sent as `x-glofox-branch-id` header for all endpoints. For v2.1+ endpoints, also appears as a path parameter `{branchId}`.
- **API Token vs Branch ID:** `x-glofox-api-token` is the integrator's authentication token. `x-glofox-branch-id` is the branch scoping header. These are SEPARATE values (they may have the same value for single-branch integrations, but they serve different purposes).
