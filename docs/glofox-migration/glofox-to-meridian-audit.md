# Glofox → Meridian: Architecture Audit & Feature Migration Map

This document cross-references four data sources to create a complete picture of what Glofox does today, how it's structured, where it fails, and how Meridian should improve on every layer.

**Sources:**
1. `glofox-feature.md` — Deep feature audit from support docs, API docs, and reviews
2. `dashboard-research.md` — Market research across 15+ platforms, owner/member pain points
3. `Glofox Application Map` — Scraped navigation structure, UI elements, and page-level inventory
4. `Glofox Navigation Worklist (CSV)` — Detailed element-level data from live scrape

---

## 1. Glofox Navigation Architecture (Current State)

Glofox organizes its admin dashboard into 6 top-level sections with 26 total pages:

```
HOME (3 pages)
├── Dashboard .............. Overview widgets, metrics, quick actions
├── Calendar ............... Class schedule view, class CRUD
└── Access ................. Door access logs, date filtering

MANAGE (9 pages)
├── Clients ................ Member directory, filters, bulk actions
├── Classes ................ Class list, create/edit class
├── Courses ................ Multi-session programs
├── Facilities ............. Room/resource management
├── Trainers ............... Staff directory, roles
├── Appointments ........... 1:1 session types
├── Services ............... Memberships + credit packs + add-ons
├── Discounts .............. Promo codes, percentage/fixed discounts
└── Pay Rates .............. Trainer compensation rules

CONNECT (6 pages)
├── Campaigns .............. Email campaign list + basic composer
├── Automations ............ XLerate workflow toggles
├── Push Notifications ..... Push composer + delivery history
├── Audiences .............. Pre-built segments (6 fixed segments)
├── Lead Sources ........... Attribution tracking (view only, no create)
└── Tags ................... Client tagging system

REPORTS (8 pages)
├── Revenue
│   ├── Sales .............. Revenue breakdown, payment methods
│   ├── Payouts ............ Stripe payout tracking
│   ├── Failed Payments .... Overdue tracking
│   ├── Transactions ....... Transaction log with search
│   └── Scheduled .......... Projected revenue (next 31 days)
├── Membership ............. Member counts, churn, at-risk, movement
├── Performance ............ Trainer insights, class occupancy
└── Activity ............... First bookings report

CHECKOUT (1 page)
└── Cart ................... POS panel (panel, not full page)

SETTINGS (9 pages)
├── Studio ................. Business info, hours, timezone
├── Payments ............... Stripe Connect onboarding
├── Clients ................ Registration, credit expiry, notifications
├── Booking ................ Windows, limits, waitlist, penalties
├── Attendance Policy ...... 404 NOT FOUND (broken page)
├── Forms .................. Waivers, T&Cs, custom questions
├── Integrations ........... Mailchimp + ClassPass only
├── Tax .................... Tax rates, per-service application
└── Fees ................... NSF fees, maintenance fees
```

### Key Observations from the Scrape

**Dashboard is anemic:** Only 4 widgets — Class Bookings (184), Bookings vs Capacity (0%), Newest Signups list, Expiring Members list. No revenue data on the home page. No AI insights. No facility status. No real-time anything.

**Navigation is flat:** Everything lives at most 2 levels deep. No contextual navigation — you can't go from a member profile to their bookings to the class they booked without multiple page loads.

**Checkout is a sidebar panel, not a page:** The POS/checkout lives as an overlay panel accessible from the Dashboard, not as its own dedicated section. Filters: All, Clients, Memberships, Classes, Items.

**Attendance Policy page is literally a 404:** The scrape confirmed Settings > Attendance Policy returns a 404 Not Found. This is a shipping bug in their production app.

**Audiences are pre-built only:** 6 fixed segments (Active members, Expired trials, Failed payments, Former clients, Leads on trial, Low attendance). No custom segment builder visible in the scraped UI.

**Lead Sources is view-only:** No "Create" button found on the Lead Sources page. You can't add new sources from this page.

