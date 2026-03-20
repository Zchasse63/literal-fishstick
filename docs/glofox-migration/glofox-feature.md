# ABC Glofox platform: complete architecture and feature audit

**Glofox is a four-layer studio management system — scheduling engine, member/billing database, communications hub, and branded client app — built on Stripe Connect with a gated REST API.** This audit documents every documented feature, backend workflow, integration point, and known limitation across the platform, compiled from Glofox's support knowledge base (support.glofox.com), API developer portal, user reviews, and integration documentation. For The Sauna Guys, the most critical finding is that **Glofox's facility booking module is its weakest layer** — limited to one-client-per-slot with fixed durations, no resource pooling, no buffer times, and no combined booking flows — making it the highest-priority area for improvement in a custom replacement.

---

## 1. Calendar and scheduling engine

Glofox organizes bookable services into four distinct types, each with its own booking logic, pricing model, and capacity rules. Understanding these distinctions is essential for replication.

### Classes (group sessions)

A class is a group session with a date/time, assigned trainer, facility, and configurable capacity. Classes are the platform's most feature-rich service type.

**Creation fields:** Name, description, category (admin-only taxonomy used for credit restrictions — a class can have multiple categories), trainer (required — class won't save without one), facility (room assignment; cannot change between Online/Onsite after saving), capacity, class level (Beginner/Intermediate/Advanced/All Levels), image (JPEG/PNG/GIF/BMP/TIFF, max 1MB, 1000×1000px), class URL (for livestream links), start date, and end date.

**Recurring schedules:** Classes are inherently recurring. Admins select days of the week and set times for each day. If the same class runs twice on one day, an additional time slot is added. Individual time slots can override the default trainer, facility, level, or capacity via a per-slot settings cog. Classes repeat weekly from the start date until the end date (if set). One-day events are created by setting start date = end date.

**Recurring class bookings (admin-only):** Staff can create block/recurring bookings for members using "Book multiple" from the calendar. Available for unlimited and restricted memberships only — **not available to members in the app**. Restricted memberships have a **4-month maximum** booking horizon. Bookings beyond the current booking window are stored as "reservations" that auto-convert to confirmed bookings when they enter the window. If conversion fails (invalid membership, schedule change), the booking is cancelled and the spot is released.

**Class pricing has three modes:**
- **Free for All:** No charge, no credit needed
- **Single Price:** One drop-in price (non-members) plus one member price (all membership types)
- **Different Prices:** Per-membership-type pricing where each membership can be excluded entirely, set to free, charged an additional amount, or set to no additional charge. A separate drop-in/PAYG rate is always configurable. **Critical constraint: cannot charge an additional fee AND deduct a credit simultaneously** — it's one or the other per booking.

### Appointments (1:1 sessions)

Appointments are one-on-one bookable sessions with trainers. The newer appointment system (rolling out since late 2023) supports variable durations and per-type pricing.

**Configuration:** Each appointment type has a name, duration, one or more eligible trainers, and pricing (credit-based via Trainer credit category, plus a separate drop-in price). Trainer availability is set on the dashboard calendar as either recurring weekly schedules or date-specific blocks. **The system prevents double-booking** — if a trainer has another class or appointment, those slots are automatically hidden. Settings include timetable display weeks, booking window, and cancellation window (hours before).

**Key limitations:** Cannot block specific dates (holidays) within recurring trainer schedules — acknowledged as a future release. Recurring appointments are created as unpaid and must be charged separately. Cannot create recurring appointments from the Pro mobile app.

### Facility rentals (resource booking)

Facilities are bookable locations/resources — the model most relevant for sauna rooms and cold plunge pools.

**Setup:** Create from Manage → Facilities. Toggle "Bookable" to enable direct client bookings. Set pricing (single price or different prices per membership type plus drop-in rate). Configure the schedule: select available days, set a **fixed session duration** (slot length), and define available time slots per day. **Only one client can be booked per facility slot** — this is a hard constraint.

**Booking flow:** Admins book from the calendar view using the "Display non-booked" filter. Members book through the Member App or Web Portal using Facility Credits or paying the drop-in rate. Facility rentals have their own independent booking window and cancellation window settings (hours before slot).

**Critical architectural gaps for sauna/wellness:**
- **Fixed session duration per facility** — cannot offer 30-min and 60-min bookings on the same facility without creating separate facility entries
- **No resource pooling** — cannot define "any available sauna room" and auto-assign; each room must be a separate facility
- **No buffer/turnover time** between bookings for cleaning
- **No add-ons per booking** (towel rental, aromatherapy)
- **No dynamic pricing** for peak vs. off-peak on the same facility
- **No combined booking flows** — members cannot book sauna + cold plunge in a single transaction
- **Double-booking risk** — if a facility is assigned to a class AND set as independently bookable, the system does not cross-reference

### Courses (multi-session programs)

Courses are multi-session commitments with a start date, end date, and fixed roster. Members pay upfront and are expected to attend every session. Key difference from classes: **course bookings do NOT appear in members' "My Bookings" in the app.** No progress tracking or completion percentage exists. "Book a friend" feature available. Shareable enrollment link via Web Portal.

### Booking window and capacity controls

All configurable under Settings → Bookings:

| Setting | Scope | Details |
|---------|-------|---------|
| Timetable display | Per service type | X weeks of future schedule visible (calculated as days from today, not calendar weeks) |
| Booking window | Per service type | How late bookings are accepted (e.g., "1 hour before class starts") |
| Max bookings per period | Classes | Limit per hour/day/week/year (e.g., 20/week). Waitlist bookings don't count. Staff can override. |
| Max upcoming bookings | Classes | Total cap on future bookings at any time. As members attend, they can book more. |
| Payment cycle limit | Classes | Members can only book within current + next payment cycle |
| Staff capacity override | Classes | When enabled, staff get a notification and can book over capacity |

### Waitlist system

Two modes, enabled globally under Settings → Bookings → Classes:

**Standard (Notify All):** When a spot opens, all waitlisted members receive email + push notification. First to book claims the spot (race condition). **Automatic (Dynamic):** First person on the waitlist is auto-enrolled when a spot opens — requires "Pay Later" to be enabled in payment settings. Auto-enrollment works **up to 30 minutes before class start** and stops processing after that.

Credits are **not deducted when joining the waitlist** — only upon confirmed booking. Waitlist bookings do not count toward maximum booking limits. If booking limits are enabled and a member is on multiple waitlists, the system prevents overbooking. Admins can manually promote waitlisted members or increase capacity to bypass the waitlist. Waitlist capacity (number of waitlist spots) is configurable per class.

### Cancellation and no-show enforcement

**Cancellation policy settings (per service type):** Cancel notice period (hours before class), late cancellation toggle (allow/block), and credit return behavior (on/off, with configurable validity period and class-type restriction for returned credits).

**Strike system:** Optional penalty for no-shows. Configurable threshold (e.g., 3 strikes = booking blocked). Requires staff to "Submit Attendance" after each class. Strikes resettable per-member or globally. No built-in monetary late cancellation fee in native Glofox, though an "Automated No-Show & Late Cancellation Fees" feature exists as a newer addition, and the Bitlancer integration can charge monetary penalties automatically.

---

## 2. Member management and profiles

### Profile data model

**Standard fields:** First name, last name (required), email (required), gender (required), phone number (optional, lockable), date of birth, zip/postcode, emergency contact name and number, profile photo (uploadable via app/selfie/gallery, lockable after first upload). **Profile Edit Restrictions** feature locks all editable fields (first name, last name, email, phone, photo) once filled — it's all-or-nothing, no granular per-field control.

**Profile tabs visible to admins:** Membership tab (active/future/past memberships with full history), Credits tab (balance and pack details), Transactions tab (payment history), Activity tab (attendance/booking history with Attended/Booked/No Show tags), Notes section (populated by custom form questions), Details tab (personal info, marketing preferences, lead status), and Home Studio designation for multi-location members.

**Custom data capture:** Glofox does **not have a traditional custom fields builder** on member profiles. Custom data is captured through configurable questions under Settings → Forms → "Create your own questions," which populate the Notes section. Dynamic merge tags available in messaging: Client's First Name, Client's Membership Plan, Studio Name.

**Tags:** Listed as an "[Early Access]" feature. Relatively new addition to member profiles.

### Waiver and agreement system

Five contract types: Waivers (accepted at registration), Membership T&Cs (accepted per purchase), Drop-in T&Cs (first booking), Parental Waiver (per child account), and Custom T&Cs.

**E-Agreements (Boost/Elite add-on):** Full e-signature capture with multiple signature fields, customizable templates, tracking of exact terms and dates. Signable via Member App, Web Portal, email link, or Pro App (Staff/Kiosk mode). "Unsigned E-Agreements Report" available. E-signatures **not available** for Parental Waivers or Drop-in T&Cs.

### Family and group accounts

**Family Accounts:** Parent/guardian manages child accounts — purchases memberships, makes bookings on their behalf. Children cannot log in independently. Parental waiver required. Minimum age for independent accounts is configurable (contact support). Available on select packages only.

**Group Memberships (Boost/Elite with Glofox Payments only):** Shared membership for couples/families/teams. One primary member pays for the entire group. Staff manages group composition. Currently **limited to unlimited memberships only** — no group credit packs. Payment cannot be split. No shared credit pool feature exists.

### Check-in methods

Seven documented check-in methods: manual from dashboard (Global Search → Access), manual from class booking list, manual from client profile, "Check-in everyone" batch button, **Check-in Kiosk** (Boost/Elite — self-service iPad/tablet), **barcode scanning** (auto-generated in Member App, Honeywell scanner supported), and **access control integrations** (Kisi, Passport Technologies — keyfobs, keycards, phone tap). Auto-check-in: if a member accesses the facility and has a class booked within 59 minutes, they're automatically marked as attended.

### Search, filtering, and bulk actions

**Client Filters (Boost/Elite):** Filter by bookings (e.g., haven't booked in 10 days), attendance milestones, membership status, credits remaining, home studio, and overdue status. Filtered lists exportable as CSV or targetable for bulk SMS, push notifications, or email campaigns. Bulk pricing updates available for recurring memberships.

---

## 3. Memberships, credit packs, and pricing architecture

### Membership types

| Type | Billing | Key behavior |
|------|---------|-------------|
| **Single** | One-time payment | Fixed duration (day/week/month). Cannot be paused. |
| **Recurring** | Auto-repeating (daily/weekly/monthly) | Subscription. Can be paused. Supports joining fee. |
| **Restricted Services** | Single or recurring | Limits which services member can access by category. Cannot be paused. |
| **Trial** | Free, single, or recurring | Marked as "Trial" in setup. Auto-changes lead status. Restrictable to one per client. |
| **Roaming** | Any | Enables cross-location booking at selected branches. |
| **Group** | Recurring only (unlimited only) | One payer, multiple members. Boost/Elite only. |
| **Consecutive** | Any | Queued membership that starts after current one ends. Admin-only creation. |

**Critical constraint: a member can have only ONE active membership at a time, but multiple credit packs simultaneously.**

### Membership configuration details

**Plans tab settings:** Payment frequency (single/recurring), price, duration, payment frequency for recurring, optional subscription end date (creates a "contract"), auto-renew toggle (only with end date), joining/upfront fee (first payment of recurring only), and service access level (unlimited or restricted services).

**Advanced settings:** Trial toggle, restrict to one purchase per client, private (dashboard-only, not visible in app), enable roaming to linked locations. **"Gift First Period Free"** promotional option (Boost/Elite, unlimited memberships only).

**Payment options per membership:** Card, Direct Debit, Cash, Complimentary, Bank Transfer, Pay Later. Some methods can be restricted to staff-only.

### Credit pack system (detailed)

Credit packs are purchased separately from memberships (a member can hold multiple). **One credit = one booking**, regardless of session duration.

**Three credit categories:** Class Credits, Facility Credits, and Trainer/Appointment Credits. Each credit line within a pack is restricted to one category. To bundle multiple credit types (e.g., class + facility credits), admins click "Add Credits" to create additional credit lines within the same pack.

**Category restrictions:** Credits can be restricted to "All Events" within their type or to a specific category (e.g., "Boxing" class credits). While a class can have multiple categories, a credit pack line is limited to one category. Credits can also be restricted to specific individual events rather than categories.

**Start date options:** "Date of Purchase" (immediate, can hold multiples) or "Date of First Booking" (starts when first used, **limited to one at a time**).

**Credit deduction priority** when a member holds multiple packs:
1. Pack expiring soonest
2. Packs linked to multiple specific events
3. Category-specific packs matching the service
4. General "all events" packs (oldest purchase first)

**Credits always take priority over membership pricing.** If a member has both a membership and credits, credits are consumed first.

**Expiry:** Configurable per pack. No automatic rollover of unused credits. On scheduled membership cancellation, credit expiry is **not auto-adjusted** — must be manually edited.

**Auto-renewal:** Credit packs can be set to recur. Recurring credit packs can be paused.

### Membership freeze/pause

Only **recurring memberships** (including recurring credit packs) can be paused. Single and restricted memberships cannot. Pro-rated (1st-of-month) memberships can be paused in monthly increments only. Cannot pause in the last cycle before renewal/end.

During pause: class bookings are auto-cancelled (PAYG/appointment bookings are not — manual cancellation needed). Credits refunded if within cancellation window. Additional fees paid by card/cash require manual refund. Payment date extends by the number of pause days. Unpause earliest is tomorrow (not today). Modifying the pause reactivation date does **not** change the payment date.

### Proration

**Not supported.** Explicitly documented: "Currently, if you cancel in the middle of a member's payment cycle they will not pay pro-rata for that month." Mid-cycle upgrades/downgrades require manual handling. A "Membership Plan Change (Upgrade/Downgrade)" feature exists for changing subscription pricing, and bulk pricing updates are available, but no automatic proration calculation occurs.

**Pro-rated memberships (billed 1st of month):** New members are charged a pro-rated amount for the remainder of the current month, then full amount on the 1st going forward. Cannot set a future start date.

---

## 4. Payments, billing, and financial operations

### Stripe integration (Stripe Connect model)

Glofox wraps Stripe under its **"Glofox Payments"** brand using **Stripe Connect**. Studios create their Stripe account through the Glofox dashboard — they do not get independent Stripe dashboard access. Two destination merchant IDs: `acct_1BaVrIG169MUOFIq` (US) and `acct_1BRORrBWt0BD8l47` (non-US). Studios migrating from standalone Stripe accounts can migrate saved payment tokens. Glofox is **Level 1 PCI compliant**. 3D Secure supported. Stripe Capital available to eligible US businesses. Coverage: **35 countries**.

### GoCardless (Direct Debit)

Supported schemes: BACS (UK), BECS (Australia), BECS NZ, SEPA Core (EU), PAD (Canada), Autogiro (Sweden), Betalingsservice (Denmark). Studios **do** get direct GoCardless dashboard access at manage.gocardless.com. **Limitation:** GoCardless can only be used for subscriptions and custom charges — not one-off transactions. ACH Direct Debit in the US is processed through Stripe, not GoCardless.

### Payment methods matrix

Card (all major via Stripe), Direct Debit (GoCardless/Stripe ACH), Cash (manual recording), Complimentary (zero-cost), Bank Transfer (manual recording), Pay Later (deferred — staff-only), Account Balance (prepaid wallet), and POS Terminal (in-person card via Glofox POS hardware).

### Failed payment and dunning flow

**Card payments (Stripe):** 4 total attempts — initial + 3 automatic retries over several days. **Direct Debit (ACH/BECS/SEPA):** Only 1 retry at billing date + 1 day (due to high failure rates and fees).

**Status progression:** Active → **Overdue** (first failure; member immediately blocked from booking; club access revoked after 7 days) → **Unpaid** (all retries in current cycle exhausted; member remains blocked). Glofox **automatically attempts the next billing cycle** but does **not** roll the owed amount into the next charge. Admin actions: "Retry" (manual immediate payment attempt) or "Write Off/Forgive" (stops retries, returns to Active). Payment Links feature available to collect failed amounts.

**Notification gap:** No built-in automated dunning email sequence for failed payments. Studios must manually filter overdue members and send bulk SMS (requires SMS add-on) or use XLerate automated workflows.

### Refunds and invoicing

Full and partial refunds supported (card refunds processed back to member's card, 1–14 days). Credit refunds on booking cancellation are configurable (validity period and class-type restriction). **No formal invoicing system** — only email receipts (non-itemized). Purchase receipts sent even for pending payments. No customizable invoice templates.

### Tax configuration

Two modes: Tax-Exclusive (US/Canada — tax added on top) and Tax-Inclusive (other regions — tax embedded in price). No multi-rate tax, per-service tax, or automatic jurisdiction-based tax calculation documented.

---

## 5. Leads, CRM, and conversion tracking

### Lead capture channels

Lead Capture Forms (Boost/Elite) embeddable on websites — low-friction, even partial completions create a lead. Web Portal registration page, Member App registration, Kiosk Mode sign-up, manual staff entry, Zapier (Elite plan — from Typeform, HubSpot, Google Sheets, etc.), and QR codes linking to the Member App.

### Lead pipeline

Three statuses: **Lead → Trial → Client/Member.** When a lead purchases a Trial membership, status auto-changes to Trial. When a trial member purchases a full membership, status changes to Client. A "Cold Lead" status exists within XLerate workflows. Dashboard shows: newest leads (7 days), trialers (7 days), active members, expiring (7 days), first bookings (7 days).

### Source tracking

During sign-up, leads are asked "How did you hear about us?" with options: Facebook, Instagram, Another Client, Word of Mouth, Other Advertising. Glofox Insights provides "Leads by Source" and "New Members by Source" breakdowns. GA4/GTM tracking and Facebook Pixel conversion tracking supported.

### Automated follow-ups (XLerate add-on)

Multi-step sequences using Email, SMS, and Push across these workflows: Leads, Cold Leads, Trials (activation/cancellation), Member Expiring, Membership Renewal Reminders, New Service Started, Cart Abandonment, Visit Milestones, Membership Yearly Reminders, and Automated Birthday Messages.

### Conversion reporting

Lead Conversion Report shows: total leads, converted clients, conversion rate, lead-direct-to-client count, lead-to-trial count, full-funnel lead-to-trial-to-client, and conversion by source with funnel visualization.

---

## 6. Reporting inventory

### Available reports by category

**Financial:** Transactions Report (all transactions with sales attribution, CSV export), Failed Payment Report (CSV, time-period filtering), Payouts Report (completed/in-transit/estimated future, CSV), Sales Report, Money Owed Report.

**Membership:** Members Report (active/paused/overdue counts, breakdown by type, Member Movement tab with net movement over time), New Memberships Report (unique sign-ups across New Memberships/Credits/Add-Ons/Trials tabs, customizable columns), Lost Members Report, Membership Plan Changes Report.

**Retention:** Members At Risk Report (Beta), Lead Conversion Report (acquisition, journey, conversion performance with period comparisons).

**Activity:** Class Performance Report, Visits Report, No Shows Report, Trainer Insights Report, Access Reports (requires Kisi/access logging), Unsigned E-Agreements Report.

**Staff:** Payroll Report (CSV with event, pay rates, bookings, attendees — max 1-month range, no automatic totals).

**Glofox Insights (premium add-on):** Total Sales, Sales by Transaction Type, Sales by Location/Branch, Credit Pack Sales, Store Revenue, Money Owed, with drilldown capability.

**Export options:** CSV is the primary (and often only) format. No PDF export documented. A Report Builder tool exists for creating and saving custom reports with customizable columns, but user reviews consistently describe it as limited.

---

## 7. Staff roles, permissions, and payroll

### Four role tiers

| Capability | Super Admin | Admin | Receptionist | Trainer |
|-----------|-------------|-------|-------------|---------|
| Edit member profiles | ✅ | ✅ | ✅ | ❌ |
| Edit class/membership settings | ✅ | ✅ | ❌ | ❌ |
| View reporting | ✅ | ✅ | ❌ | ❌ |
| Sell memberships/products | ✅ | ✅ | ✅ | ❌ |
| Pause/cancel memberships | ✅ | ✅ | ✅ | ❌ |
| Assigned to classes | ❌ | ❌ | ❌ | ✅ |
| Set staff as roaming | ✅ | ❌ | ❌ | ❌ |
| Opt members into marketing | ✅ | ❌ | ❌ | ❌ |

**Key constraint:** Each role requires a unique email and phone. If someone needs dual roles (e.g., Admin + Trainer), they need **two separate accounts**.

### Payroll tracking

Pay Rates feature supports base rates for classes and appointments plus trainer bonuses. Payroll Report exportable as CSV (max 1-month range) with event, rates, bookings, and attendees. **Totals must be calculated manually** from the CSV. No full payroll processing (no tax calculations or direct deposit). No commission tracking documented.

---

## 8. Communications system

### Channel capabilities

**Email:** Automated templates for welcome, booking confirmation, booking reminder (24 hours before), purchase receipt, overdue payment, membership expiry, password reset, birthday, and signed document. All content editable with dynamic merge tags. Drag-and-drop email editor with images, videos, buttons, custom HTML. Branded templates on Boost/Elite. Email Campaigns feature for mass sends with saved audience segments and performance analytics.

**Push notifications:** Sent to Member App users. Can target everyone, filtered groups (by activity, membership type, expiration status), or 1:1 from profile. Marketing vs. transactional distinction — transactional always sent regardless of opt-out. Delivered to most recent device only if logged into multiple.

**SMS (paid add-on):** Uses SMS credits (1 credit = 160 characters to 1 client; emoji reduces to 67 characters). Available for 1:1 from profile, bulk to filtered lists, XLerate automated workflows, and booking reminders (24 hours before). Two-way SMS supported. Opt-out via "STOP" reply (Twilio-powered).

**Key gap:** No real-time in-app chat/messaging between staff and members. Community section in Member App supports one-way articles/videos/on-demand content.

---

## 9. Settings, branding, and the member app

### Branded app tiers

**Member App (included):** Listed within the shared Glofox app on App Store/Google Play. Members search for the studio by name. Studio logo shows in header only, not as app icon.

**Standalone Branded App (premium add-on):** Custom app published under the studio's own name with its own app icon. Requires Apple Developer Account (organization) and Google Developer Account. Built by Glofox mobile team (~2 weeks build + up to 7 days Apple/Google review). Rebranding changes require Glofox team involvement — do not auto-deploy.

**Customization:** App icon, splash screen, three brand colors (primary/secondary/tertiary via hex codes — app auto-calculates accessible combinations), per-event images. Feature toggles control which services and information clients see.

**Member app capabilities:** Class/appointment/facility booking (two-click quick booking), waitlist management, membership and credit pack purchases, payment method management, profile and credit balance viewing, biometric login, e-agreement signing, news feed, auto-generated check-in barcode.

### Web Portal (website integration)

iFrame-based embed supporting Class Schedule, Memberships, Courses, Appointments, Facilities, and Lead Capture. Color customizable. Layout options: Week/Day/List view (responsive). Custom links to show filtered content. Shareable direct links to specific classes/memberships/credit packs. Compatible with WordPress, Squarespace, Shopify, Duda, Framer, GoDaddy, Webflow, and any HTML-editable site. **No custom domain capability** documented.

---

## 10. Backend logic — how systems connect

### Booking engine validation sequence

When a member initiates a booking, the system performs checks in this order: (1) membership active (overdue/unpaid blocks booking), (2) credit availability with correct category match, (3) payment cycle compliance (current + next cycle only), (4) booking window validity, (5) capacity check (full → waitlist or staff override), (6) maximum bookings limit check, (7) strike system check. **Credits are deducted at time of booking**, not at attendance. One credit = one booking regardless of duration.

### Membership status state machine

```
Active ──→ Paused (admin-initiated; bookings auto-cancelled; payment date extended)
Active ──→ Overdue (first failed payment; immediate booking block; club access lost after 7 days)
Overdue ──→ Active (successful retry or write-off)
Overdue ──→ Unpaid (all retries exhausted; next cycle still attempted automatically)
Active ──→ Cancelled (immediate or scheduled; scheduled cancellation auto-cancels future bookings on execution date)
Active ──→ Expired (end date reached)
Lead ──→ Trial (trial membership purchased; auto-status change)
Trial ──→ Active/Client (full membership purchased)
```

**Propagation details:** When a membership is paused, only bookings made with that membership are cancelled — PAYG and appointment bookings persist (must be manually cancelled). On scheduled cancellation, credits are **not** auto-removed or adjusted — requires manual intervention. If a member is deleted without cancelling their subscription, **recurring payments continue to charge**.

### Multi-location architecture

Each location operates as an **independent dashboard instance** with its own classes, schedules, memberships, facilities, trainer profiles, payment settings, and booking rules. No settings inheritance — everything is configured per location. Roaming memberships must be created separately at each location. Members have a "Home Studio" where their membership and billing live. Cross-location booking requires explicit roaming enablement per membership type. **Editing an existing membership to add roaming only applies to new signups** — existing members are not retroactively enabled. Glofox Insights supports aggregate and per-location reporting.

---

## 11. API, integrations, and data access

### REST API

The developer portal at apidocs-plat.aws.glofox.com provides OpenAPI/Swagger specifications. **Access is gated to Elite plan customers** and requires contacting apiactivation@abcfitness.com. Authentication uses API keys with a Branch ID header. All calls must be made from a secure backend — client-side calls explicitly prohibited.

**Documented API flows:** Lead Sale (lead CRUD, membership sales), Payment Collector (payment intents, charges), Login (authentication/tokens), Avatar (profile images), Book (booking create/read/cancel), and Agreements (contract management). A Swagger spec for booking/2.0 exists on SwaggerHub.

**CDC Webhooks:** Change Data Capture webhooks push real-time event notifications. Confirmed webhook events include invoice creation/status changes (via Zapier instant trigger). Likely also covers user creation/updates and potentially booking events.

### Zapier integration (Elite only)

**Two triggers:** "Updated Invoice" (instant webhook — fires on invoice create/update, filterable by status like PAID, PAST_DUE) and "New or Updated User" (polling every 15–30 minutes, requires Location ID). **Two actions:** "Create Lead" (Location ID, name, email, marketing source, phone, consent flags) and "Get Users" (full user list for one-time sync). **Notable gap: no booking, class, or membership-level triggers or actions.**

### Key integration details

**ClassPass:** Two-way. Set "Max ClassPass Bookings" per class (e.g., 10 of 20 spots). Capacity dynamically synced. ClassPass bookings appear in Glofox with a "ClassPass" tag. **Cannot cancel ClassPass bookings through Glofox.** Private classes don't sync.

**Wellhub (GymPass):** Two-way. Clients visible with "Wellhub" tag. **Check-in is critical** — it triggers the payment confirmation to Wellhub. Failure to check in = lost revenue.

**Kisi (door access):** Real-time membership validation. Access granted if member has valid/active membership or a credit pack/drop-in for an event starting within 59 minutes. Attendance recorded on each access event. Schedule-based access differentiation (24/7 vs limited hours). Regions: US, Canada, Europe, Singapore, Australia.

**Mailchimp:** Syncs ALL leads and clients to a single Mailchimp audience list (cannot specify segments). Auto-syncs within minutes of new signups or preference changes. Required Mailchimp fields must be populated or sync fails per-member.

**Trainerize:** Automatic member sync based on selected membership types. When a client purchases a synced membership, they receive a Trainerize onboarding email. Bulk import feature included.

**Google Analytics/GTM:** Full ecommerce tracking with custom events and data layer variables (GF Membership, GF Branch name, GF Ecommerce). **Meta Pixel:** Tracks visits, registrations, add-to-cart, and purchases on web integration.

### Data export capabilities

| Data type | Export available | Format | Notes |
|-----------|-----------------|--------|-------|
| Transactions | ✅ | CSV | Includes payout data for Stripe users |
| Failed payments | ✅ | CSV | Time-period filtering |
| Payouts | ✅ | CSV | Stripe users only |
| Client/lead lists | ✅ | CSV | Via filtered client tab download |
| Payroll | ✅ | CSV | Max 1-month range |
| Booking/attendance | ⚠️ | — | Visible in reports but specific CSV export not documented |
| Full data export | ❌ | — | No self-service bulk export; requires contacting support |
| GDPR/DSAR export | ⚠️ | — | Handled through support requests, not self-service |

---

## 12. Known limitations and gaps that matter for a replacement build

### Facility booking — the biggest gap for sauna studios

Glofox's facility booking is architecturally primitive compared to its class system. **No waitlist for facilities** (only documented for classes). **No strike/no-show system for facilities.** No resource pooling, no buffer times, no variable durations per facility, no combined booking flows, and no add-on services per booking. A real-world sauna studio (KANA Wellness Center) works around this by having members "double book" consecutive slots for longer sessions. For The Sauna Guys, this entire module needs to be rebuilt from scratch with resource-aware scheduling.

### Reporting and data access

User reviews consistently identify reporting as the platform's weakest area. The Report Builder exists but offers limited depth. "For all the info you put into this app, absolutely nothing is exportable" is a representative user complaint. No PDF exports. Lead data CSV export is disputed (import exists, export capability is limited). Revenue-per-member and revenue-per-class reports are not standalone — achievable only through Insights drilldowns.

### Missing features users frequently request

- **Gift cards:** Not supported
- **Rewards/loyalty program:** No native feature (requires Perkville or Loyalsnap integration)
- **On-demand video library:** Not available natively
- **Dynamic pricing (peak/off-peak):** Not supported
- **Consumer marketplace/discovery:** No equivalent to Mindbody's marketplace
- **Custom fields on member profiles:** Only form-based notes, no structured custom field types
- **Proration on membership changes:** Explicitly unsupported
- **Multi-rate tax configuration:** Not documented
- **Business hours setting:** No standalone configuration

### Post-acquisition concerns (ABC Fitness, August 2022)

Multiple users report **70% price increases** post-acquisition. Long-term contract pressure (up to 3 years) appears to have increased. Support quality degradation is a common complaint — "support loop" where different staff repeatedly work the same issue without resolution, 48-hour response times, and difficulty extracting data for migration. Product development promises remain unfulfilled according to some users.

### Platform reliability issues from reviews

Branded app bugs frequently. Waitlist feature reported as non-functional for extended periods. Payment integration upgrade caused loss of direct Stripe access and billing errors (old clients reactivated and billed years after the fact). Class capacity randomly changes. Book-a-buddy feature described as "useless." Barcode scanning intermittently fails. Lead-to-member conversion glitches.

---

## Conclusion: what a replacement platform must address

This audit reveals Glofox as a **class-booking-first platform** that bolted on facility, appointment, and course booking as secondary features. Its strongest layers are the class scheduling engine, credit pack/membership pricing architecture, and the Stripe Connect payment pipeline. Its weakest layers are facility/resource booking, reporting, data export, and the API's gated access model.

For The Sauna Guys' custom replacement, **five architectural priorities emerge from this audit**: (1) Build a resource-aware booking engine that supports variable durations, buffer times, resource pooling, combined booking flows, and add-on services per booking — none of which Glofox offers. (2) Replicate the credit pack system's category restrictions and deduction priority logic, which is well-designed and should carry over. (3) Implement proper proration, dynamic pricing, and itemized invoicing — gaps Glofox explicitly acknowledges. (4) Provide first-class reporting with custom report building, PDF export, and per-resource/per-member revenue analytics. (5) Build an open API from day one rather than gating it behind premium tiers, enabling seamless integration with Stripe (direct, not via Connect intermediary), door access systems, and marketing tools.

The membership status state machine (Active/Paused/Overdue/Unpaid/Expired/Cancelled), credit deduction priority algorithm, and waitlist auto-enrollment logic documented above are all well-architected subsystems worth replicating closely. The booking validation sequence, cancellation credit return rules, and failed-payment retry cadence provide precise specifications for equivalent backend logic. What Glofox gets right should be matched; what it gets wrong — particularly around resource booking, reporting, and data portability — represents the competitive advantage opportunity for a custom build.