# Fitness Studio OS — UI Architecture & Tool Prompts

## Design Philosophy

**Design DNA:** Linear meets Apple Health meets Stripe Dashboard. Clean, confident, information-dense without feeling cluttered. Every screen earns its existence by surfacing something actionable.

**Color System:**
- Primary: Deep indigo (`#4F46E5`) — conveys trust, intelligence, depth
- Secondary: Warm amber (`#F59E0B`) — energy, urgency, action items
- Success: Emerald (`#10B981`)
- Warning: Soft coral (`#F97316`)
- Surfaces: Near-white (`#FAFAFA`) with subtle warm gray cards (`#F5F5F4`)
- Dark mode primary surface: `#0F0F11` with `#1A1A1F` cards
- Text: `#111827` primary, `#6B7280` secondary
- Accent gradients: Indigo-to-violet for AI-generated insights, subtle and purposeful

**Typography:** Inter or SF Pro — clean, modern, excellent at small sizes for data-dense layouts.

**Key Principles:**
1. AI insights are woven in, not bolted on — they appear contextually as gentle nudges, not a separate "AI page"
2. Every number is clickable — drill down into anything
3. Real-time by default — no refresh buttons, no stale data
4. Command palette (Cmd+K) for power users — search anything, do anything
5. Contextual actions — right-click menus, hover states that reveal controls
6. Minimal chrome — content takes center stage, navigation recedes

---

## Module Architecture (8 Core Modules)

### 1. Command Center (Home Dashboard)
### 2. Schedule & Booking Engine
### 3. Member Intelligence
### 4. Revenue Hub
### 5. Marketing & Campaigns
### 6. Corporate & Events
### 7. Operations
### 8. Analytics & AI Lab

---

## Detailed Feature Maps Per Module

### 1. COMMAND CENTER (Home Dashboard)

The nerve center. Opens every morning to tell you exactly what matters today.

**Top Bar:**
- Global search (Cmd+K) — searches members, bookings, transactions, settings
- Notification bell with categorized alerts (payments, bookings, AI insights)
- Quick actions dropdown: New booking, Add member, Create campaign, Log walk-in
- Date/time with today's weather (relevant for outdoor pop-ups)
- User avatar with role indicator

**AI Briefing Card (hero position):**
- "Good morning, Zach. Here's what matters today:"
- 3-5 bullet AI insights pulled from overnight data: "Barrel Sauna #2 has been at 94% utilization this week — consider adding a 9pm slot" / "12 members haven't booked in 14+ days — churn risk campaign ready to send" / "Corporate account Tampa Tech is 3 bookings from their monthly cap — upsell opportunity"
- Each insight has a one-click action button (Add slot, Send campaign, Contact account)
- Dismissible, learns from what you act on vs. ignore

**Today's Operations Strip:**
- Horizontal scrolling cards: Total bookings today, Current occupancy (live), Revenue today vs. same day last week, Walk-ins today, No-shows today
- Each card sparkline showing trend

**Live Facility Map:**
- Visual grid/map of all equipment (Barrel Sauna 1-4, Cold Plunge A-B, Contrast Suite, Compression Boots 1-2)
- Color-coded: Available (green), Occupied (indigo), Cleaning/turnover (amber), Maintenance (red)
- Click any unit → see current session details, next booking, daily utilization %
- Shows real-time countdown timers on occupied units

**Today's Schedule Timeline:**
- Horizontal timeline (6am-10pm) showing all bookings across all resources
- Swimlanes per resource type
- Drag to create new booking, click to view/edit
- Walk-in overlay — one click to check someone in
- Color intensity shows utilization density

**Quick Stats Row:**
- Active members (with trend arrow), Monthly recurring revenue, Average sessions/member this month, Net Promoter Score (if collected), Credit packs expiring this week

**Recent Activity Feed:**
- Real-time stream: new bookings, cancellations, payments received, failed payments, new member signups, check-ins
- Filterable by type
- Each item links to the relevant record

---

### 2. SCHEDULE & BOOKING ENGINE

The resource-aware booking system that Glofox can't do.

**Calendar View:**
- Day / Week / Month toggles
- Resource swimlane view (each piece of equipment gets a row)
- Category filters: Sauna, Cold Plunge, Contrast, Recovery Add-ons, All
- Click-and-drag to create a booking
- Hover on a slot shows: member name, booking type, credits used, any add-ons, check-in status

**Booking Creation Modal:**
- Member search (autocomplete with photo + membership status badge)
- Resource selection with real-time availability
- Duration picker (30min / 45min / 60min / 90min — variable per resource, not fixed like Glofox)
- Add-on services (towel, aromatherapy, compression boots) with individual pricing
- Combined booking flow: "Add another resource" to chain Sauna → Cold Plunge → Compression in one transaction
- Automatic buffer/cleaning time insertion between bookings (configurable per resource type)
- Credit deduction preview: "This will use 2 credits (1 sauna + 1 cold plunge). Member has 8 remaining."
- Payment summary if credits insufficient
- Recurring booking option with conflict detection

**Waitlist Panel:**
- Per-resource waitlist with position numbers
- Auto-promotion when slot opens (configurable: auto-book or notify-first)
- Waitlist analytics: average wait time, conversion rate, most waitlisted slots

**Walk-in Mode:**
- Simplified check-in screen optimized for front-desk tablet/kiosk
- Large member search with recent visitors
- Real-time availability at a glance
- One-tap check-in for members with active credits
- Quick-sell credit pack or day pass for new walk-ins

**Capacity & Availability Settings:**
- Per-resource: total slots, online-bookable vs. walk-in reserved split
- Cleaning/turnover time between sessions (auto-blocked in calendar)
- Peak/off-peak time definitions
- Dynamic pricing rules (peak sessions cost more credits or higher drop-in price)
- Booking window (how far in advance) and cancellation window (how late)
- No-show penalties: strike system + optional monetary fee