**Integrations page is sparse:** Only Mailchimp (API key + List ID) and ClassPass (email trigger) visible. The Zapier, Kisi, Trainerize, and other integrations documented in the feature audit aren't surfaced in the main integrations page.

---

## 2. Feature-by-Feature Comparison: Glofox → Meridian

### 2.1 HOME / DASHBOARD

| Capability | Glofox | Meridian |
|---|---|---|
| Revenue on home page | No | Yes — Revenue Today with sparkline + trend |
| AI-powered briefing | No | Yes — contextual insights with one-click actions |
| Live facility/resource status | No | Yes — real-time map with countdowns, utilization % |
| Today's schedule overview | Classes Today/Tomorrow list only | Full timeline with swimlanes, drag-to-book |
| Real-time activity feed | No | Yes — check-ins, bookings, payments streaming |
| Walk-in counter | No | Yes — Walk-ins Today metric |
| No-show tracking on home | No | Yes — No-Shows Today with trend |
| Quick actions | Book Client + Create Class | New Booking, Add Member, Create Campaign, Log Walk-in |
| Search | Text search only | Cmd+K command palette — search members, bookings, transactions, settings |
| Live occupancy | No | Yes — X/Y units occupied in real time |

**Verdict:** Glofox's dashboard is a static report page with 4 widgets. Meridian's Command Center is a live operations hub. Glofox gives you numbers from yesterday; Meridian tells you what to do right now.

---

### 2.2 SCHEDULING & BOOKING

**Important context:** The Sauna Guys operates a GROUP CLASS model (like yoga/Pilates), NOT individual resource reservations. Members book a time slot (5–6pm), not a specific sauna. The facility has 1 sauna (12-person capacity) and 6 cold plunges. Two class types: **Open Sauna / Free Flow** (self-directed, up to 12) and **Guided Classes** (instructor-led breathwork, typically 7–10). Individual resource booking should exist as a backend feature for future facilities that use that model, but group-class is the primary flow.

| Capability | Glofox | Meridian |
|---|---|---|
| Class scheduling | Day/Week/Month calendar, class CRUD | Class schedule with capacity bars, trainer assignment, real-time fill rates |
| Class types | One class type with categories | Open Sauna (self-directed) + Guided (instructor-led) + Individual Resource (future) |
| Capacity management | Fixed per class | Configurable per class type, visual capacity bars on calendar |
| Trainer assignment per class | Yes — multi-select trainers | Yes — single trainer per class + performance tracking, bonus thresholds |
| Trainer promo codes | No | Yes — unique code per trainer, attribution tracking, signup conversion |
| Trainer bonus thresholds | No | Yes — configurable per class type (e.g., 7+ members = bonus) |
| Walk-in mode | No dedicated view | Dedicated tablet-optimized kiosk — "which time slot?" flow |
| Waitlist | Classes only, basic | Per-class with auto-promotion + notification |
| Dynamic pricing | No | Peak/off-peak multipliers per time slot |
| Individual resource booking | Facility Rental — 1 client per slot, fixed duration | Supported as secondary mode for future facilities (variable durations, pooling, combined bookings, buffer times) |
| Recurring member bookings | Admin-only, 4-month max, not in app | Member-facing with conflict detection |
| Add-on services per booking | No | Yes — towels, aromatherapy, etc. with individual pricing |

**Verdict:** Glofox's class system works for the basic flow but lacks trainer performance tracking, promo code attribution, bonus thresholds, and the nuanced class-type differentiation (Open vs. Guided). Meridian's scheduling engine supports The Sauna Guys' group-class model as the primary flow while keeping individual resource booking available for future facilities.

---

### 2.3 MEMBER MANAGEMENT

