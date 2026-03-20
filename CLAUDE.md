# Meridian — Fitness Studio Operating System

## What This Project Is

Meridian is a custom-built management platform for fitness and wellness studios, starting with sauna/recovery businesses. It replaces Glofox (and similar platforms) with an AI-powered operating system that handles booking, members, revenue, marketing, corporate accounts, events, and analytics.

**Current phase:** Phase 1 complete. Phase 2 (Marketing & Engagement) up next. All admin dashboard and employee web portal work must be finished before any member-facing or iOS work begins.

**Business context:** Initially built for internal use by The Sauna Guys (Tampa-based sauna/recovery studio). Designed from day one to be sellable as a SaaS product to other studios once stress-tested.

## Key Files

| File | Purpose |
|---|---|
| `dashboard-research.md` | Market research: pain points across 15+ platforms, member complaints, pricing analysis, feature gaps |
| `glofox-feature.md` | Deep Glofox feature audit: every feature, backend logic, limitations, API details |
| `Glofox Application Map...md` | Scraped navigation structure with UI elements, actions, and page-level inventory |
| `Glofox Navigation Worklist...csv/xlsx` | Detailed element-level scrape data from live Glofox app |
| `glofox-to-meridian-audit.md` | Complete architecture comparison: Glofox current state → Meridian improvements, data flow analysis, navigation restructuring, implementation phases |
| `ui-prompts.md` | Full feature specification for all 8 modules with design system, user flows, and navigation structure |
| `prompt-1-command-center.md` through `prompt-8-mobile-member-app.md` | Individual prompts for UI builder tools (MagicPath / Stitch UI) |
| `design-review-round1.md` | Review of MagicPath output for Prompt 1 with prioritized fixes |
| `magicpath-mega-prompt.md` | Unified single-prompt for MagicPath — all 10 pages/screens in one prompt with corrected group-class booking model |
| `sauna-guys-business-model.md` | Detailed business operations doc: class format, trainer system, account roles, revenue streams, member-facing features |
| `edge-case-policies.md` | All 18 edge case policies (all decided) + architecture decisions log |
| `magicpath-design-guide.md` | Complete design guide extracted from MagicPath output — tokens, components, animations, responsive patterns, migration notes |
| `magicpath-project (11)/` | MagicPath admin dashboard source (Vite+React) — 9 pages, 5,474 lines |
| `magicpath-project (12)/` | MagicPath employee portal source (Vite+React) — 8 pages, 2,189 lines |
| `meridian-prd.md` | Product Requirements Document — full specification for development |
| `.scrutiny/` | Scrutinize analysis reports: feasibility, scope, user-value, cost-benefit, architecture-impact, edge-cases, competitive-context, verdict |

## Design System

- **Name:** Meridian
- **Aesthetic:** Linear meets Apple Health meets Stripe Dashboard. Confident, information-dense, never boring.
- **Primary color:** Deep indigo `#4F46E5`
- **Secondary:** Warm amber `#F59E0B` (action items/alerts)
- **Success:** Emerald `#10B981`
- **Warning:** Soft coral `#F97316`
- **Surfaces:** Near-white `#FAFAFA`, warm gray cards `#F5F5F4`
- **Dark mode:** `#0F0F11` background, `#1A1A1F` cards
- **Typography:** Inter or SF Pro
- **AI visual treatment:** Subtle indigo-to-violet gradient border on AI insight cards

## Tech Stack

- **Frontend hosting:** Netlify
- **Backend/Database/Auth:** Supabase (Postgres + Supabase Auth + Supabase Realtime)
- **iOS app:** React Native
- **Payments:** Stripe (direct, not Stripe Connect) + Apple Pay + Google Pay
- **Auth:** Magic Link / SSO (passwordless for members)
- **Email:** Resend (click tracking, open tracking)
- **SMS:** Stub out for now, provider TBD. Campaign infra must be provider-agnostic.
- **AI/LLM:** Anthropic SDK (Claude) — core infrastructure from day one
- **Vector search:** pgvector (for AI-powered search and retrieval)
- **Instagram:** SnapWidget embed (not API)
- **Multi-tenancy:** Postgres RLS with studio_id/location_id on every table
- **Real-time:** 60-second polling for Phase 1 (not WebSockets), reassess in Phase 2
- **Proration:** Stripe's native proration engine
- **Repo structure:** Turborepo monorepo (shared types, utilities, API client across all apps)
- **Admin dashboard + member portal:** Next.js (same app, role-based routing)
- **Landing page:** Astro (partial build exists, Wix operational for now)