**Resource Management:**
- Equipment registry with status tracking (Active, Maintenance, Retired)
- Maintenance scheduling with calendar integration
- Temperature/usage logs per unit (prep for IoT integration)
- Utilization reporting per resource

---

### 3. MEMBER INTELLIGENCE

Members aren't rows in a spreadsheet. They're people with patterns.

**Member Directory:**
- Searchable, filterable table with smart columns
- Photo, name, membership type (badge), status (Active/Paused/At Risk/Churned), last visit, total visits, lifetime revenue, credits remaining
- Quick filters: Active, At Risk (AI-flagged), New (last 30 days), Expiring Soon, Overdue
- Bulk actions: Send campaign, Export, Tag, Assign to segment
- Saved filter views (like Linear's saved views)

**Member Profile (Full Page):**
- **Header:** Photo, name, membership badge, member since date, lifetime value, NPS score
- **AI Summary Card:** "Sarah visits 3x/week, prefers morning slots, always books Barrel Sauna #1. Her usage dropped 40% this month — she may be at churn risk. Last contacted: never."
- **Tabs:**
  - **Overview:** Current membership details, credit balance with expiry dates, upcoming bookings, recent activity timeline
  - **Visit History:** Calendar heatmap (GitHub-style) showing visit frequency, list view with session details (which resource, duration, add-ons)
  - **Financials:** All transactions, payment method on file, failed payment history, lifetime revenue chart, average spend per visit
  - **Session Preferences:** Preferred resources, typical time slots, average session duration, favorite add-ons (all auto-tracked)
  - **Communications:** Email/SMS/push history, campaign engagement (opens, clicks), notes from staff
  - **Waivers & Forms:** Signed documents, health screening status, custom form responses

**Smart Segments (AI-Powered):**
- Pre-built: Power Users (8+ visits/month), At Risk (declining frequency), New & Engaged (signed up recently, booking regularly), Dormant (no visit 30+ days), High Value (top 20% revenue), Corporate Members
- Custom segment builder with AND/OR logic on any field
- AI-suggested segments: "You have 23 members who only use cold plunge but never try sauna — consider a cross-sell campaign"
- Segment size tracking over time

**Family & Group Accounts:**
- Parent account manages family members
- Shared credit pool option
- Single billing, multiple profiles
- Book for family members from one account

---

### 4. REVENUE HUB

Every dollar, tracked, visualized, and contextualized.

**Revenue Dashboard:**
- **Hero metrics:** MRR (monthly recurring revenue), Total revenue this month, Average revenue per member (ARPM), Churn rate (revenue), Net revenue retention
- **Revenue chart:** Stacked area chart — subscriptions vs. credit packs vs. drop-ins vs. add-ons vs. retail vs. corporate
- **AI Insight:** "Your ARPM increased 12% since introducing compression boot add-ons. Members who use add-ons have 34% lower churn."
- Period comparison toggles (vs. last month, vs. same month last year)

**Transactions Feed:**
- Real-time transaction log with filters (type, status, amount range, date range, member, payment method)
- Status badges: Completed, Pending, Failed, Refunded, Disputed
- Click any transaction for full details + linked member profile
- Export to CSV with all fields

**Memberships & Pricing:**
- All membership plans with active count, MRR contribution, churn rate per plan
- Credit pack catalog with purchase volume, usage rate, expiry rate
- Pricing simulator: "What happens to revenue if we increase the 10-pack from $199 to $219?" — AI models the impact based on historical price sensitivity
- Dynamic pricing rules: Peak/off-peak multipliers, corporate rates, promotional pricing
- Proration engine for mid-cycle upgrades/downgrades (what Glofox explicitly can't do)

**Failed Payments & Dunning:**
- Outstanding balance dashboard with aging (1-7 days, 8-14 days, 15-30 days, 30+)
- Automated dunning sequences: configurable retry schedule + escalating email/SMS sequence
- One-click payment link generation
- Write-off tracking
- Recovery rate metrics

**Stripe Integration Panel:**
- Direct Stripe dashboard embed or deep link
- Payout schedule and history
- Processing fee breakdown
- Dispute management

**Invoicing:**
- Itemized invoice generation (Glofox only does receipts)
- Customizable templates
- PDF export
- Corporate invoice batching (monthly statement for corporate accounts)

---

### 5. MARKETING & CAMPAIGNS

Not a bolt-on. A full campaign engine built for studio operators.

**Campaign Builder:**
- Drag-and-drop email builder with studio-branded templates
- SMS campaign creation with character count and credit estimation
- Push notification composer with rich media
- Multi-channel sequences: Email → wait 2 days → SMS → wait 1 day → Push
- Audience targeting using any saved segment or custom filter
- Send time optimization (AI picks the best time based on member engagement patterns)
- A/B testing for subject lines and content

**Pre-Built Automations (like XLerate but better):**
- Welcome sequence (new member)
- Churn prevention (declining visit frequency)
- Win-back (dormant 30/60/90 days)
- Birthday / anniversary
- Membership expiring soon
- Failed payment recovery
- Post-visit feedback request
- Referral program nudge
- Credit pack running low
- Milestone celebration (50th visit, 1-year anniversary)
- Corporate account check-in
- Each automation has a visual flow builder showing triggers, delays, conditions, and actions

**Lead Management:**
- Lead capture form builder (embeddable)
- Lead pipeline: New → Contacted → Trial → Converted / Lost
- Source tracking: Instagram, Google, Walk-in, Referral, Corporate, Event
- Lead scoring (AI): engagement with emails, website visits, social interactions
- Automated follow-up sequences per lead source
- Trial-to-member conversion tracking with attribution

**Content Hub:**
- News feed / community content (pushes to member app)
- On-demand content library (wellness tips, session guides)
- Social media post scheduler (connect Instagram, Facebook)
- Review request automation (push to Google Reviews after positive visits)

**Campaign Analytics:**
- Open rates, click rates, conversion rates per campaign
- Revenue attributed to campaigns
- Best performing segments
- Channel comparison (email vs. SMS vs. push effectiveness)
- Unsubscribe tracking and list health

---

### 6. CORPORATE & EVENTS

The modules no existing platform does well.

**Corporate Wellness Portal:**
- Company account management: company name, admin contact, billing address, contract terms
- Employee roster management (admin adds/removes employees)
- Per-company pricing tiers and credit allocations
- Monthly usage reports per company (auto-generated, PDF-exportable)
- Corporate invoicing: monthly consolidated billing
- Admin dashboard for corporate contacts: let them see their team's usage
- Upsell tracking: when a company approaches their usage cap, trigger notification

**Event Management:**
- Event creation: name, date, location (permanent or pop-up address), capacity, pricing, description, images
- Pop-up location support: temporary locations with their own schedule, capacity, and map pin
- Ticket types: General admission, VIP, group packages, corporate tables
- Event-specific waivers
- Check-in management for events
- Post-event analytics: attendance, revenue, new leads captured, conversion to membership
- Event promotion: generate shareable links, social media assets, email campaigns

**Group & Party Booking:**
- Private suite buyout flow
- Package builder: select resources + duration + add-ons + headcount
- Custom pricing for group sizes
- Event coordinator assignment
- Deposit + balance payment scheduling
- Post-event follow-up automation (convert attendees to members)

---

### 7. OPERATIONS

The back-office that runs itself.

**Staff Management:**
- Staff directory with roles and permissions (granular, not Glofox's rigid 4-tier)
- Custom permission sets: create roles like "Senior Front Desk" with specific access
- Staff scheduling: shifts, availability, time-off requests
- Per-staff performance metrics: check-ins processed, bookings managed, upsells

**Payroll & Compensation:**
- Shift tracking with clock-in/clock-out
- Pay rate configuration: hourly, per-session, commission-based
- Automated payroll report generation (not Glofox's manual CSV)
- Bonus tracking: session bonuses, upsell commissions, referral bonuses
- Tax-ready export formats

**Facility & Equipment:**
- Equipment registry: name, type, serial number, installation date, maintenance schedule
- Maintenance task management with due dates and assignments
- Temperature and usage logging (manual now, IoT-ready for future)
- Cleaning schedule automation (tied to booking turnover times)
- Supply inventory tracking (towels, aromatherapy oils, etc.)

**Waiver & Compliance:**
- Digital waiver builder with e-signature
- Health screening questionnaire with contraindication flags
- Signed document archive with search
- Expiry-based re-signing requirements
- GDPR/privacy compliance tools: data export, deletion requests

**Settings:**
- Business profile and branding
- Location management (multi-location with shared or independent settings)
- Notification preferences (what triggers emails, SMS, push)
- Integration management (Stripe, door access, calendar sync, Zapier, API keys)
- Booking rules engine (all the capacity, window, cancellation settings)
- Tax configuration (multi-rate, per-service)

---

### 8. ANALYTICS & AI LAB

Where data becomes decisions.

**Dashboard Builder:**
- Drag-and-drop widget placement
- Widget types: KPI card, line chart, bar chart, pie chart, table, heatmap, funnel, cohort grid
- Save custom dashboards, share with team members
- Auto-refresh intervals

**Pre-Built Analytics Views:**

**Utilization Analytics:**
- Resource utilization heatmap: hour-of-day × day-of-week matrix showing occupancy %
- Per-resource utilization trends
- Peak vs. off-peak analysis
- Optimal scheduling recommendations: "Your 2pm-4pm Tuesday slots are 23% utilized. Consider reducing availability or running a promo."

**Member Analytics:**
- Cohort retention curves (month-over-month)
- Visit frequency distribution
- Session preference trends (which resources are gaining/losing popularity)
- Churn prediction model: ranked list of members most likely to churn with reasons
- Lifetime value analysis by acquisition source
- Cross-sell opportunity matrix: members using service A but never service B

**Financial Analytics:**
- Revenue breakdown by every dimension (service type, resource, time period, membership type, acquisition channel)
- Credit pack economics: purchase rate, usage rate, expiry rate, effective discount given
- Price elasticity analysis: how booking volume responds to pricing changes
- Forecasting: projected revenue next 30/60/90 days based on active memberships + booking trends

**Marketing Analytics:**
- Campaign attribution: which campaigns drove bookings and revenue
- Channel ROI comparison
- Lead source quality: which sources produce highest-LTV members
- Conversion funnel with drop-off analysis

**Seasonal & Pattern Analysis (AI):**
- Year-over-year seasonal patterns with overlay visualization
- Weather correlation analysis (bookings vs. temperature/rain)
- Event impact analysis (how did a pop-up event affect subsequent bookings?)
- Competitive intel: if connected to web/app analytics, track when members visit competitor sites

**AI Recommendations Engine:**
- Pricing recommendations based on demand patterns and price sensitivity
- Schedule optimization: suggest adding/removing time slots based on utilization
- Campaign suggestions: auto-generate campaign ideas based on member behavior patterns
- Inventory alerts: predict when supplies will run low based on booking volume
- Staffing suggestions: recommend shift adjustments based on booking density

---

## Navigation Structure

**Left Sidebar (collapsible):**
```
[Logo]
[Command Palette Search — Cmd+K]

Dashboard (Command Center)
Schedule
  └─ Calendar
  └─ Walk-in Mode
  └─ Waitlists
  └─ Resources
Members
  └─ Directory
  └─ Segments
  └─ Family Accounts
Revenue
  └─ Overview
  └─ Transactions
  └─ Memberships & Pricing
  └─ Failed Payments
  └─ Invoicing
Marketing
  └─ Campaigns
  └─ Automations
  └─ Leads
  └─ Content
Corporate
  └─ Accounts
  └─ Events
  └─ Group Bookings
Operations
  └─ Staff
  └─ Facilities
  └─ Waivers
  └─ Settings
Analytics
  └─ Dashboards
  └─ AI Insights
  └─ Reports

[User Avatar]
[Dark Mode Toggle]
[Help / Support]
```

---

## User Flow: Key Journeys

### Morning Open Flow
1. Manager opens app → Command Center loads
2. AI briefing highlights: 2 failed payments to chase, a maintenance alert on Cold Plunge B, and a corporate upsell opportunity
3. One-click actions taken on each
4. Scan today's schedule timeline for gaps → drag-create a promo slot
5. Check live facility map → all units green, ready for first bookings

### New Member Signup Flow
1. Walk-in arrives → Staff opens Walk-in Mode
2. Quick search confirms no existing profile → "Create Member"
3. Name, email, phone captured → digital waiver presented on tablet
4. Waiver signed → health screening questions answered
5. Credit pack or membership selected → Stripe payment processed
6. Member checked in → session booked on available resource
7. Welcome email auto-sends → lead status auto-updates to Active Member

### Churn Prevention Flow (AI-Triggered)
1. AI detects member visit frequency dropped 50% over 2 weeks
2. Member flagged as "At Risk" in directory
3. AI briefing suggests: "Send a personal check-in to Sarah — she went from 3x/week to 1x. Offering a complimentary add-on might re-engage her."
4. Staff clicks action → pre-drafted personalized email opens
5. Staff reviews, adjusts, sends
6. System tracks: did Sarah book again within 7 days?

### Corporate Account Management Flow
1. New corporate inquiry → Lead created with "Corporate" source
2. Proposal sent with package options (self-serve or staff-assisted)
3. Contract signed → Corporate account created
4. HR admin given portal access → adds employee roster
5. Employees book using corporate credits
6. Monthly usage report auto-generates → corporate invoice sent
7. When 80% of credits used → upsell notification to account manager

---

## Prompts for UI Builder Tools

Below are the prompts designed to test MagicPath and Stitch UI. Each prompt is self-contained and focuses on a specific screen or flow. They're ordered by priority — start with Prompt 1 and work through them.

---

### PROMPT 1: Command Center (Home Dashboard)

```
Design a premium SaaS dashboard called "Meridian" — the command center for a fitness and wellness studio management platform. This is the home screen that studio operators see every morning.

DESIGN LANGUAGE:
- Inspired by Linear, Raycast, and Apple's design philosophy
- Color palette: Deep indigo (#4F46E5) as primary, warm amber (#F59E0B) for action items and alerts, emerald (#10B981) for success states, soft coral (#F97316) for warnings
- Background: Near-white (#FAFAFA) with subtle warm gray cards (#F5F5F4), or offer a dark mode version with #0F0F11 background and #1A1A1F cards
- Typography: Inter or SF Pro, clean hierarchy — large bold metrics, medium weight labels, light secondary text
- Generous whitespace, subtle shadows, micro-interactions implied through design (hover states, transitions)
- No gradients except a very subtle indigo-to-violet on AI insight cards to distinguish them

LAYOUT:
Left sidebar navigation (220px, collapsible):
- Logo mark at top
- Search bar with "Cmd+K" hint
- Navigation sections: Dashboard (active/highlighted), Schedule, Members, Revenue, Marketing, Corporate, Operations, Analytics
- User avatar at bottom with dark mode toggle
- Active item has a subtle indigo left border accent

Main content area:

ROW 1 — AI Briefing Card (full width):
A card with a subtle indigo-to-violet gradient border (1px). Inside: "Good morning, Zach" heading. Below it, 3 AI insight bullets each with an icon, insight text, and a small action button:
- Insight 1 (chart-up icon): "Barrel Sauna #2 hit 94% utilization this week — consider adding a 9pm slot" → [Add Slot] button
- Insight 2 (alert icon): "12 members haven't booked in 14+ days — churn risk campaign ready" → [Send Campaign] button
- Insight 3 (briefcase icon): "Tampa Tech is 3 bookings from their monthly cap" → [Contact Account] button

ROW 2 — Today's Metrics Strip (5 cards in a horizontal row):
Each card shows: metric name (small caps, secondary color), large bold number, small sparkline chart, and a percentage change badge (green up or red down). Metrics: "Bookings Today: 34" / "Live Occupancy: 6/8" / "Revenue Today: $2,847" / "Walk-ins: 7" / "No-Shows: 1"

ROW 3 — Two-column layout:

LEFT COLUMN (60%) — Live Facility Map:
A visual grid showing 8 equipment units arranged in a 2x4 or spatial layout. Each unit is a rounded rectangle showing:
- Unit name (e.g., "Barrel Sauna 1")
- Status indicator: green dot = Available, indigo dot = Occupied (with member first name and countdown timer "23:41 remaining"), amber dot = Cleaning, red dot = Maintenance
- Small utilization percentage for today
The occupied units should show a subtle pulse animation indicator in the design

RIGHT COLUMN (40%) — Today's Schedule:
A compact vertical timeline from 8am to 8pm showing booking blocks as colored bars. Each bar shows member name and resource. Dense but readable. A "+" button at each empty slot to quick-add a booking. Current time indicated with a horizontal line marker.

ROW 4 — Activity Feed:
A compact scrolling list showing real-time events: "Sarah M. checked in — Barrel Sauna 3" / "New booking: James K. — Cold Plunge A, 2:30pm" / "Payment received: $199 — Mike T. (10-Pack Credits)" / "⚠️ Failed payment: Lisa R. — Monthly Membership ($89)"
Each entry has a timestamp, an icon by type, and is clickable.

IMPORTANT DETAILS:
- The dashboard should feel alive — not a static report page
- Information density should be high but not overwhelming
- Every number should look clickable (subtle hover state implied)
- The AI briefing card should feel special/elevated compared to other cards
- Overall feeling: sophisticated, confident, you're in control
```

---

### PROMPT 2: Schedule & Booking Calendar

```
Design the scheduling and booking calendar view for "Meridian" — a premium fitness studio management platform. This is the resource-aware booking engine that shows all equipment availability and bookings.

DESIGN LANGUAGE:
- Same system as previous: Deep indigo (#4F46E5) primary, amber (#F59E0B) alerts, emerald (#10B981) available, coral (#F97316) warnings
- Clean, minimal chrome — the calendar content is the star
- Inter or SF Pro typography

LAYOUT:

TOP BAR:
- Left: "Schedule" page title with breadcrumb
- Center: Day | Week | Month view toggle (pill-style selector, Week active by default)
- Right: Filter chips for resource types (All, Sauna, Cold Plunge, Contrast, Recovery — toggleable), Date picker, "+ New Booking" primary button

MAIN CALENDAR (Week View — Resource Swimlane Layout):
- Y-axis: Resource names as row headers (left-pinned column, ~180px wide). Show each piece of equipment:
  - Barrel Sauna 1 (with small green/red status dot)
  - Barrel Sauna 2
  - Barrel Sauna 3
  - Barrel Sauna 4
  - Cold Plunge A
  - Cold Plunge B
  - Contrast Suite
  - Compression Boots 1
  - Compression Boots 2
- X-axis: Time slots across the top (7am to 9pm in 30-minute increments)
- Grid cells: Light gray gridlines, very subtle

BOOKING BLOCKS on the calendar:
- Each booking is a rounded rectangle spanning its duration
- Color-coded by type: Indigo for sauna bookings, blue (#3B82F6) for cold plunge, violet (#8B5CF6) for contrast, teal (#14B8A6) for recovery
- Each block shows: Member first name + last initial, duration badge, and a small icon if it has add-ons
- Buffer/cleaning time blocks between bookings shown as thin amber-striped blocks (5-15 min)
- Empty slots are white/very light gray — visually inviting to click
- Current time shown as a thin red vertical line across all swimlanes

HOVER STATE (show on one booking block as an example):
When hovering a booking, show a floating card with: Full member name, Booking type, Time, Duration, Credits used, Add-ons (if any), Check-in status, and quick action buttons: [Check In] [Edit] [Cancel]

RIGHT SIDEBAR (collapsible, ~320px):
Shows details of whatever's selected. Default state shows "Today's Summary":
- Total bookings today by resource type (small bar chart)
- Utilization % per resource (horizontal progress bars)
- Upcoming next 3 bookings with member names and times
- Walk-in availability count per resource right now
- Quick links: "Walk-in Mode" and "Manage Waitlists"

BOTTOM BAR or floating element:
A subtle status bar showing: "Live: 4 of 8 resources occupied | 23 bookings today | 3 on waitlist"

DESIGN DETAILS:
- The calendar should feel like Google Calendar meets Linear meets a professional trading terminal
- Resource rows should have alternating very subtle backgrounds for readability
- Booking blocks should have a slight left-border accent in a darker shade of their color
- The overall feel should be: I can see everything at once, I know exactly what's happening, and I can act immediately
```

---

### PROMPT 3: Member Profile Deep Dive

```
Design a comprehensive member profile page for "Meridian" — a premium fitness studio management platform. This page shows everything about a single member, with AI-powered insights.

DESIGN LANGUAGE:
- Deep indigo (#4F46E5) primary, warm amber (#F59E0B) for action items, emerald (#10B981) for positive metrics, coral (#F97316) for concerns
- Clean, spacious layout — this is a page you spend time on
- Inter or SF Pro typography
- Subtle card-based sections with thin borders, no heavy shadows

LAYOUT:

HEADER SECTION (full width, compact):
- Left: Large circular member photo (80px), beside it: Full name "Sarah Martinez" in bold, below that a row of badges/pills: "Premium Member" (indigo badge), "Active" (green badge), "Since Jan 2024" (gray badge)
- Right side of header: Key metrics in a horizontal row:
  - Lifetime Value: $3,240 (with small trend arrow up)
  - Total Visits: 147
  - Avg. Visits/Week: 2.8
  - Credits Remaining: 6
  - Last Visit: "2 days ago"
- Below metrics, action buttons: [Book Session] [Send Message] [Edit Profile] [More ⋯]

AI INSIGHT CARD (full width, below header):
Subtle indigo gradient left-border. "Sarah visits 3x/week, primarily mornings (7-9am). She prefers Barrel Sauna #1 and always adds aromatherapy. Her visit frequency dropped 35% this month compared to her average. Recommended action: Personal check-in + complimentary compression boots session."
Two small buttons: [Send Check-in Email] [Dismiss]

TAB NAVIGATION (horizontal tabs below AI card):
Overview | Visit History | Financials | Preferences | Communications | Documents

OVERVIEW TAB (shown as default):

Left column (55%):
"Active Membership" card: Plan name "Unlimited Monthly", price "$149/mo", next billing date, payment method on file (Visa ending 4242), auto-renew status. Quick actions: [Pause] [Upgrade] [Cancel]

"Credit Balance" card: 6 credits remaining, expiry date, visual progress bar showing 6 of 10 used. Credit history: recent deductions with dates and what they were used for.

"Upcoming Bookings" card: Next 3 booked sessions with resource, date, time, and a [Cancel] link each. Empty state if none: "No upcoming bookings" with a [Book Now] button.

Right column (45%):
"Visit Activity" — GitHub-style heatmap calendar showing visit frequency over the last 6 months. Darker squares = more visits. Today highlighted. Hovering a day shows visit count and resources used.

"Session Preferences" card (auto-detected from behavior):
- Preferred time: Mornings (7-9am) — 78% of visits
- Preferred resource: Barrel Sauna #1 — 64% of bookings
- Common add-ons: Aromatherapy (89%), Towel service (100%)
- Average session duration: 52 minutes
- Shown as clean icon + label + percentage rows

"Notes & Tags" card:
- Staff notes (manually entered) with timestamps and author
- Tags: "VIP", "Referral Source", "Morning Regular" as colored pills
- [Add Note] and [Add Tag] buttons

DESIGN DETAILS:
- The profile should feel like a CRM record meets Apple Health — data-rich but beautifully organized
- The AI insight card should be the first thing that catches your eye after the header
- The heatmap calendar should use shades of indigo (lightest = 1 visit, darkest = 3+ visits)
- Numbers should feel large and confident — this is about understanding a person at a glance
- The layout should breathe — not cramped, not wasteful
```

---

### PROMPT 4: Revenue & Financial Dashboard

```
Design the revenue and financial analytics dashboard for "Meridian" — a premium fitness studio management platform. This page gives operators complete financial visibility with AI-powered insights.

DESIGN LANGUAGE:
- Deep indigo (#4F46E5) primary, emerald (#10B981) for growth/positive, coral (#F97316) for decline/concern, amber (#F59E0B) for attention items
- Data visualization should be clean and modern — think Stripe Dashboard quality
- Inter or SF Pro typography

LAYOUT:

TOP BAR:
- Left: "Revenue" page title
- Right: Date range selector (This Month | Last 30 Days | This Quarter | This Year | Custom), Compare toggle ("vs. Previous Period"), Export button

ROW 1 — Hero Metrics (5 cards):
Large number, label below, comparison badge (▲ 12% or ▼ 3%), micro sparkline.
- Monthly Recurring Revenue: $18,420
- Total Revenue (period): $24,670
- Avg Revenue Per Member: $127
- Revenue Churn: 2.1%
- Net Revenue Retention: 108%

ROW 2 — Revenue Chart (full width, hero chart):
Stacked area chart showing revenue over time (30-day default), broken down by:
- Subscriptions (indigo fill)
- Credit Packs (blue fill)
- Drop-ins (violet fill)
- Add-ons (teal fill)
- Corporate (amber fill)
Hovering any point shows a tooltip with exact breakdown for that day.
Below the chart: a row of small toggles to show/hide each revenue category.

AI INSIGHT (below chart, subtle card):
"Credit pack revenue increased 23% this month, driven by the new 20-pack introduction. Members purchasing 20-packs visit 40% more frequently than 10-pack buyers and have 60% lower churn. Recommendation: Consider making the 20-pack the default promoted option."

ROW 3 — Two-column layout:

LEFT (50%) — "Membership & Pack Performance" table:
Table with columns: Plan Name | Active Count | MRR Contribution | Avg. Lifetime | Churn Rate (30d) | Trend
Each row is a membership or credit pack. Churn rate cells are color-coded (green < 3%, amber 3-5%, red > 5%).
Sort by any column. Click any row to drill into that plan's detailed analytics.

RIGHT (50%) — "Failed Payments & Recovery" card:
- Outstanding: $2,340 across 14 members
- Aging breakdown: 1-7 days (8 members, $1,120), 8-14 days (4, $780), 15+ days (2, $440)
- Recovery rate this month: 72%
- Visual horizontal stacked bar showing the aging distribution
- [View All Failed Payments] button
- [Send Recovery Campaign] quick action

ROW 4 — Transaction Feed (compact table, full width):
Most recent transactions with: Timestamp, Member Name, Type (Subscription/Credit Pack/Drop-in/Add-on), Amount, Payment Method, Status badge (Completed in green, Failed in red, Refunded in amber).
Filterable by type and status. Paginated. [Export CSV] button.

DESIGN DETAILS:
- The stacked area chart should be the visual centerpiece — large, beautiful, smooth curves
- Color coding should be consistent and meaningful — you should be able to read the financial health at a glance
- The failed payments section should feel urgent but not alarming — it's an action item, not a crisis
- Overall feel: Stripe Dashboard meets Bloomberg Terminal for fitness — serious about money, beautiful about data
```

---

### PROMPT 5: Marketing Campaign Builder

```
Design a marketing campaign creation and management interface for "Meridian" — a premium fitness studio management platform. This should feel like a modern email marketing tool built specifically for studio operators.

DESIGN LANGUAGE:
- Deep indigo (#4F46E5) primary, amber (#F59E0B) for CTAs and highlights, emerald (#10B981) for sent/success, coral (#F97316) for draft/pending
- Clean, creative-friendly layout — this page is about crafting messages
- Inter or SF Pro typography

LAYOUT:

TOP BAR:
- Left: "Marketing" page title with sub-tabs: Campaigns | Automations | Leads | Content
- Right: [+ New Campaign] primary button

CAMPAIGNS LIST VIEW (default):
A card grid or list view showing recent campaigns:
Each campaign card shows:
- Campaign name (bold)
- Channel icon(s): email envelope, SMS phone, push bell
- Status badge: Draft (amber), Scheduled (indigo), Sent (emerald), Active (green pulse dot for automations)
- Audience size (e.g., "342 members")
- Performance preview: Open rate, Click rate, Conversions (if sent)
- Date sent or scheduled date
- Quick actions: [Duplicate] [Edit] [View Report]

Sorting: Most recent, Best performing, By channel
Filter chips: All, Email, SMS, Push, Active Automations

CAMPAIGN CREATION FLOW (when "+ New Campaign" clicked — show this as a modal or dedicated page):

Step 1 — Setup (left panel of a split view):
- Campaign name input
- Channel selector: Email | SMS | Push (multi-select for sequences)
- Audience selector: dropdown of saved segments + option to create custom filter
  - Preview showing: "This will reach 156 members" with a small breakdown (Active: 142, At Risk: 14)
- Send time: Now | Schedule | AI Optimized (with tooltip: "We'll send to each member at their highest engagement time")

Step 2 — Content (right panel / main area):
For email: A clean drag-and-drop email builder showing:
- Template header with studio logo
- Headline text block (editable)
- Body text with merge tags highlighted: {{first_name}}, {{credits_remaining}}, {{last_visit_days_ago}}
- CTA button (customizable text and color)
- Image block
- Footer with unsubscribe link

For SMS: A phone mockup showing the message preview with character count "127/160 characters — 1 credit per recipient"

AI ASSIST floating button:
"Generate with AI" — click opens a prompt: "What do you want to say?" → AI generates subject line + body copy tailored to the selected audience segment. Example: "We miss you, {{first_name}}! It's been {{last_visit_days_ago}} days since your last session..."

Bottom bar: [Save Draft] [Preview] [Send Test] [Schedule / Send] buttons

AUTOMATIONS TAB (show as a separate section):
Visual flow builder showing a workflow:
- Trigger: "Member hasn't visited in 14 days"
- → Wait 1 day
- → Send Email: "We miss you!"
- → Wait 3 days
- → Condition: "Opened email?" → Yes: Send Push "Book now, get a free add-on" → No: Send SMS "Quick reminder..."
- → Wait 7 days
- → If still no visit: Flag as "At Risk" in CRM

Each node in the flow is a rounded card connected by lines/arrows. Active automations show a small green pulse. Stats on each node: "247 entered → 189 completed → 34 converted"

DESIGN DETAILS:
- The campaign builder should feel creative and empowering, not bureaucratic
- The automation flow builder should feel like a modern workflow tool (like Zapier or Linear's project flows)
- AI assist should feel like a helpful co-pilot, not a replacement
- The overall page should make you want to create campaigns — it should feel productive and fun, not like a chore
```

---

### PROMPT 6: Analytics & AI Insights Hub

```
Design the analytics and AI insights hub for "Meridian" — a premium fitness studio management platform. This is the intelligence layer where data becomes decisions.

DESIGN LANGUAGE:
- Deep indigo (#4F46E5) primary, data visualizations use a harmonious palette: indigo, blue (#3B82F6), violet (#8B5CF6), teal (#14B8A6), amber (#F59E0B)
- Charts should be clean, modern, and interactive-looking (tooltips, hover states)
- Dark mode version would be especially compelling for this page
- Inter or SF Pro typography

LAYOUT:

TOP BAR:
- Left: "Analytics" with sub-tabs: Overview | Utilization | Members | Financial | Marketing | AI Lab
- Right: Date range selector, [+ New Dashboard] button, [Export Report] dropdown

OVERVIEW TAB:

ROW 1 — AI Recommendations Panel (full width):
A distinctive card with subtle gradient border. Title: "AI Recommendations" with a sparkle icon.
3-4 recommendation cards in a horizontal scroll:
- Card 1 (Schedule): "Add a 6:30pm sauna slot on Tuesdays. 78% of Tuesday evening waitlist requests fall in this window. Estimated impact: +$340/week." [Implement] [Dismiss]
- Card 2 (Pricing): "Your 5-pack at $99 has a 45% expiry rate. Members purchasing 10-packs use 92% of credits. Consider discontinuing the 5-pack." [Adjust Pricing] [Analyze More]
- Card 3 (Retention): "Members who try cold plunge within their first month have 2.3x higher retention. Only 34% of new members have tried it. Launch a 'First Plunge Free' campaign?" [Create Campaign] [Dismiss]
- Card 4 (Seasonal): "Based on last year's data, booking volume drops 18% in the 2nd week of December. Consider a holiday promotion starting Dec 1." [Plan Campaign] [Remind Me Later]

ROW 2 — Key Health Metrics (4 large cards):
Each card has a large metric, trend chart (last 12 weeks), and a health indicator (green/amber/red dot):
- Member Retention (30-day): 94.2% (green, up from 92.1%)
- Avg. Utilization: 71% (amber, goal is 80%)
- Revenue Growth: +8.3% MoM (green)
- Member Satisfaction: 4.6/5 (green, from post-session surveys)

ROW 3 — Utilization Heatmap (hero visualization):
A large heatmap grid: Y-axis = Resources (Barrel Sauna 1-4, Cold Plunge A-B, etc.), X-axis = Hour of day (7am-9pm).
Color intensity from white (0%) through light indigo to deep indigo (100% utilization).
Day-of-week selector tabs above the heatmap (Mon-Sun or "All Week Average").
Hovering a cell shows: "Barrel Sauna 2, Wednesdays 5-6pm: 92% booked (avg 11.5 of 12.5 available slots/month)"

ROW 4 — Two columns:

LEFT (55%) — Member Cohort Retention Chart:
Classic retention curve chart. X-axis: Months since signup (0-12). Y-axis: % still active.
Multiple cohort lines (last 6 months of signup cohorts), each a different shade of indigo/blue.
Legend showing each cohort month with its starting count.
"Members who signed up in January 2024 have 78% retention at month 6 — your best cohort in 12 months."

RIGHT (45%) — Revenue by Source Donut Chart:
Clean donut chart showing revenue breakdown: Subscriptions (52%), Credit Packs (28%), Drop-ins (8%), Add-ons (7%), Corporate (5%).
Center of donut shows total: "$24,670"
Below the donut: small comparison bars showing vs. previous period for each category.

ROW 5 — Trending Insights Feed:
A scrollable list of AI-detected patterns and anomalies:
- "📊 Cold plunge usage up 34% since adding post-sauna contrast protocol guide to the app"
- "🔄 Top 10% of members (by visits) generate 38% of total revenue — they're your best ambassador candidates"
- "📉 Saturday 8am slot utilization dropped from 85% to 62% over the last 6 weeks — seasonal shift?"
- "💡 Members who book 48+ hours in advance no-show 3x less than same-day bookers"
Each insight has a [Explore] link to dig deeper.

DESIGN DETAILS:
- The heatmap should be the visual centerpiece — it immediately tells you where your business is busy and where it's not
- AI recommendations should feel like having a brilliant analyst on your team, not like a robot
- Charts should feel interactive — cursor changes, subtle highlights, everything looks clickable
- This page should make the operator feel powerful — they have intelligence that their competitors don't
- Consider a dark mode rendering with the indigo palette — it would make the data visualizations pop beautifully against a dark background
```

---

### PROMPT 7: Walk-In / Kiosk Mode

```
Design a walk-in check-in and kiosk mode for "Meridian" — a premium fitness studio management platform. This is the simplified front-desk view optimized for quick member check-ins and walk-in sales.

DESIGN LANGUAGE:
- Same palette but optimized for speed: Large touch targets, high contrast, minimal clutter
- This view would be used on an iPad at the front desk
- Everything is one or two taps — no scrolling through menus

LAYOUT (optimized for landscape tablet):

TOP SECTION (40% of screen):
Large search bar: "Search member name, email, or phone..." with a barcode scan icon
Below search: Row of recent visitors (last 5-6) as circular avatar + first name cards — tap to check in instantly
"No results" state: [New Walk-in Guest] large button

BOTTOM SECTION (60% of screen) — Real-Time Availability Grid:
Grid of resource cards (2 rows, 4-5 columns):
Each card shows:
- Resource name (large): "Barrel Sauna 1"
- Status: "Available" (large green text) or "Occupied — 23:41 left" (indigo text with countdown) or "Cleaning — 8:12" (amber)
- Next available time if occupied
- [Book Now] button on available resources

When a member is searched and found, the view transforms:
- Member card appears at top: Photo, name, membership type, credits remaining
- Available resources highlight in green with one-tap booking
- "Check In to Existing Booking" appears if they have one today
- Quick sell options if no credits: [Buy Day Pass — $35] [Buy 5-Pack — $99] [Buy 10-Pack — $179]

CHECKED IN confirmation:
Full-screen success state: Large checkmark, "Welcome back, Sarah!" with session details (Resource, Duration, Start Time). Auto-dismisses after 5 seconds back to search.

DESIGN DETAILS:
- Large typography — readable from 3 feet away
- Touch targets minimum 48px
- High contrast — works in bright lobby lighting
- Feels premium — not like a hospital check-in kiosk
- Animation: smooth transitions between states, satisfying check-in confirmation
```

---

### PROMPT 8: Mobile Member App (Customer-Facing)

```
Design the customer-facing mobile app for "Meridian" — a premium fitness and wellness studio management platform. This is what members use to book sessions, manage their account, and track their wellness journey.

DESIGN LANGUAGE:
- Clean, warm, elevated — think Apple Fitness+ meets a luxury spa app
- Primary: Deep indigo (#4F46E5), with warm neutrals (#F5F5F4, #E5E5E5) and pops of emerald for confirmation states
- Large imagery, smooth transitions, comfortable spacing
- SF Pro or Inter for typography
- This should feel premium — like the app for a brand you love using

SCREENS TO DESIGN (show as a set of mobile frames):

SCREEN 1 — Home:
- Greeting: "Good morning, Sarah" with a subtle wave emoji or sun icon
- Next Booking Card (if exists): "Today, 9:00am — Barrel Sauna #1" with a countdown badge "Starts in 2h 14m" and a [Cancel] text link. Full-bleed image of a sauna behind the text.
- Quick Book Row: Horizontal scroll of resource type cards with availability count: "Sauna (3 open)" "Cold Plunge (1 open)" "Contrast (2 open)" — tapping goes straight to booking
- Credit Balance: "6 credits remaining" with a thin progress ring and [Buy More] link
- Recent Sessions: Last 3 visits as compact cards with date, resource used, and duration

SCREEN 2 — Book a Session:
- Date selector (horizontal scrolling day pills, today highlighted)
- Time grid showing available slots by resource
- Each available slot is a tappable card: Time, Resource Name, Duration, Credit cost
- Unavailable slots grayed out
- Tapping a slot opens a bottom sheet confirmation: Session details, add-ons toggles (Towel: +1 credit, Aromatherapy: +1 credit), total credits, [Confirm Booking] button

SCREEN 3 — My Account:
- Membership card design (like Apple Wallet): Plan name, member since, next billing date
- Credit balance with breakdown and expiry dates
- Visit streak / stats: "12 visits this month" with a mini calendar heatmap
- Payment methods
- Personal info
- Signed waivers
- Settings / Preferences

SCREEN 4 — Session History / Wellness Journey:
- Monthly view with visit count and calendar heatmap
- Each past session expandable: Resource used, duration, add-ons, date/time
- Streak tracking: "Current streak: 8 weeks of 2+ visits"
- Personal records: "Longest cold plunge: 4 minutes" (gamification element)
- Simple, beautiful, makes members want to come back

DESIGN DETAILS:
- The booking flow should be 2 taps maximum from home to confirmed booking
- The app should feel warm and inviting — not clinical or corporate
- Large imagery of the studio/equipment where possible
- Bottom tab navigation: Home | Book | Activity | Account
- Everything should load instantly (design for perceived speed — skeleton screens where needed)
- This app should make members want to use it — it should feel like part of the premium studio experience
```

---

## How to Use These Prompts

**For MagicPath:** Paste each prompt as-is. MagicPath responds well to detailed spatial layout descriptions and specific hex colors. Start with Prompt 1 (Command Center) to establish the design system, then iterate.

**For Stitch UI (Google):** These prompts may need to be slightly simplified if Stitch has a character limit. The key elements to preserve are: the color system, the layout structure, and the specific data/content examples. Stitch tends to work well with component-level descriptions.

**Iteration strategy:**
1. Generate Prompt 1 in both tools → compare quality and design direction
2. Pick the tool that better captures the aesthetic
3. Run through remaining prompts, using the first output as a reference for consistency
4. Compile all screens into a single design document for review

**What to evaluate in outputs:**
- Does it feel like Apple / Linear / Stripe quality?
- Is the information density right? (Not too sparse, not overwhelming)
- Does the AI integration feel natural or bolted on?
- Would you want to use this every morning?
- Is the color palette creating the right mood — intelligent, warm, confident?