| Capability | Glofox | Meridian |
|---|---|---|
| Profile fields | Basic: name, email, phone, gender, DOB, emergency contact | Same + session preferences (auto-detected), AI summary, visit heatmap |
| Custom fields | No — only "configurable questions" that go into Notes | Structured custom fields + behavioral auto-tracking |
| Tags | Early Access feature, basic | Full tagging with saved filter views |
| Smart segments | 6 pre-built only (Active, Expired trials, Failed payments, Former, Leads on trial, Low attendance) | Pre-built + custom segment builder with AND/OR logic + AI-suggested segments |
| Member AI insights | No | Per-member AI card: behavior patterns, churn risk, recommended actions |
| Visit heatmap | No | GitHub-style calendar showing visit frequency over 6 months |
| Session preferences | No | Auto-detected: preferred time, resource, add-ons, session duration |
| Family accounts | Parent manages child accounts, no shared credits | Parent account + shared credit pool + book for family from one account |
| Group memberships | Boost/Elite only, unlimited memberships only | Any membership type, flexible group composition |
| Churn risk scoring | "Members at Risk" report (Beta) | AI-powered churn prediction with ranked list and reasons |
| Lifetime value tracking | Not surfaced | Per-member LTV with trend |
| Bulk actions | Export CSV, bulk SMS (paid), bulk push | Export, Send Campaign, Tag, Assign to Segment |
| Profile edit restrictions | All-or-nothing lock | Granular per-field control |
| Check-in methods | 7 methods (manual, batch, kiosk, barcode, access control) | Same + streamlined kiosk mode with instant re-booking |

**Verdict:** Glofox has the data but doesn't do anything smart with it. Meridian layers AI on top of the same foundation to surface actionable insights per member.

---

### 2.4 MEMBERSHIPS, CREDITS & PRICING

| Capability | Glofox | Meridian |
|---|---|---|
| Membership types | Single, Recurring, Restricted, Trial, Roaming, Group, Consecutive | Same + cross-category credits, dynamic pricing tiers |
| Credit system | 3 categories (Class, Facility, Trainer), one category per credit line | Unified cross-category credits redeemable across all service types |
| Credit deduction priority | Yes — expiring soonest → specific → category → general | Same logic, replicated |
| Proration | Explicitly NOT supported | Full proration engine for mid-cycle changes |
| Self-service membership upgrades | No — requires contacting the studio | Yes — one-tap upgrade (6-class → 10-class → unlimited) with automatic proration |
| Dynamic pricing | No | Peak/off-peak, corporate rates, promo pricing |
| One active membership limit | Yes — one membership + multiple credit packs | Flexible — configurable per business |
| Membership pause | Recurring only, monthly increments for pro-rated | Any membership type, flexible pause periods |
| Gift cards | Not supported | Full gift card system — purchasable by anyone, redeemable for memberships, classes, or merch |
| Member discounts | No automatic tier-based discounts | Automatic 10–15% off merch/gift cards for active recurring members |
| Loyalty/rewards | Not native (requires Perkville/Loyalsnap) | Native rewards engine |
| Merchandise / inventory | Not supported | Full inventory management (SKUs, stock levels, member pricing), purchasable via iOS app, website, in-studio |
| Pricing simulator | No | "What-if" modeling: change price → see projected impact |
| Invoicing | Email receipts only (non-itemized) | Itemized invoices, PDF export, custom templates, corporate batching |

**Verdict:** Glofox's credit system is well-designed but artificially limited by category restrictions. The biggest day-to-day pain point is the inability for members to self-upgrade their membership tier. Meridian keeps the good parts (deduction priority logic), removes constraints, and adds merch/gift card revenue streams.

---

### 2.5 PAYMENTS & FINANCIAL

| Capability | Glofox | Meridian |
|---|---|---|
| Payment processor | Stripe Connect (wrapped as "Glofox Payments") — no direct Stripe dashboard | Direct Stripe integration — full dashboard access |
| Failed payment retries | 4 attempts (card), 1 retry (direct debit) | Configurable retry schedule |
| Dunning automation | No automated email sequence — manual filter + bulk SMS | Automated multi-step dunning: email → SMS → push escalation |
| Payment links | Yes — manual generation | Yes — auto-generated on failed payment |
| Refunds | Full and partial, 1-14 day processing | Same + automated credit refund on cancellation |
| Revenue on dashboard | No — only in Reports | Yes — Revenue Today on Command Center |
| Scheduled revenue forecast | Next 31 days only | 30/60/90 day AI-powered forecasting |
| Financial reports | Sales, Payouts, Failed Payments, Transactions, Scheduled | Same + ARPM, churn rate, net retention, revenue by dimension |
| Export formats | CSV only | CSV + PDF |
| Tax configuration | Single rate, tax-inclusive or tax-exclusive | Multi-rate, per-service tax rules |

