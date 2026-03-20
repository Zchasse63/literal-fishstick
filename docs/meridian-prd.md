# Meridian — Product Requirements Document (PRD)

**Version:** 1.0
**Author:** Zach M. + Claude
**Date:** March 20, 2026
**Status:** Complete — Admin Dashboard + Employee Portal scope. Foundation for future iOS apps and member portal.

---

## 1. Product Overview

### 1.1 What Is Meridian?
Meridian is a full-stack fitness studio operating system that replaces Glofox and similar platforms. It manages every aspect of studio operations — booking, members, revenue, marketing, employee management, corporate accounts, events, and analytics — powered by AI as core infrastructure.

### 1.2 Who Is It For?
**Primary user (Phase 1):** The Sauna Guys — a Tampa-based sauna and cold plunge recovery studio.

**Future users:** Other fitness and wellness studios (yoga, Pilates, recovery, boutique fitness) via SaaS licensing once stress-tested internally.

### 1.3 Why Build It?
Glofox (current platform) has critical limitations:
- No dual-role accounts (owner can't be a member under the same email)
- No self-service membership upgrades
- No proration support
- Primitive facility booking (fixed duration, no buffers, no combined flows)
- No trainer economy features (promo codes, bonus thresholds, attribution)
- No employee portal (clock in/out, payroll)
- Static dashboard — no real-time data, no AI insights
- Stripe Connect wrapper with higher fees and less control

Meridian solves all of these and adds AI-powered intelligence, a trainer economy, corporate/event management, and an employee portal.

### 1.4 What Are We NOT Building?
- Weather correlation analysis (DEFER)
- IoT equipment logging (DEFER)
- Custom dashboard widget builder (DEFER)
- Corporate wellness portal (DEFER)
- Native Swift iOS app (using React Native instead)
- Custom proration engine (using Stripe's native)
- Custom payment processing (Stripe handles everything)

---

## 2. Users & Roles

### 2.1 Role Architecture
**Single account, multiple roles.** One email address can hold any combination:

| Role | Access Level | Example |
|---|---|---|
| **Studio Owner** | Full admin — all modules, all settings, all data | Zach M. |
| **Manager** | Admin access minus billing/financial settings | Future hire |
| **Trainer/Instructor** | Own schedule, class roster, performance metrics, promo code dashboard | Whitney Cooper |
| **Front Desk Staff** | Check-in kiosk, walk-in booking, member lookup, clock in/out | Part-time staff |
| **Member** | Book classes, manage account, buy merch, community board | All paying members |

**Dual-role examples:**
- Owner = Studio Owner + Member (books classes, has personal wellness tracking)
- Trainer = Trainer + Member (leads classes AND tracks personal attendance)

### 2.2 Analytics Exclusion
Any profile can be flagged "Exclude from analytics." This removes their data from:
- Revenue calculations (MRR, ARPM, transaction totals)
- Attendance averages and fill rates

**But they still count toward:**
- Physical class capacity (they're in the room)
- Headcount for safety/compliance

---

## 3. Business Model (The Sauna Guys)

### 3.1 Class Format
| Type | Description | Capacity | Duration |
|---|---|---|---|
| **Open Sauna / Free Flow** | Self-directed. Members use sauna + cold plunges freely. | 12 per slot | 1 hour |
| **Guided Class** | Instructor-led breathwork with themed 15-min sauna blocks. | 7–10 typical | 1 hour |

**Booking model:** Members book a TIME SLOT, not a specific piece of equipment. Like booking a yoga class.

**Equipment:** 1 sauna (12 capacity), 6 cold plunges. Free flow usage pattern: 10–20 min sauna → shower → 2–4 min cold plunge → repeat.

**Current Weekly Schedule:**
| Day | Slots | Notes |
|---|---|---|
| Monday | 5:00 PM, **6:00 PM (Trent — Guided)**, 7:00 PM | Open Sauna except 6pm |
| Tuesday | 5:00 PM, 6:00 PM, 7:00 PM | All Open Sauna |
| Wednesday | 5:00 PM, 6:00 PM, **7:00 PM (Whitney — Guided)** | Open Sauna except 7pm |
| Thursday | 5:00 PM, 6:00 PM, 7:00 PM | All Open Sauna |
| Friday | 5:00 PM, 6:00 PM, 7:00 PM | All Open Sauna |
| Saturday | 9:00 AM, 10:00 AM, 11:00 AM, 12:00 PM | All Open Sauna |
| Sunday | 9:00 AM, 10:00 AM, 11:00 AM, **12:00 PM (Drennen — Guided)** | Open Sauna except 12pm |

**All slots are 1 hour, capacity 12 per slot.**

### 3.2 Revenue Streams

| Stream | Type | Details |
|---|---|---|
| **Memberships** | Recurring | Unlimited, class packs (6-class, 10-class) |
| **Drop-ins** | One-time | Single session purchase |
| **Credit packs** | Prepaid | Bundles with expiry (+ 7-day grace period) |
| **Private sessions/events** | Request-based | Request flow, not instant booking |
| **Merchandise** | In-studio pickup | Apparel, accessories. Shipping DB built but not active. |
| **Gift cards** | Wallet balance | Purchasable by anyone. Redeemable for anything. Never expires. |
| **Member discounts** | Automatic | 10–15% off merch/gift cards for active recurring members |

### 3.3 Pricing (Current — subject to future adjustment)

**Recurring Memberships:**
| Plan | Price | Credits | Billing | Guest Passes |
|---|---|---|---|---|
| Monthly Unlimited | $225/mo | Unlimited | Monthly | 2/month |
| 10 Classes Per Month | $180/mo | 10 | Monthly | 1/month |
| 6 Classes Per Month | $120/mo | 6 | Monthly | 1/month |

**Non-Recurring (No Commitment, No Expiration):**
| Plan | Price | Credits |
|---|---|---|
| 8 Class Pack | $225 | 8 |
| 4 Class Pack | $120 | 4 |
| Sauna Sampler (One-Time Offer) | $60 | 3 |

**Single Session:**
| Plan | Price | Credits |
|---|---|---|
| One-Time Drop-In | $39 | 1 |

**Gift Cards:**
| Option | Price | Credits |
|---|---|---|
| 1 Class Gift Card | $39 | 1 |
| 4 Class Gift Card | $120 | 4 |
| 8 Class Gift Card | $225 | 8 |
| Custom Amount | Variable | Wallet balance (dollar value) |

**Note:** Gift cards with class credits are converted to wallet balance at the corresponding dollar value. Custom amount gift cards go directly to wallet balance.

**Member Discount:** 10% off merch and gift cards for active recurring members. Applied automatically at database level when membership is active. Locked at checkout start.

**Private Sessions/Events:** $395 for first hour (displayed in UI as promotional rate), tapering rate for additional hours (longer event = lower per-hour rate). Both the base rate and taper structure are configurable in admin settings. $395 is the default shown in frontend/member-facing surfaces.

### 3.4 Trainer Economy

| Feature | Details |
|---|---|
| **Assignment** | Each class slot has one assigned trainer |
| **Base pay** | $35 per class |
| **Bonus threshold** | 7+ checked-in members = $20 bonus. Based on check-ins, not bookings. Trainer's own attendance doesn't count. |
| **Promo codes** | Each trainer gets a referral code. Attribution is code-based, point-in-time, final. One use per member. |
| **Promo commission** | 10% of the attributed sale (membership or pack purchase) |
| **Profiles** | Public-facing (bio, schedule, specialties) on iOS app + website |

**Current Trainers:**
| Trainer | Assigned Classes |
|---|---|
| Whitney | Wednesday 7:00 PM (Guided Breathwork) |
| Drennen | Sunday (Guided) |
| Trent | Monday 6:00 PM (new — just signed) |

---

## 4. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| **Frontend (Admin Dashboard)** | Next.js | Hosted on Netlify |
| **Frontend (Member Web Portal)** | Next.js (same app, role-based routing) | Booking, account mgmt, merch |
| **Frontend (Landing Page)** | Astro (separate — existing partial build) | Current operational site on Wix, Astro later |
| **iOS App** | React Native | Member-facing. Phase 2. |
| **Backend** | Supabase | Postgres + Auth + Realtime + Edge Functions |
| **Database** | Postgres (via Supabase) | RLS with studio_id for multi-tenancy |
| **Vector Search** | pgvector | AI-powered search and retrieval |
| **Payments** | Stripe (direct) | + Apple Pay, Google Pay |
| **Auth** | Supabase Auth | Magic Link / SSO for members |
| **Email** | Resend | Click tracking, open tracking |
| **SMS** | Stubbed out | Provider TBD. Provider-agnostic architecture. |
| **AI/LLM** | Anthropic SDK (Claude) | Core infrastructure from day one |
| **Instagram** | SnapWidget embed | Not API integration |
| **Repo structure** | Turborepo (monorepo) | Shared types, utilities, API client across all apps |

---

## 5. Module Specifications

### 5.1 Command Center (Dashboard Home)

**Purpose:** Single-screen operational overview. The first thing the owner sees every morning.

**Components:**
| Component | Details |
|---|---|
| **AI Briefing Card** | "Good morning, [Name]" + 3 contextual insights with action links. Indigo-to-violet gradient border. Rules-based + LLM-powered. |
| **Metrics Strip** | Bookings Today, Live Occupancy, Revenue Today, Walk-ins, No-Shows. Each with sparkline + trend badge. Every number clickable/drillable. |
| **Live Facility Map** | Visual grid showing all equipment/resources. Status: Occupied (indigo tint), Available (green tint), Cleaning (amber), Maintenance (red/striped). Status dots, member names on occupied units, countdown timers. |
| **Today's Schedule** | Vertical timeline with booking blocks color-coded by type. Current time indicator. "+" quick-add buttons on empty slots. |
| **Activity Feed** | Real-time scrolling list: check-ins, new bookings, payments, failed payments. Each entry: timestamp + icon + description + clickable. |
| **Global Elements** | "Live Status: Healthy" indicator, Cmd+K search, "+" floating action button |

### 5.2 Schedule

**Purpose:** Class management, booking, and walk-in handling.

**Pages:**
| Page | Details |
|---|---|
| **Class Calendar** | Week/day/month views. Swimlane by time slot (not by resource — group-class model). Drag-to-create, click-to-edit. Trainer assignment per slot. Color-coded by class type. |
| **Walk-In Kiosk Mode** | Full-screen, touch-optimized. QR code scanner for member check-in. Walk-in booking for available slots. Staff-facing (iPad at front desk). |
| **Waitlist Management** | Per-class waitlists. Auto-promotion with 15-min claim window. Notification cascade: push → SMS. Manual override for staff. |
| **Resource Management** | Equipment inventory (sauna, cold plunges). Status tracking (active, maintenance, cleaning). Buffer time configuration. |

**Booking Flow (Member-Facing):**
1. View schedule → select time slot
2. See availability (X/12 spots remaining)
3. Confirm booking (credit deducted at booking time)
4. Receive confirmation push/email
5. Check in via QR code at kiosk

**Walk-In Flow:**
1. Staff scans member QR code or searches by name
2. System shows available current/next slots
3. Staff books member into slot
4. Credit deducted (or drop-in payment processed)

### 5.3 Members

**Purpose:** Member management, segmentation, and AI-powered profiles.

**Pages:**
| Page | Details |
|---|---|
| **Member Directory** | Searchable/filterable list. Columns: name, membership type, status, last visit, credits remaining, LTV. Bulk actions. |
| **Smart Segments** | Auto-updating member groups (e.g., "At-risk: no visit in 14 days", "High-value: top 10% LTV"). Custom segment builder. |
| **Member Profile** | Full 360° view: contact info, membership details, credit balance, wallet balance, visit history, booking history, strike count, wellness journey (streaks, personal records), AI-powered insights ("This member typically books Tues/Thurs evenings"), promo code used, family account links, waivers signed, guest pass usage, referral conversions. Analytics exclusion toggle. |
| **Family Accounts** | Parent account links to child accounts. Shared credit pool. Individual strike tracking. |
| **Guest Management** | Guest visit log (which member brought which guest, when). Repeat guest tracking. Conversion tracking (guest → member attribution). Guest waiver status. |

### 5.4 Revenue

**Purpose:** Financial management, membership administration, commerce.

**Pages:**
| Page | Details |
|---|---|
| **Revenue Dashboard** | MRR, ARPM, churn rate, revenue trend charts. Clickable into detail. |
| **Transactions** | All payments: memberships, drop-ins, merch, gift cards. Filter by type, date, status. Refund capability. |
| **Memberships & Pricing** | Plan configuration (unlimited, class packs, drop-in rates). Pricing per location. Self-service upgrade/downgrade rules. Stripe proration settings. |
| **Dunning** | Failed payment management. Auto-retry sequence. Member notifications. Grace period settings. |
| **Invoicing** | Generate and send invoices. Corporate billing support. |
| **Merch & Inventory** | Product catalog (name, price, SKU, inventory count). In-studio pickup workflow. Inventory hold (15-min at add-to-cart). Member discount auto-applied. Shipping fields in DB (inactive). |
| **Gift Cards** | Issue/redeem gift cards. Wallet balance tracking. Purchase flow for non-members. |

### 5.5 Marketing

**Purpose:** Campaigns, automation, and lead management.

**Pages:**
| Page | Details |
|---|---|
| **Campaign Builder** | Email campaigns via Resend. SMS stubbed out. Template library. Segment targeting. A/B testing. Schedule or send immediately. Click/open tracking. |
| **Automation Flows** | Visual flow builder. Triggers: signup, no-show, churn risk, credit expiry, birthday. Actions: send email, send SMS (future), apply tag, create task. |
| **Lead Pipeline** | Lead capture → nurture → convert. Source tracking. Lead scoring. |
| **Content Hub** | Community/social board management. Post creation for trainers and studio. Member interaction moderation. |

### 5.6 Corporate

**Purpose:** Business-to-business accounts and events.

**Pages:**
| Page | Details |
|---|---|
| **Company Accounts** | Corporate client management. Bulk memberships. Corporate billing. Usage reporting. |
| **Event Management** | Private events and group bookings. Request flow (not instant booking). Pricing, scheduling, capacity. |

### 5.7 Operations

**Purpose:** Staff management, employee portal, facility management, settings.

**Pages:**
| Page | Details |
|---|---|
| **Staff Management** | Employee roster. Role assignment. Trainer profiles. Schedule management. |
| **Employee Portal** | Clock in/out with geofencing verification. Timesheet view. Payroll summary. Tax documentation access. |
| **Facilities** | Location management. Equipment/resource configuration. Maintenance scheduling. |
| **Waivers** | Digital waiver management. E-signature. Auto-send on first booking. Family waiver support (one signature covers minors). Expiry/renewal tracking. |
| **Settings** | Cancellation policy configuration (strike thresholds, windows). Booking rules. Notification preferences. Multi-location settings. API keys. |

### 5.8 Analytics

**Purpose:** Business intelligence and AI-powered recommendations.

**Pages:**
| Page | Details |
|---|---|
| **Dashboards** | Customizable analytics views. Pre-built: attendance trends, revenue breakdown, member retention, trainer performance. |
| **AI Insights** | LLM-powered analysis. "Your Tuesday 6pm slot has been at 95% capacity for 3 weeks — consider adding a 5pm slot." Churn prediction. Scheduling optimization. Pricing recommendations. |
| **Reports** | Exportable reports. Payroll reports (per-trainer: base pay + bonuses + promo commissions). Attendance reports. Revenue reports. |

---

## 6. Member-Facing Surfaces

### 6.1 Web Booking Portal (Phase 5 — Post-Dashboard)
Member-facing booking surface. Requires separate design system and planning documentation.

**Features:**
- View class schedule
- Book a time slot
- Join waitlist
- View/manage account (profile, payment method, membership)
- Self-service upgrade/downgrade with proration preview
- Credit balance + wallet balance display
- Purchase merch (in-studio pickup)
- Redeem gift cards
- View trainer profiles
- Wellness journey (visit history, streaks)
- "Invite a Guest" — generate QR code or share link, guest signs up + signs waiver via link

### 6.2 iOS Member App (Phase 5 — Post-Dashboard, React Native)
Full-featured mobile experience. Everything in 6.1 plus:

- Push notifications (booking confirmations, waitlist promotions, credit expiry)
- QR code display for check-in
- Community/social board
- Instagram feed (SnapWidget)
- Apple Pay / Google Pay checkout
- Offline-capable schedule viewing

### 6.3 iOS Employee App (Phase 5 — Post-Dashboard, React Native)
Employee-facing mobile app for trainers and front desk staff:

- Walk-In Kiosk mode (check-in scanning, walk-in booking)
- Clock in/out with geofencing
- View assigned classes and rosters
- Trainer performance dashboard (mobile)
- Push notifications for schedule changes

### 6.4 Landing Page / Marketing Website (Phase 5 — Post-Dashboard)
Public-facing marketing site.

- Studio information, class descriptions, trainer bios
- "Book a Class" CTA → links to web booking portal
- "Buy a Membership" CTA → links to signup flow
- Gift card purchase flow
- SnapWidget Instagram embed
- SEO-optimized

---

## 7. Edge Case Policies (Summary)

All 17 edge cases are fully defined in `edge-case-policies.md`. Key policies:

| # | Edge Case | Decision |
|---|---|---|
| 1 | Last-seat race condition | Atomic insert — first to submit wins |
| 2 | Late cancellation | Progressive strikes (1st free, 2nd $5 fee, 3rd $10 fee). Unlimited members: warning-only. System + member-level toggles. |
| 3 | Studio cancels class | Credits refunded, expiry extended +2 days, trainer not paid |
| 4 | No-show | Same strike system. Unlimited members: warning-only. |
| 5 | Waitlist promotion | 15-min claim window, push → SMS fallback |
| 6 | Upgrade proration | Stripe native proration, transparent preview |
| 7 | Credit expiry | 7-day grace period, auto-notifications at 7/3/1 days |
| 8 | Gift cards | Wallet balance system, never expires |
| 9 | Discount mid-checkout lapse | Discount locked at checkout start (30-min window) |
| 10 | Family credits | Pool-based, individual strikes, parent waiver covers minors |
| 11 | Promo attribution | Code-based, point-in-time, final, no retroactive |
| 12 | Bonus threshold | Check-ins, not bookings. Trainer doesn't count. |
| 13 | Trainer multiple classes | Independent evaluation per class |
| 14 | Owner booking | Books as member, respects capacity (override with audit log) |
| 15 | Trainer self-check-in | Separate from leading. Optional wellness tracking toggle. |
| 16 | Data migration | 5-wave soft migration alongside Glofox |
| 17 | Merch fulfillment | In-studio pickup, shipping DB ready but inactive |
| 18 | Guest passes | QR/link invite flow, counts toward capacity, conversion tracking, rewards TBD |

---

## 8. Data Migration Plan

### 8.1 Source
Glofox data export (CSV) — already saved in PSG data folder.

### 8.2 What Migrates
- ✅ Member profiles (name, email, phone, join date)
- ✅ Credit balances (exact as-is)
- ✅ Booking history (all-time, for wellness journey tracking)
- ✅ Membership types and statuses
- ❌ Payment methods (Stripe Connect — not portable)
- ❌ Waitlist positions (ephemeral — members re-join)

### 8.3 Migration Waves
1. Import data into Meridian (Glofox stays active)
2. Internal testing (owners + friends/family)
3. Pilot program (20–30 selected members, small discount)
4. Full rollout (all members, onboarding campaign)
5. Glofox shutdown

### 8.4 Double-Billing Prevention
Track each member's Glofox renewal date. Don't activate Meridian billing until the day after their current Glofox cycle ends.

---

## 9. Multi-Tenancy

- Every tenant table includes `studio_id` / `location_id`
- Postgres Row-Level Security (RLS) enforces tenant isolation
- Different locations can have different pricing
- "All-access" memberships work across all locations
- Built from day one — no retrofit needed

---

## 10. AI Architecture

### 10.1 Approach
AI is core infrastructure, not a Phase 3 add-on. Both rules-based intelligence and LLM-powered insights ship together.

### 10.2 Rules-Based Intelligence
- Churn risk scoring (weighted algorithm based on visit frequency, payment history, engagement)
- Credit expiry notifications
- Fill rate analysis and scheduling recommendations
- Trainer performance metrics
- Revenue trend detection

### 10.3 LLM-Powered Features (Anthropic SDK / Claude)
- AI Briefing Card on Command Center (contextual daily insights)
- Member profile insights ("This member typically books Tues/Thurs evenings")
- Copy generation for marketing campaigns
- Natural language analytics queries
- Scheduling optimization recommendations
- Pricing recommendations based on demand patterns

### 10.4 pgvector
Semantic search across member notes, campaign content, and support history. Enables "find members similar to X" and intelligent content retrieval.

---

## 11. Implementation Phases

> **Principle:** Complete the entire admin dashboard and employee web portal before starting any member-facing, iOS, or customer-facing surfaces. Those require separate design systems, planning, and documentation.

### Phase 1: Core Platform ✅ COMPLETE
**Goal:** Replace Glofox for internal use — backend + admin dashboard foundation.

**Deliverables (done):**
- Admin Dashboard: Command Center, Schedule, Members, Revenue, Settings
- Employee Portal: Clock in/out, classes, pay, performance, promo codes, profile
- Supabase backend with multi-tenant schema (RLS, all core tables)
- Stripe integration (memberships, drop-ins, credit packs, merch, gift cards)
- Resend email integration (campaign sends with open/click/reply tracking via inbound webhooks)
- AI Briefing Card (rules-based + LLM)
- QR code check-in system
- Smart segments + member tagging system
- 10 AI features (Campaign Copy, Health Score, NL Search, Booking Patterns, Churn Prediction, Auto-Reply, Revenue Anomaly, Waitlist Messaging, Trainer Summaries, Intake Enrichment)

### Phase 2: Marketing & Engagement (Admin Dashboard)
**Goal:** Full marketing toolkit within the admin dashboard.

**Deliverables:**
- Marketing module UI (campaign builder, template editor, audience targeting)
- Automation flows (trigger-based email sequences)
- Lead pipeline (capture → nurture → convert)
- SMS integration (provider selected and integrated)
- Content hub (social media post scheduling, content calendar)

### Phase 3: Analytics & Intelligence (Admin Dashboard)
**Goal:** Advanced analytics and AI-powered insights within the admin dashboard.

**Deliverables:**
- Custom analytics dashboards (drag-and-drop widgets)
- AI insights module UI (surface existing AI features: churn, booking patterns, revenue anomalies)
- Advanced reporting (exportable CSV/PDF, scheduled email reports)
- Trainer performance dashboards (surface existing trainer summary AI)
- Pricing simulator
- Data migration from Glofox (Waves 1–3)

### Phase 4: Corporate & Operations (Admin Dashboard)
**Goal:** Complete all remaining admin dashboard modules.

**Deliverables:**
- Corporate portal (company accounts, bulk memberships, corporate billing)
- Event management module (private events, parties, group bookings)
- Full employee portal enhancements (payroll integration, tax documents, geofencing verification)
- Merch shipping (activate DB infrastructure, add carrier APIs)
- Waitlist management UI improvements
- SaaS onboarding flow for new studios
- API documentation portal
- Admin dashboard polish, bug fixes, and performance optimization

### Phase 5: Member-Facing & Mobile (Post-Dashboard)
**Goal:** Build all customer-facing and mobile surfaces. Requires separate design system, UX planning, and documentation.

**Deliverables:**
- Web Booking Portal (member-facing booking page, account management, self-service upgrades)
- iOS Member App (React Native — booking, payments, community board, push notifications, Apple/Google Pay)
- iOS Employee App (React Native — walk-in kiosk, clock in/out with geofencing, trainer mobile dashboard)
- Landing Page / Marketing Website (Astro — SEO-optimized, booking CTAs, trainer profiles)
- Community/social board (members-only)
- Push notification infrastructure
- Offline-capable schedule viewing

---

## 12. Design System

Full design specifications extracted from MagicPath output in `magicpath-design-guide.md`. Source code in `magicpath-project (11)/` (admin) and `magicpath-project (12)/` (employee portal).

**Core principles:**
- Linear meets Apple Health meets Stripe Dashboard
- Confident, information-dense, never boring
- AI elements use indigo-to-violet gradient border
- Every number is clickable/drillable
- Cmd+K command palette for power users
- Dark mode support

**Color palette:**
- Primary: Deep indigo `#4F46E5`
- Secondary/AI: Violet `#8B5CF6`
- Warning/Alerts: Warm amber `#F59E0B`
- Success: Emerald `#10B981`
- Danger: Soft coral `#F97316` / Red `#EF4444`
- Surfaces: Near-white `#FAFAFA`, warm gray cards `#F5F5F4`
- Dark mode: `#0F0F11` background, `#1A1A1F` cards
- Typography: Inter (Google Fonts), weights: medium/semibold/bold/black

**Component system:** shadcn/ui (Radix primitives) styled with Meridian design tokens
**Icons:** Lucide React (~65 icons mapped)
**Charts:** Recharts (Area, Line, Bar, Pie/Donut)
**Animations:** Framer Motion — page transitions, modals, progress bars, nav pill, toasts

**Design assets:** ✅ Complete for admin + employee portal scope. 17 pages designed across both MagicPath projects. All design tokens, component specs, animation specs, and responsive patterns documented in design guide.

### 12.1 Dependencies

**Core:**
`next`, `react`, `react-dom`, `typescript`, `turbo`

**Styling & UI:**
`tailwindcss` (v4), `tailwind-merge`, `clsx`, `tailwindcss-animate`, `framer-motion`

**Components:**
`shadcn/ui` (installs Radix primitives as needed: Dialog, DropdownMenu, Tabs, Table, Command, Toast, Tooltip, Sheet, Select, Input, Badge, Calendar, Popover, Avatar)

**Icons & Charts:**
`lucide-react`, `recharts`

**Data Layer:**
`@supabase/supabase-js`, `@supabase/ssr`, `@tanstack/react-query`

**Payments:**
`stripe`, `@stripe/stripe-js`, `@stripe/react-stripe-js`

**AI:**
`@anthropic-ai/sdk`

**Email:**
`resend`, `@react-email/components`

**Utilities:**
`date-fns`, `zod`, `sharp`, `qrcode`

**Dev:**
`eslint`, `eslint-config-next`, `prettier`, `prettier-plugin-tailwindcss`, `supabase` (CLI)

---

## 13. Scope Clarification

### What This PRD Covers (Build Now)
- **Admin Dashboard** — all 8 modules (Command Center, Schedule, Members, Revenue, Marketing, Operations, Analytics, Segments/Engagement)
- **Employee Portal** — web-based portal for trainers and staff (clock in/out, timesheets, pay, performance, promo codes)
- **Supabase Backend** — database schema, RLS policies, Edge Functions, auth — designed as the **shared foundation** for all future apps
- **Stripe Integration** — memberships, payments, proration
- **Resend Email Integration** — transactional + campaign emails

### What This PRD Does NOT Cover (Separate Future Builds)
- Employee iOS App (React Native) — will consume same Supabase backend
- Member iOS App (React Native) — will consume same Supabase backend
- Member Web Booking Portal (Next.js) — will consume same Supabase backend
- Landing Page (Astro) — Wix operational for now
- Walk-in Kiosk mode — will be part of Employee iOS App

**Architecture note:** The Turborepo monorepo and shared packages (types, Supabase client, business logic) are designed so that building these future apps requires only new UI layers — all data, auth, and business logic is already done.

---

## 14. Decision Log — All Items Resolved

### Pricing & Business
| # | Decision | Value |
|---|---|---|
| 1 | Membership pricing | ✅ Unlimited $225/mo, 10-class $180/mo, 6-class $120/mo |
| 2 | Drop-in rate | ✅ $39 |
| 3 | Credit pack pricing | ✅ 4-pack $120, 8-pack $225, Sampler 3-pack $60 |
| 4 | Private session/event pricing | ✅ $395 first hour (configurable), tapering rate for additional hours |
| 5 | Member discount | ✅ 10% off merch/gift cards for active recurring members |
| 6 | Trainer base pay | ✅ $35/class |
| 7 | Trainer bonus | ✅ $20 when threshold (7+ check-ins) met |
| 8 | Trainer promo commission | ✅ 10% of attributed sale |
| 9 | Gift card denominations | ✅ Preset ($39, $120, $225) + custom amount |

### Policy
| # | Decision | Value |
|---|---|---|
| 10 | Strike penalties | ✅ 1st free, 2nd $5 flat, 3rd $10 flat. Rolling 30-day window. |
| 11 | Unlimited member exemption | ✅ Warning-only (no financial penalty). System + member-level toggles. |
| 12 | Late cancellation window | ✅ 1 hour before class. Configurable in Settings UI. |
| 13 | Pilot program discount | ✅ 20% discount during pilot phase |

### Technical
| # | Decision | Value |
|---|---|---|
| 14 | Repo structure | ✅ Turborepo monorepo |
| 15 | Admin dashboard framework | ✅ Next.js |
| 16 | Member web portal framework | ✅ Next.js (same app, role-based routing) |
| 17 | Landing page | ✅ Astro (partial build exists). Wix operational for now. |
| 18 | SMS provider | ✅ Deferred — provider-agnostic architecture built, provider chosen later |
| 19 | Component system | ✅ shadcn/ui (Radix primitives) styled with Meridian design tokens |
| 20 | Icon library | ✅ Lucide React (~65 icons identified from MagicPath designs) |
| 21 | Charts | ✅ Recharts (Area, Line, Bar, Pie/Donut) |
| 22 | Animations | ✅ Framer Motion (page transitions, modals, progress bars, layout) |

### Design
| # | Decision | Value |
|---|---|---|
| 23 | Admin dashboard designs | ✅ Complete — 9 pages from MagicPath 11, design guide extracted |
| 24 | Employee portal designs | ✅ Complete — 8 pages from MagicPath 12, design guide extracted |
| 25 | Design tokens | ✅ Complete — colors, typography, spacing, radius, animations documented in `magicpath-design-guide.md` |

### Operations
| # | Decision | Value |
|---|---|---|
| 26 | Operating hours | ✅ Weekdays 5–8 PM (3 slots), Weekends 9 AM–1 PM (4 slots) |
| 27 | Trainers | ✅ 3 trainers: Whitney, Drennen, Trent |
| 28 | Active members | ✅ ~11 active memberships + additional classpack users |
| 29 | Merch catalog | ✅ No current catalog. Framework built now, catalog later. |
| 30 | Waiver | ✅ Full waiver text provided. See Appendix A. |
| 31 | Geofencing radius | ✅ 200 meters |

---

## Appendix A: Waiver Text

**RELEASE OF LIABILITY, WAIVER OF CLAIMS, ASSUMPTION OF RISKS, INDEMNIFICATION AND PARTICIPATION AGREEMENT**

**WARNING: PLEASE READ CAREFULLY BEFORE SIGNING! THIS IS A RELEASE OF LIABILITY & WAIVER OF CERTAIN LEGAL RIGHTS INCLUDING THE RIGHT TO SUE OR CLAIM COMPENSATION**

Each person participating in the Activity (defined below), including, but not limited to, the undersigned party and those utilizing a "Class Pass" or other similar service enabling participation in the Activity, is referred to herein as "Participant." I, as the undersigned, am a Participant subject to the terms and conditions of this Release of Liability, Waiver Of Claims, Assumption Of Risks, Indemnification and Participation Agreement (the "Agreement"). Participant understands that participating in sauna classes, cold plunge classes, yoga, breathwork, utilizing the facilities and premises of the Facility, and the premises and equipment of THE SAUNA GUYS, LLC, a Florida limited liability company ("The Sauna Guys"), for any purpose (the "Activity"), can be HAZARDOUS AND INVOLVE THE RISK OF INJURY AND/OR DEATH.

Participant expressly acknowledges the dangers and risks of the Activity and Participant ASSUMES ALL INHERENT DANGERS AND RISKS of the Activity.

Exposure to disease and sicknesses, including but not limited to COVID-19 ("Sickness"), is an inherent risk of the Activity. Participant expressly acknowledges that The Sauna Guys cannot eliminate the risk that Participant is exposed to Sickness while engaged in the Activity. Participant agrees it is his or her responsibility to (1) follow all instructions, signage, warnings, and guidelines pertaining to the Activity or Facility; (2) stay home if sick or experiencing symptoms of any Sickness; (3) if required, wear a face covering and maintain at least six (6) feet physical distancing from other guests; and (4) wash and sanitize hands frequently.

Participant expressly acknowledges and assumes all risks and dangers pertaining to the Activity that may result in property damage, physical injury and/or death, which may be above and beyond the inherent dangers and risks of the Activity, including but not limited to: Falling, loss of balance, heart failure, high blood pressure, choking, drowning, stroke, spinal pain, limited access to and/or delay of medical attention, inadequate medical attention, Participant's health condition, physical exertion, exhaustion, dehydration, hypothermia, other sickness, or frostbite, and/or mental distress from exposure to any of the above. PARTICIPANT ACKNOWLEDGES THAT THE DESCRIPTION OF THE RISKS IN THIS AGREEMENT IS NOT COMPLETE. PARTICIPANT VOLUNTARILY PARTICIPATES IN THE ACTIVITY AND EXPRESSLY ASSUMES ALL RISKS AND DANGERS ASSOCIATED WITH THE ACTIVITY, INCLUDING, BUT NOT LIMITED TO, THE POSSIBILITY OF PERSONAL INJURY, DEATH, PROPERTY DAMAGE AND LOSS RESULTING THEREFROM, WHETHER OR NOT DESCRIBED HERE, KNOWN OR UNKNOWN, INHERENT OR OTHERWISE.

Participant assumes responsibility for any and all physical limitations such as (but not limited to): congestive heart failure, high blood pressure, stroke, glaucoma, detached retina, spinal issues, hiatal hernia, pregnancy, or any other health issues. Participant represents that Participant has prior physician consent/approval to participate in any service provided by The Sauna Guys, including the Activity. Participant represents and warrants that Participant is in good physical health and does not suffer from any medical condition, which would limit participation in the Activity or any other service offered at The Sauna Guys. Participant understands that it is Participant's responsibility to consult with a physician prior to and regarding their participation in any of the yoga classes, programs, workshops or any other service provided by The Sauna Guys. Participant understands the risks associated with the Activity and services offered by The Sauna Guys. Participant agrees to follow all instructions so that they may safely participate in classes, workshops, or any other services offered by The Sauna Guys. Participant understands that The Sauna Guys cannot provide medical treatment to Participant.

IN CONSIDERATION FOR PARTICIPATION IN THE ACTIVITY, PARTICIPANT AGREES, TO THE GREATEST EXTENT PERMITTED BY LAW, TO WAIVE ANY AND ALL CLAIMS AGAINST, HOLD HARMLESS, AND RELEASE THE SAUNA GUYS AND THE FACILITY, AND ALL OF THEIR RESPECTIVE INSURANCE COMPANIES, SUCCESSORS IN INTEREST, COMMERCIAL & CORPORATE SPONSORS, AFFILIATES, AGENTS, EMPLOYEES, REPRESENTATIVES, ASSIGNEES, OFFICERS, DIRECTORS, AND SHAREHOLDERS (EACH A "RELEASED PARTY") FOR ANY INJURY, INCLUDING, BUT NOT LIMITED TO, DEATH, LOSS, PROPERTY DAMAGE OR EXPENSE, WHICH PARTICIPANT MAY SUFFER, ARISING IN WHOLE OR IN PART OUT OF PARTICIPANT'S PARTICIPATION IN THE ACTIVITY, INCLUDING, BUT NOT LIMITED TO, THOSE CLAIMS BASED ON ANY RELEASED PARTY'S ALLEGED OR ACTUAL NEGLIGENCE OR BREACH OF ANY EXPRESS OR IMPLIED WARRANTY OR BREACH OF ANY STATUTORY OR OTHER DUTY OF CARE. PARTICIPANT UNDERSTANDS THAT NEGLIGENCE INCLUDES FAILURE ON THE PART OF ANY RELEASED PARTY TO TAKE REASONABLE STEPS TO SAFEGUARD OR PROTECT ME FROM THE RISKS, DANGERS AND HAZARDS OF THE ACTIVITY. IN CONSIDERATION FOR PARTICIPATING IN THE ACTIVITY, PARTICIPANT FURTHER RELEASES ANY AND ALL CLAIMS THAT PARTICIPANT HAS OR MAY HAVE AGAINST ANY RELEASED PARTY.

PARTICIPANT AGREES TO DEFEND AND INDEMNIFY EACH RELEASED PARTY FROM ALL LIABILITY AND CLAIMS, INCLUDING ATTORNEYS' FEES AND COSTS, WHETHER ACTUALLY INCURRED OR NOT AND AT ALL LEVELS, FEES AND THE COSTS OF ENFORCING ANY RIGHT BY THE RELEASED PARTIES TO INDEMNIFICATION UNDER THIS AGREEMENT, WHETHER ARISING IN WHOLE OR IN PART FROM PARTICIPANT'S PARTICIPATION IN THE ACTIVITY, PRESENCE ON THE PREMISES OF THE SAUNA GUYS OR THE FACILITY OR FROM ANY OF PARTICIPANT'S MISREPRESENTATIONS OR FRAUDULENT EXECUTION OF THIS AGREEMENT.

By signing this Agreement, Participant Consents to The Sauna Guys use of Participant's name, image, likeness, portrait, pictures, photographs, and/or videos for advertisements, promotions, live video streaming, and any other services offered by The Sauna Guys.

If any term or provision of this Agreement shall, to any extent, be invalid or unenforceable, such term or provision shall be treated as severable, leaving the remainder of this Agreement valid and enforceable.

Participant agrees to waive the protection of any applicable statutes in this jurisdiction whose purpose, substance and/or effect is to provide that a general release shall not extend to claims, material or otherwise, which the person giving the release does not know or suspect to exist at the time of executing said release.

**Note for Meridian implementation:** This waiver references "Cigar City CrossFit" as the Facility — this will need to be updated to reflect The Sauna Guys' current facility name/address when implemented. The waiver should be configurable per-location in multi-tenant mode.