## Architecture (8 Modules + Employee Portal)

1. **Command Center** — AI briefing, live metrics, facility map, schedule timeline, activity feed
2. **Schedule** — Class calendar, walk-in kiosk, waitlists, resource management
3. **Members** — Directory, smart segments, family accounts, AI-powered profiles
4. **Revenue** — MRR/ARPM/churn metrics, transactions, memberships & pricing, dunning, invoicing, merch/inventory
5. **Marketing** — Campaign builder (email via Resend, SMS stubbed), automation flows, lead pipeline, content hub
6. **Corporate** — Company accounts, event management, group/party bookings
7. **Operations** — Staff management, employee portal (clock in/out with geofencing, payroll, taxes), facilities, waivers, settings
8. **Analytics** — Custom dashboards, AI insights/recommendations, reports

**Member-facing surfaces (same Supabase backend):**
- Landing page / marketing website (booking, membership purchase)
- iOS member app (React Native)
- Web booking portal (Phase 1 — members need this before iOS app)

## How The Sauna Guys Actually Operates (Business Model Context)

This is critical context — Meridian's architecture must support this model as the primary booking flow.

### Class Format (Group-Based, Not Individual Resource Booking)

The Sauna Guys operates like a yoga/Pilates studio, NOT like a private sauna rental:

- **Capacity:** 1 sauna (holds 12 people), 6 cold plunges
- **Time slots:** Hour-long blocks (5–6pm, 6–7pm, 7–8pm, etc.)
- **Members book a time slot** (like booking a yoga class), not a specific piece of equipment
- **"Free Flow" / Open Sauna:** Members use the sauna and cold plunges freely during their hour — typically 10–20 min sauna → shower → 2–4 min cold plunge → repeat for 45–60 minutes
- **Guided Classes:** Same format but with an instructor (e.g., Whitney Cooper, Wednesdays 7–8pm). Instructor leads guided breathwork with different themes for each 15-min sauna block. Typically 7–10 people per guided class.

**Important:** Individual resource booking (private sauna reservations, like a "sweat house" model) should exist as a backend feature for future facilities that use that format, but it is NOT the primary booking model.

### Trainer / Instructor Features

- **Trainer assignment per class** — select which trainer leads each time slot
- **Trainer promo codes** — each trainer gets a referral code for membership/class pack purchases. Tracks attribution. Code-based, point-in-time, final. One use per member.
- **Performance bonus threshold** — if a trainer's class exceeds a threshold (e.g., 7+ check-ins), they earn a bonus. Based on CHECK-INS not bookings. Trainer's own attendance does NOT count.
- **Trainer profiles** — public-facing on the iOS app and website (bio, class schedule, specialties)

### Account & Role Issues (Glofox Pain Points to Solve)

- **Dual-role accounts:** Owners are also members who book classes. Glofox won't allow personal membership + admin under the same email. Trainers have the same problem — they may not have multiple emails. Meridian needs a single account with multiple roles (admin + member, trainer + member).
- **Profile exclusion from data:** Ability to flag specific profiles (e.g., former owners with complimentary memberships) to exclude from financial and attendance calculations. "Exclude from analytics" toggle on profiles so comped members don't skew revenue/attendance data. Comped members still count toward physical capacity.
- **Self-service membership upgrades:** Members must be able to upgrade (6-class → 10-class → unlimited) directly from their account without contacting the studio. Glofox blocks this. Meridian handles it with one-tap upgrade + automatic Stripe proration. Downgrades take effect at next billing cycle.

### Revenue Streams to Support

1. **Memberships** — recurring (unlimited, class packs)
2. **Drop-in / Day passes** — one-time purchases
3. **Credit packs** — prepaid bundles (7-day grace period on expiry)
4. **Private sessions/events** — bookable or request-based
5. **Merchandise** — apparel, accessories (in-studio pickup Phase 1, shipping infrastructure built in DB from day one)
6. **Gift cards** — wallet balance system. Purchasable by anyone, redeemable for anything. Balance never expires.
7. **Member discounts** — automatic 10% discount on merch and gift cards for active recurring members, applied at the database level when membership is active. Locked at checkout start.

### Payments & Auth

- **Stripe** as primary processor (direct, not Stripe Connect)
- **Apple Pay + Google Pay** support
- **SSO / Magic Link** authentication (no passwords for members)

### Member-Facing Features (iOS App + Website)