---

### 2.6 MARKETING & COMMUNICATIONS

| Capability | Glofox | Meridian |
|---|---|---|
| Email campaigns | Basic composer (from scrape: Create Campaign button → modal with Close, Cancel, Preview disabled, Send disabled) | Drag-and-drop builder with templates, merge tags, AI copy generation |
| SMS | Paid add-on, 160 char = 1 credit | Built-in, phone mockup preview, character counting |
| Push notifications | Basic composer, send to everyone or filtered group | Rich media push with targeting |
| Multi-channel sequences | No — each channel is separate | Yes — Email → Wait → SMS → Wait → Push sequences |
| Automation workflows | XLerate (add-on) — pre-built workflow toggles, active/inactive | Visual flow builder with triggers, conditions, branching, stats per node |
| A/B testing | No | Subject line and content A/B testing |
| Send time optimization | No | AI-optimized: send to each member at their peak engagement time |
| Campaign analytics | Campaigns table shows Name + Sent at only | Open rate, click rate, conversions, revenue attribution |
| Audience segmentation | 6 fixed segments, no custom builder | Unlimited custom segments + AI-suggested segments |
| Lead scoring | No | AI-powered based on engagement signals |
| Lead pipeline | Lead → Trial → Client (3 stages) | Lead → Contacted → Trial → Converted/Lost (4 stages) |
| Content hub | Community section in app (one-way articles) | News feed + content library + social scheduler + review automation |
| In-app messaging | No real-time chat | Planned: staff-to-member messaging |

**Verdict:** Glofox's Connect section is surprisingly thin — the scrape confirms the campaign creator literally ships with Preview and Send buttons disabled in the modal. Meridian's marketing module is a full campaign engine.

---

### 2.7 REPORTING & ANALYTICS

| Capability | Glofox | Meridian |
|---|---|---|
| Report categories | Revenue (5), Membership (1), Performance (1), Activity (1) = 8 reports | Utilization, Members, Financial, Marketing, AI Lab + custom dashboard builder |
| Custom dashboards | No | Drag-and-drop widget builder, save and share |
| Utilization heatmap | No | Resource × Time heatmap showing occupancy % |
| Cohort retention | No | Monthly cohort retention curves |
| Revenue per member | Not standalone — only via Insights drilldown | ARPM as a hero metric |
| Revenue per resource | No | Per-resource revenue tracking |
| Churn prediction | "Members at Risk" Beta only | AI-ranked churn prediction with reasons and actions |
| AI recommendations | No | Schedule optimization, pricing suggestions, campaign ideas, seasonal predictions |
| Weather correlation | No | Booking volume vs. temperature/weather analysis |
| Export formats | CSV only (no PDF) | CSV + PDF + scheduled email reports |
| Real-time data | No — reports are retrospective | Live metrics on Command Center |
| Cross-sell analysis | No | "Members using A but never B" opportunity matrix |

**Verdict:** Glofox's 8 static CSV-export reports vs. Meridian's AI-powered analytics hub is the widest gap in the entire comparison. This is where the biggest competitive advantage lives.

---

### 2.8 OPERATIONS & SETTINGS

| Capability | Glofox | Meridian |
|---|---|---|
| Staff roles | 4 rigid tiers (Super Admin, Admin, Receptionist, Trainer) — dual roles need 2 accounts | **Single account, multiple roles** — one email can be admin + member, or trainer + member. Role-based permission sets with granular access. |
| Dual-role accounts | Not supported — owners/trainers who are also members need separate email accounts | Seamless — admin can view their own booking history, credits, membership without switching accounts |
| Profile exclusion from analytics | No | Toggle on profiles to exclude from revenue calculations, ARPM, churn — for comped members, former owners, etc. Still counted in headcount/capacity. |
| Trainer pay + bonuses | CSV export, max 1-month range, no totals | Base pay per class + configurable bonus thresholds + promo code attribution reports + automated totals |
| Payroll | CSV export only | Automated report generation with totals, tax-ready exports |
| Equipment/facility management | Basic CRUD (name, bookable toggle, public toggle) | Full registry with serial numbers, maintenance scheduling, IoT-ready logging |
| Multi-location | Independent instances per location, no settings inheritance | Shared or independent settings per location, centralized management |
| Waiver system | 5 contract types, e-signatures on Boost/Elite | Digital waiver builder + health screening + contraindication flags |
| Integrations page | Mailchimp + ClassPass only (from scrape) | Stripe direct, Apple Pay, Google Pay, door access, calendar sync, Zapier, open API |
| Authentication | Email + password only | SSO / Magic Link (passwordless for members), email + password for admin |
| Attendance Policy | 404 NOT FOUND (broken in production) | Fully functional attendance and cancellation policy engine |
| Business hours | No standalone setting | Configurable with holiday scheduling |

---

### 2.9 MODULES GLOFOX DOESN'T HAVE AT ALL

These are entirely new in Meridian with no Glofox equivalent:

| Module | Purpose |
|---|---|
| **Corporate Wellness Portal** | Company accounts, employee rosters, corporate invoicing, usage reports, admin dashboard for HR contacts |
| **Event Management** | Pop-up locations, ticket types, event-specific waivers, post-event analytics, attendee-to-member conversion |
| **Group/Party Booking** | Private suite buyouts, package builder, deposit scheduling, event coordinator assignment |
| **AI Lab** | Pricing recommendations, schedule optimization, seasonal pattern analysis, competitive intelligence |
| **Command Palette (Cmd+K)** | Universal search across all entities — members, bookings, transactions, settings |
| **Walk-in Kiosk Mode** | Dedicated tablet-optimized interface for front-desk check-ins |
| **Wellness Journey Tracking** | Session history, streak tracking, personal records (gamification) |
| **Pricing Simulator** | "What-if" modeling for membership/credit pack price changes |
| **Merchandise & Inventory** | Merch store management, SKUs, stock levels, multi-channel sales (app, website, in-studio), member discount pricing |
| **Gift Card System** | Purchase, redeem, balance tracking — redeemable for memberships, classes, or merch |
| **Community / Social Board** | Members-only feed — trainer posts, studio announcements, member interaction, Instagram feed integration |
| **Trainer Performance Analytics** | Promo code attribution, class fill rates per trainer, bonus threshold tracking, referral conversion |

---

## 3. Data Flow Improvements: Glofox → Meridian

### 3.1 Broken Flows in Glofox (from scrape analysis)

**Member → Booking → Payment is disconnected:**
In Glofox, booking a member requires navigating to the Calendar, finding a slot, searching for the member, then processing payment separately via the Checkout panel. In Meridian, this is a single modal flow from any context.

**Reports are siloed:**
Each report type lives on its own page with its own filters. You can't go from "Failed Payments" to the member's profile to their booking history without 3+ page navigations. Meridian makes every data point clickable and drillable.

**Dashboard doesn't link to actions:**
Glofox Dashboard shows "Newest Signups" and "Expiring Members" as lists, but the scrape shows no action buttons on these items — you have to navigate to the member manually. Meridian's AI briefing includes one-click action buttons.

**Campaigns are disconnected from segments:**
The Campaigns page and Audiences page are separate sections with no apparent deep linking between them. In Meridian, audience selection is embedded in the campaign creation flow.

**Settings are scattered:**
Booking windows, cancellation policies, waitlist rules, and strike systems are all under Settings > Booking in one long page with collapsible sections for Classes, Appointments, Facility Rental, and Courses. In Meridian, these settings are contextual to each resource type.

### 3.2 Page Consolidation Opportunities