- Book classes, view schedule, manage account
- Buy merchandise (in-studio pickup)
- View and request private events (request flow, not instant booking)
- **Social/community board** (members-only) — trainers post special classes, studio posts events, members can interact
- **Instagram feed integration** embedded in the app and website (SnapWidget)
- Trainer profiles with bios and schedules
- Wellness journey tracking (visit history, streaks, personal records)
- Self-service membership upgrades/downgrades

### Employee Portal Features

- Clock in/out with geofencing verification
- Payroll tracking
- Tax documentation
- Part of the admin dashboard (Operations module), not a separate app

### Key Principle

The dashboard IS the entire backend of the business. The iOS app and website are frontends that consume the same database. Every feature — classes, merch, events, social, payments — flows through Meridian.

## What Makes Meridian Different from Glofox

1. **Group-class booking as primary model** — matches how studios actually operate. Individual resource booking available as secondary mode for other facility types.
2. **AI woven throughout** — Not a separate page. Contextual insights on Command Center, member profiles, analytics. Churn prediction, scheduling optimization, pricing recommendations. LLM + rules-based from day one.
3. **Direct Stripe** — Not Stripe Connect wrapper. Full dashboard access, standard rates.
4. **Proration** — Glofox explicitly says "not supported." Meridian uses Stripe's native proration.
5. **Trainer economy** — Promo codes with attribution, check-in-based bonus thresholds, per-class payroll. No competitor has this as first-class.
6. **Single account, multiple roles** — Solves the dual-role problem that plagues every competitor.
7. **Corporate & Events** — No existing platform does this well. Dedicated modules.
8. **Employee portal** — Clock in/out with geofencing, payroll, taxes. Full business OS, not just booking.
9. **Real-time** — Live facility status, streaming activity feed. 60-second polling Phase 1, WebSocket-ready Phase 2.
10. **Open API** — Day one, not gated behind premium tiers.

## Implementation Phases

> **Principle:** Complete the entire admin dashboard and employee web portal (Phases 1–4) before starting any member-facing, iOS, or customer-facing surfaces. Phase 5 requires separate design systems, UX planning, and documentation.

- **Phase 1 (Core Platform) ✅ COMPLETE:** Command Center, Schedule & Booking, Members, Revenue, Settings, Waitlists, Employee Portal (clock in/out), Smart Segments, Resend Email (with tracking), QR Check-in, 10 AI Features (Claude Sonnet 4.6)
- **Phase 2 (Marketing & Engagement):** Marketing module UI, campaign builder, automation flows, lead pipeline, SMS integration, content hub
- **Phase 3 (Analytics & Intelligence):** Custom analytics dashboards, AI insights module UI, advanced reporting, trainer performance dashboards, pricing simulator, Glofox data migration
- **Phase 4 (Corporate & Operations):** Corporate portal, event management, employee portal enhancements (payroll, taxes, geofencing), merch shipping, SaaS onboarding, API docs, admin polish
- **Phase 5 (Member-Facing & Mobile — Post-Dashboard):** Web Booking Portal, iOS Member App (React Native), iOS Employee App (React Native + Walk-In Kiosk), Landing Page (Astro), Community Board, Push Notifications

## Edge Case Policies

18 edge cases defined in `edge-case-policies.md`. Key decisions:
- Atomic insert for booking races (no hold pattern)
- Progressive strike system for late cancellations/no-shows (rolling 30-day window)
- Wallet-based gift card system (no split payments)
- Check-in-based trainer bonus threshold (not bookings)
- 7-day credit expiry grace period
- In-studio merch pickup first, shipping DB infrastructure built from day one
- Soft migration from Glofox in 5 waves

**All 18 edge cases fully decided.** Strike penalties: $5 (2nd), $10 (3rd). Unlimited members: warning-only. System-level and member-level toggles for the penalty system. Guest pass system with QR/link invite flow, conversion tracking, referral attribution.

## Conventions

- User prefers Apple-native design philosophy — powerful, intuitive, not boring
- Data/productivity color palette — not brand colors from The Sauna Guys
- AI should feel natural and contextual, not bolted on
- Every number should be clickable/drillable
- Command palette (Cmd+K) for power users
- Refer to the platform as "Meridian" in all documentation
- **Interface:** This project is managed through Claude Desktop (chat interface), NOT a code editor. When creating or updating key documents (audits, reviews, specs), always present the full content inline in the conversation so both parties can review and discuss it — don't just write to a file silently. Files are saved to the project folder for persistence, but the chat is the primary workspace.