| Glofox Pages | Meridian Consolidation | Rationale |
|---|---|---|
| Manage > Classes + Calendar > Calendar + Dashboard Classes Today | Schedule module (single calendar) | One place for all scheduling |
| Manage > Services (Memberships tab + Add-ons tab) | Revenue > Memberships & Pricing | Pricing belongs with revenue |
| Connect > Campaigns + Automations + Push + Audiences + Lead Sources + Tags | Marketing module (unified) | All outreach in one place |
| Reports > Revenue (5 pages) + Membership + Performance + Activity | Analytics module (unified with tabs) | One analytics hub, not 8 separate pages |
| Manage > Facilities + Dashboard facility status | Schedule > Resources (sub-page) + Command Center facility map | Resources managed in Schedule, monitored on home |
| Settings > Booking + Settings > Attendance Policy | Operations > Settings > Booking Rules | One rules engine |
| Manage > Pay Rates + Payroll CSV export | Operations > Staff > Payroll | Staff management unified |

**Result:** Glofox's 26 pages across 6 sections → Meridian's ~20 pages across 8 sections, but with dramatically deeper functionality per page and better cross-linking between them.

### 3.3 Data That Should Flow Differently

**Member activity → AI insights → Action buttons:**
In Glofox, member activity is logged but never analyzed. In Meridian, every behavioral signal feeds the AI engine which surfaces recommendations on the Command Center and individual member profiles.

**Booking patterns → Schedule optimization:**
Glofox tracks bookings but doesn't analyze patterns. Meridian uses utilization data to recommend adding/removing time slots, adjusting pricing, and forecasting demand.

**Failed payments → Dunning sequences:**
Glofox flags overdue members but has no automated recovery flow. Meridian auto-triggers escalating dunning sequences with configurable timing.

**Campaign sends → Revenue attribution:**
Glofox shows "Sent at" date on campaigns but no conversion tracking. Meridian tracks opens → clicks → bookings → revenue per campaign.

**Credit usage → Cross-sell opportunities:**
Glofox deducts credits but doesn't analyze usage patterns. Meridian identifies members who use one service but never try another, then suggests cross-sell campaigns.

**Trainer promo code → Signup → Attribution → Bonus calculation:**
New flow that doesn't exist in Glofox at all. Trainer shares code → member uses code to buy membership/pack → system tracks attribution → class attendance triggers bonus threshold check → payroll reflects both base pay and earned bonuses.

**Membership status → Member discount activation:**
When a member starts a recurring membership, their account automatically gets 10–15% discount on merch and gift cards. When membership lapses, discount deactivates. No manual toggling.

**Private event request → Review → Booking → Payment:**
Member submits request via iOS app/website → dashboard shows in Corporate > Events as pending → staff reviews, sets pricing, confirms → member receives confirmation + payment link → event appears on schedule.

**Merch purchase (multi-channel) → Inventory sync:**
Member buys merch via iOS app, website, or in-studio POS → inventory decrements across all channels → low-stock alerts surface on Command Center → reorder recommendations in AI insights.

---

## 4. Meridian Navigation Architecture (Proposed)

```
COMMAND CENTER (1 page)
└── Home Dashboard ......... AI briefing, live metrics, class status board, today's schedule, activity feed

SCHEDULE (4 pages)
├── Calendar ............... Class schedule with capacity bars + optional resource swimlane view
├── Walk-in Mode ........... Tablet-optimized kiosk — "which time slot?" flow
├── Waitlists .............. Per-class waitlist management with auto-promotion
└── Resources .............. Equipment registry, maintenance, class type configuration

MEMBERS (3 pages)
├── Directory .............. Searchable/filterable member list with smart columns
├── Segments ............... Custom + AI-suggested audience segments
└── Family Accounts ........ Parent/child management, shared credits

REVENUE (7 pages)
├── Overview ............... MRR, total revenue, ARPM, churn, retention metrics
├── Transactions ........... Real-time transaction log with full filtering
├── Memberships & Pricing .. Plans, credit packs, self-service upgrades, pricing simulator, dynamic pricing
├── Failed Payments ........ Dunning dashboard with aging, recovery automation
├── Invoicing .............. Itemized invoices, templates, corporate batching
├── Commerce ............... Merch inventory, SKUs, stock levels, multi-channel sales, member discount pricing
└── Gift Cards ............. Purchase, balance tracking, redemption history

MARKETING (5 pages)
├── Campaigns .............. Multi-channel campaign builder with AI assist
├── Automations ............ Visual flow builder with triggers, conditions, branching
├── Leads .................. Pipeline management, scoring, source tracking
├── Content ................ News feed, content library, social scheduler
└── Community .............. Members-only social board moderation, Instagram feed config

CORPORATE (3 pages)
├── Accounts ............... Company profiles, employee rosters, contracts
├── Events ................. Event creation, pop-up locations, ticket management, private event requests
└── Group Bookings ......... Private buyouts, packages, deposit scheduling

OPERATIONS (4 pages)
├── Staff .................. Directory, roles, permissions, payroll, trainer promo codes, bonus thresholds
├── Facilities ............. Equipment status, maintenance, supply inventory
├── Waivers ................ Digital waivers, health screening, document archive
└── Settings ............... Business profile, locations, booking rules, integrations, tax, auth config

ANALYTICS (3 pages)
├── Dashboards ............. Custom dashboard builder with drag-and-drop widgets
├── AI Insights ............ Recommendations engine, pattern detection, forecasting
└── Reports ................ Pre-built report templates with PDF/CSV export + Trainer Performance

TOTAL: 30 pages across 8 sections
```

---

## 5. Priority Implementation Order

### Phase 1 — Core Operating System (MVP)
1. Command Center with live metrics (no AI yet — add static insights first)
2. Schedule & Booking Engine with resource swimlanes
3. Member Directory with profiles
4. Revenue Overview + Transactions
5. Memberships & Credit Pack management
6. Settings (business profile, booking rules, Stripe integration)

### Phase 2 — Engagement Layer
7. Walk-in / Kiosk Mode
8. Marketing Campaigns (email first, then SMS/push)
9. Lead Management
10. Automations (start with 5 pre-built workflows)
11. Waitlist system

### Phase 3 — Intelligence Layer
12. Analytics dashboards with utilization heatmap
13. AI Insights engine (churn prediction, scheduling recommendations)
14. Member AI summaries on profiles
15. AI briefing on Command Center
16. Pricing simulator

### Phase 4 — Growth Modules
17. Corporate Wellness Portal
18. Event Management
19. Group/Party Booking
20. Mobile Member App
21. Advanced reporting + PDF export

---

## 6. Key Architectural Decisions

1. **Group-class booking as primary model** — time-slot based (like yoga/Pilates) with capacity management. Individual resource booking exists as a secondary mode for future facilities.
2. **Direct Stripe + Apple Pay + Google Pay** — not Stripe Connect wrapper. Full dashboard access, standard rates, modern payment methods.
3. **Single account, multiple roles** — one email address can be admin + member, or trainer + member. No more duplicate accounts.
4. **AI woven throughout** — not a separate "AI page" but contextual insights on every relevant screen
5. **Self-service membership management** — members upgrade, pause, cancel without contacting the studio
6. **Trainer economy built in** — promo codes, performance bonuses, attribution tracking, public profiles
7. **Commerce-ready** — merch inventory, gift cards, member discounts as first-class revenue streams
8. **Open API from day one** — not gated behind premium tiers
9. **Real-time by default** — WebSocket connections for live class status, booking updates, payment events
10. **Every number is drillable** — click any metric to see the underlying data
11. **Command palette (Cmd+K)** — power user navigation that searches everything
12. **Profile analytics exclusion** — flag comped/internal accounts to keep financial metrics clean
13. **Mobile-responsive admin** — admin experience works on tablet at the front desk
14. **Community layer** — members-only social board, Instagram integration, trainer content — all moderated from the Marketing module
15. **Passwordless auth for members** — Magic Link / SSO, no passwords to remember
