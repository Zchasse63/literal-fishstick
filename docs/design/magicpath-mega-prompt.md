# MagicPath Mega-Prompt — Meridian Full Dashboard Application

```
Design a complete, multi-page SaaS dashboard application called "Meridian" — a premium management platform for fitness and wellness studios. This is an entire operating system: scheduling, members, revenue, marketing, analytics, and operations. Build ALL pages as a unified, navigable application with consistent design language.

=============================================
GLOBAL DESIGN SYSTEM
=============================================

AESTHETIC: Linear meets Apple Health meets Stripe Dashboard. Confident, information-dense, never boring. Think: the tool that makes you feel powerful.

COLOR PALETTE:
- Primary: Deep indigo #4F46E5 (navigation, active states, primary actions)
- Secondary: Warm amber #F59E0B (action items, alerts, attention badges)
- Success: Emerald #10B981 (available, growth, confirmations)
- Warning: Soft coral #F97316 (decline, churn risk, overdue)
- Surfaces: Near-white #FAFAFA background, warm gray #F5F5F4 cards
- Dark mode option: #0F0F11 background, #1A1A1F cards
- AI treatment: Subtle indigo-to-violet gradient border (1px) on any AI-generated insight card

TYPOGRAPHY:
- Font: Inter or SF Pro
- Hero metrics: 32-40px, bold/semibold — numbers should command attention
- Section headers: 18-20px, semibold
- Body/labels: 14px, regular
- Secondary/timestamps: 12px, light, muted color
- IMPORTANT: Large numbers ($2,847 / 34 / 94%) should feel bold and confident, never timid

COMPONENTS:
- Cards: Rounded corners (12px), subtle border (1px #E5E5E5), no heavy shadows
- Buttons: Primary = indigo filled, Secondary = outlined, Destructive = coral
- Badges/pills: Rounded full, small text, color-coded by meaning
- Sparklines: Thin, clean, embedded in metric cards
- Status dots: 10px minimum, color-coded (green=available, indigo=active, amber=cleaning/pending, red=maintenance/error)
- Hover states: Subtle background shift, everything that's a number should look clickable
- Transitions: Smooth 200ms ease, nothing jarring

GLOBAL NAVIGATION (persistent left sidebar, 220px, collapsible):
- Top: Meridian logo mark + wordmark
- Search bar with "⌘K" keyboard hint
- Nav sections (each with an icon):
  • Dashboard (home icon) — the Command Center
  • Schedule (calendar icon)
  • Members (people icon)
  • Revenue (dollar icon)
  • Marketing (megaphone icon)
  • Corporate (building icon)
  • Operations (gear icon)
  • Analytics (chart icon)
- Active item: indigo left border accent + indigo text + subtle indigo background tint
- Bottom: User avatar (circular, 36px) + name "Zach M." + role "Studio Owner" + dark mode toggle
- Collapse state: Icons only, tooltip on hover

TOP BAR (persistent across all pages):
- Left: Breadcrumb trail (e.g., "Revenue > Memberships & Pricing")
- Right: Notification bell (with unread count badge), "Live Status: Healthy" indicator with green dot, "+" floating action button for quick-create

=============================================
PAGE 1: COMMAND CENTER (Home Dashboard)
=============================================

This is the morning briefing page — the first thing an operator sees.

ROW 1 — AI Briefing Card (full width):
A card with a 1px indigo-to-violet gradient border and a very subtle tinted background to elevate it above other cards. Header: sparkle icon + "Good morning, Zach". Below: 3 AI insight bullets, each with an icon, text, and a small action button:
- (chart-up icon): "Wednesday 7pm Guided class hit 10/12 capacity 3 weeks straight — consider adding a Thursday session" → [Add Class]
- (alert icon): "9 members haven't booked in 14+ days — churn risk campaign ready" → [Send Campaign]
- (briefcase icon): "Tampa Tech corporate account is 3 sessions from their monthly cap" → [Contact Account]

ROW 2 — Today's Metrics Strip (5 cards in a horizontal row):
Each card: metric label (small caps, muted), large bold number, small sparkline, percentage change badge.
- "Bookings Today: 34" (▲12%)
- "Current Session: 9/12" (with real-time dot pulse)
- "Revenue Today: $2,847" (▲8.2%)
- "Walk-ins: 7" (▲2)
- "No-Shows: 1" (▼50%)

ROW 3 — Two-column layout:

LEFT (55%) — Class Status Board:
Shows today's time slot schedule as horizontal bars with capacity fill:
- "5:00 PM — Open Sauna" → progress bar showing 11/12 booked (nearly full, indigo bar)
- "6:00 PM — Open Sauna" → 7/12 booked (partial fill)
- "7:00 PM — Guided: Whitney C." → 9/10 booked (nearly full, violet bar for guided)
- "8:00 PM — Open Sauna" → 4/12 booked (light fill)
Each row shows: time, class type, trainer name (if guided), capacity bar, booked/total count, and a [View] link.
Currently active class has a green "LIVE" badge and subtle pulse animation.
Below the class list: "Cold Plunges: 4/6 available" status line.

RIGHT (45%) — Today's Schedule Timeline:
Compact vertical timeline from 5pm to 9pm. Each booking block shows member names stacked (compact list format since multiple people per slot). Current time indicated with a horizontal red line. Guided classes have a violet left-border accent. A "+" button at the bottom for quick-add.

ROW 4 — Activity Feed (full width):
Compact scrolling list of real-time events with timestamps, type icons, and clickable entries:
- "Sarah M. checked in — 5:00 PM Open Sauna" (check icon, green)
- "New booking: James K. — 7:00 PM Guided, Whitney C." (calendar icon, indigo)
- "Payment received: $149 — Mike T. (Unlimited Monthly)" (dollar icon, green)
- "⚠️ Failed payment: Lisa R. — Monthly Membership ($89)" (alert icon, coral)
- "Walk-in: David S. — purchased Day Pass ($35)" (walk-in icon, amber)
- "Whitney C. assigned to Thursday 7pm (new class created)" (trainer icon, violet)

=============================================
PAGE 2: SCHEDULE — Class Calendar
=============================================

TOP BAR:
- View toggles: Day | Week | Month (pill selector, Week active)
- Filter chips: All Classes, Open Sauna, Guided, Private (toggleable)
- Date picker + [+ New Class] primary button

MAIN CALENDAR (Week View):
- Y-axis: Days of the week (Mon–Sun) as row headers
- X-axis: Time slots (5pm–9pm in 1-hour blocks)
- Each class block is a rounded rectangle spanning its time slot:
  - Color: Indigo for Open Sauna, violet for Guided, teal for Private
  - Shows: Class type, trainer name (if assigned), capacity bar "8/12", booked count
  - Guided classes show the trainer's small circular avatar on the block
- Empty slots are light gray with a dashed border — clickable to create
- Current day column has a subtle highlight

RIGHT SIDEBAR (collapsible, 320px):
Default: selected class details panel. Shows:
- Class name and type
- Date, time, duration
- Trainer assigned (with avatar)
- Capacity: visual bar + number (9/12)
- Attendee list with check-in status (checked-in = green dot, booked = gray dot, no-show = red dot)
- Revenue from this class (drop-ins + credit deductions)
- Quick actions: [Check In All] [Send Reminder] [Edit Class] [Cancel Class]
- Waitlist count (if at capacity): "3 on waitlist" with [Promote Next] button

BOTTOM STATUS BAR:
"This week: 28 classes | 312 total bookings | 74% avg capacity | 3 classes at capacity"

=============================================
PAGE 3: MEMBER PROFILE (detail page)
=============================================

HEADER (full width):
- Left: Large circular photo (80px), name "Sarah Martinez" (bold), badge row: "Unlimited Monthly" (indigo), "Active" (green), "Since Jan 2024" (gray)
- Right: Key metrics row:
  - Lifetime Value: $3,240 (▲ trend)
  - Total Visits: 147
  - Avg Visits/Week: 2.8
  - Credits Remaining: 6
  - Last Visit: "2 days ago"
- Action buttons: [Book Session] [Send Message] [Edit Profile] [⋯ More]
- The "More" dropdown includes: "Exclude from Analytics" toggle, "Assign Tags", "View Family Account"

AI INSIGHT CARD (full width):
Gradient border. "Sarah visits 3x/week, primarily in the 6pm class. She tried Whitney's guided class twice and attended both — high candidate for guided upsell. Visit frequency dropped 35% this month. Recommended: personal check-in + free guided class invite."
Buttons: [Send Check-in Email] [Invite to Guided Class] [Dismiss]

TABS: Overview | Visit History | Financials | Preferences | Communications

OVERVIEW TAB (default):

Left column (55%):
- "Active Membership" card: "Unlimited Monthly", $149/mo, next billing date, payment method (Visa •••• 4242), auto-renew ON
  - Action buttons: [Pause] [Upgrade] [Cancel]
  - "Upgrade" opens inline options showing available tiers with price comparison
- "Upcoming Bookings" card: Next 3 booked classes with date, time, class type, trainer (if guided), [Cancel] link each
- "Notes & Tags" card: Staff notes with timestamps + tag pills ("Morning Regular", "Guided Interest", "VIP")

Right column (45%):
- "Visit Heatmap" — GitHub-style calendar (6 months), shades of indigo (light=1 visit, dark=3+). Today highlighted.
- "Session Preferences" card (auto-detected):
  - Preferred time: 6pm class — 72% of visits
  - Preferred class type: Open Sauna — 85%
  - Guided class attendance: 2 sessions (Whitney C.)
  - Average session duration: 55 minutes
- "Member Discount" indicator: "Active — 15% off merch & gift cards" (green badge)

=============================================
PAGE 4: REVENUE OVERVIEW
=============================================

TOP: Date range selector (This Month | Last 30 | Quarter | Year | Custom), Compare toggle, Export button

ROW 1 — Hero Metrics (5 cards):
- Monthly Recurring Revenue: $18,420 (▲6.2%)
- Total Revenue: $24,670 (▲9.1%)
- Avg Revenue Per Member: $127 (▲3.4%)
- Revenue Churn: 2.1% (▼0.3%)
- Net Revenue Retention: 108% (▲2%)

ROW 2 — Revenue Chart (full width):
Stacked area chart (30 days), broken down by: Subscriptions (indigo), Credit Packs (blue), Drop-ins (violet), Merch (teal), Corporate (amber), Gift Cards (emerald). Tooltip on hover with exact daily breakdown. Toggle switches below chart to show/hide categories.

AI INSIGHT (below chart):
Gradient border card: "Members on the Unlimited plan generate 2.4x more revenue than 10-class pack holders when you include merch purchases and guest referrals. Consider promoting Unlimited as the default option on the booking page. Also: Whitney's promo code 'BREATHE' has driven 8 new signups this month worth $1,192 in MRR."

ROW 3 — Two columns:

LEFT (50%) — Membership & Pack Performance:
Table: Plan Name | Active Count | MRR Contribution | Avg Lifetime | Churn Rate (30d) | Trend sparkline
Rows: Unlimited Monthly ($149), 10-Class Pack ($129), 6-Class Pack ($79), Drop-in Day Pass ($35)
Churn cells color-coded: green <3%, amber 3-5%, red >5%
Sortable columns, clickable rows to drill into plan details.

RIGHT (50%) — Failed Payments & Recovery:
- Outstanding: $2,340 across 14 members
- Aging bars: 1-7 days ($1,120), 8-14 days ($780), 15+ days ($440)
- Recovery rate: 72%
- [View All] and [Send Recovery Campaign] buttons

ROW 4 — Revenue Streams (additional):
Compact cards for: Merch Sales This Month ($1,240), Gift Cards Sold ($680), Private Events Revenue ($900)
Each with sparkline and trend.

ROW 5 — Transaction Feed:
Recent transactions table: Timestamp | Member | Type | Amount | Method | Status badge
Filterable, paginated, [Export CSV] button.

=============================================
PAGE 5: MEMBERSHIPS & PRICING
=============================================

Split layout:

LEFT (65%) — Plan Manager:
Card for each membership/pack with:
- Plan name, price, billing cycle
- Active member count
- MRR contribution
- Churn rate badge
- [Edit] [Pause Sales] [Archive] actions
Plans shown: Unlimited Monthly ($149/mo), 10-Class Recurring ($129/mo), 6-Class Recurring ($79/mo), 10-Class Pack ($179 one-time), Day Pass ($35)

RIGHT (35%) — Pricing Simulator:
"What-If" tool: Dropdown to select a plan, slider to adjust price, shows projected impact:
- Estimated churn impact
- Projected MRR change
- Revenue comparison chart (current vs. proposed)
- [Apply New Price] button (with confirmation modal)

MEMBER DISCOUNT CONFIGURATION section:
- Toggle: "Active recurring members get discount on merch & gift cards"
- Discount percentage: slider or input (10-15%)
- Preview: "Currently applies to 87 active recurring members"

TRAINER PROMO CODES section:
- Table: Trainer Name | Promo Code | Signups This Month | MRR Generated | Status
- [Create New Code] button
- Click any row to see full attribution history

=============================================
PAGE 6: MARKETING — CAMPAIGNS
=============================================

TOP: Sub-tabs: Campaigns | Automations | Leads | Content | Community

CAMPAIGNS LIST:
Card grid of recent campaigns, each showing:
- Campaign name, channel icons (email/SMS/push), status badge (Draft/Scheduled/Sent)
- Audience size, performance preview (open rate, clicks, conversions if sent)
- Quick actions: [Duplicate] [Edit] [View Report]

CAMPAIGN BUILDER (shown as expanded or modal):
Left panel — Setup:
- Campaign name, channel selector (Email | SMS | Push)
- Audience selector with segment dropdown + member count preview
- Send time: Now | Schedule | AI Optimized
Right panel — Content:
- Email: drag-and-drop blocks (header, text with merge tags {{first_name}}, {{credits_remaining}}, CTA button, image, footer)
- SMS: phone mockup with character count
- "Generate with AI" floating button — opens prompt: "What do you want to say?" → generates copy

AUTOMATIONS TAB (show visual flow):
Example automation: "Member hasn't booked in 14 days" → Wait 1 day → Send Email "We miss you!" → Wait 3 days → Condition: Opened? → Yes: Send Push → No: Send SMS → Wait 7 days → Flag as "At Risk"
Each node is a card with stats: "247 entered → 189 completed → 34 converted"

COMMUNITY TAB:
- Feed moderation view showing recent posts from the community board
- Trainer posts, studio announcements, member interactions
- Moderation tools: [Approve] [Hide] [Pin] [Delete]
- Instagram feed sync status and configuration

=============================================
PAGE 7: OPERATIONS — STAFF & TRAINERS
=============================================

STAFF DIRECTORY:
Table: Photo | Name | Role(s) | Classes This Week | Rating | Pay This Period | Status
Role badges support multiple: "Admin + Member" or "Trainer + Member" on the same row
[Add Staff Member] button

TRAINER DETAIL PANEL (when clicking a trainer):
- Profile: photo, name, bio, specialties
- Performance metrics: Classes this month, avg attendance, fill rate, revenue generated
- Promo code: code string, signups this month, total MRR generated
- Bonus tracking: Threshold (7+ members), classes that qualified, bonus amount earned
- Pay summary: Base pay + bonuses + promo commissions = total
- Upcoming schedule: their assigned classes this week
- [Edit Profile] [Manage Code] [View on Member App] buttons

ROLE & PERMISSIONS:
Visual permission matrix: rows = roles (Owner, Admin, Trainer, Receptionist), columns = capabilities (View Dashboard, Manage Schedule, View Revenue, Edit Members, Process Payments, etc.)
Checkmarks in a grid. Custom roles can be created.

=============================================
PAGE 8: ANALYTICS — AI INSIGHTS HUB
=============================================

ROW 1 — AI Recommendations (full width, horizontally scrollable cards):
4 recommendation cards with gradient borders:
- (Schedule): "Add a Thursday 7pm Guided class — Whitney's Wednesday class has been 90%+ capacity for 4 weeks. Estimated: +$500/week." [Add Class] [Dismiss]
- (Pricing): "5-pack users have a 45% expiry rate vs 8% for 10-packs. Consider discontinuing the 5-pack." [Adjust] [Analyze]
- (Retention): "Members who attend a Guided class within 30 days of signup have 2.3x retention. Only 34% try Guided. Launch 'First Guided Free' campaign?" [Create Campaign]
- (Seasonal): "December bookings drop 18% historically. Plan a holiday promo starting Dec 1." [Plan Campaign] [Remind Later]

ROW 2 — Utilization Heatmap (hero visualization):
Y-axis: Days of week (Mon–Sun). X-axis: Time slots (5pm–9pm).
Color intensity from white (0%) to deep indigo (100% capacity).
Hovering shows: "Wednesday 7pm: 92% avg capacity (11.0 of 12 slots filled). Guided class with Whitney C."
Selector tabs above: Open Sauna | Guided | All Classes

ROW 3 — Two columns:

LEFT (55%) — Member Cohort Retention:
Retention curve chart. X-axis: months since signup (0-12). Y-axis: % still active.
Multiple cohort lines (last 6 signup months) in shades of indigo/blue.
Note: "January 2024 cohort: 78% retention at month 6 — best in 12 months"

RIGHT (45%) — Revenue by Source Donut:
Clean donut: Subscriptions 52%, Credit Packs 28%, Drop-ins 8%, Merch 7%, Corporate 3%, Gift Cards 2%.
Center: "$24,670". Comparison bars below for each vs. previous period.

ROW 4 — Trainer Performance Leaderboard:
Table: Trainer | Classes | Avg Attendance | Fill Rate | Promo Signups | Revenue Generated | Bonus Earned
Sortable. Click any trainer to jump to their Operations > Staff detail panel.

ROW 5 — Trending Insights Feed:
- "Members who attend Guided classes visit 40% more frequently than Open Sauna-only members"
- "Saturday 10am slot has 3-week declining trend — 85% → 62%. Seasonal shift?"
- "Top 10% of members generate 38% of revenue — ambassador program candidates"
- "Cold plunge usage up 34% since adding post-sauna protocol guide to the app"
Each insight has an [Explore] link.

=============================================
PAGE 9: WALK-IN / KIOSK MODE
=============================================

Optimized for landscape tablet. Large touch targets (48px+), high contrast.

TOP (40%):
Large search bar: "Search member name, email, or phone..."
Below: Recent visitors as circular avatar + first name cards — tap to check in instantly.
[New Walk-in Guest] large button if no results.

BOTTOM (60%) — Today's Classes:
Cards for each upcoming time slot:
- "5:00 PM — Open Sauna" → "3 spots left" (green) → [Book & Check In]
- "6:00 PM — Open Sauna" → "5 spots left" (green) → [Book & Check In]
- "7:00 PM — Guided: Whitney C." → "1 spot left" (amber) → [Book & Check In]
- "8:00 PM — Open Sauna" → "FULL — Waitlist (2)" (red) → [Join Waitlist]

When member found:
- Member card: photo, name, membership type, credits
- One-tap check-in if they have a booking today
- If no booking: show available classes with one-tap book + check in
- If no credits: [Buy Day Pass — $35] [Buy 10-Pack — $179]

CHECK-IN CONFIRMATION:
Full-screen success: Large checkmark, "Welcome back, Sarah! 5:00 PM Open Sauna. Enjoy your session!" Auto-dismiss after 5 seconds.

=============================================
PAGE 10: MOBILE MEMBER APP (show as mobile frames)
=============================================

Show 4 mobile screens side-by-side:

SCREEN 1 — Home:
- "Good morning, Sarah" with sun icon
- Next booking card with full-bleed sauna image: "Today, 6:00 PM — Open Sauna" with countdown "Starts in 3h 14m" and [Cancel] link
- Quick Book row: horizontal scroll cards with availability: "Open Sauna (5 open)" "Guided (2 open)" "Private (request)" — tap to book
- Credit balance: "6 credits" with progress ring + [Buy More]
- Merch spotlight: featured item with member discount price showing original crossed out
- Community preview: latest post from a trainer

SCREEN 2 — Book a Session:
- Horizontal scrolling day pills (today highlighted)
- Time slot cards: "5:00 PM — Open Sauna — 3 spots left" / "7:00 PM — Guided: Whitney C. — 1 spot left"
- Tap opens bottom sheet: session details, add-ons (Towel: +1 credit, Aromatherapy: +1 credit), total credits, [Confirm Booking]

SCREEN 3 — Community Board:
- Feed with posts: trainer announcing a special breathwork class, studio event announcement, member photo
- Like and comment interactions
- Instagram feed section at the bottom
- Only visible to signed-in members

SCREEN 4 — My Account:
- Membership card (Apple Wallet style): plan name, since date, next billing
- [Upgrade Membership] prominent button showing available tiers
- Credit balance with expiry dates
- Visit streak: "12 visits this month" with mini heatmap
- Personal records: "Longest cold plunge: 4 min" "Current streak: 8 weeks"
- Member discount status: "15% off merch — Active"
- Payment methods, profile, settings

Bottom tab nav: Home | Book | Community | Account

=============================================
DESIGN IMPERATIVES
=============================================

1. The AI briefing card on the Command Center MUST feel elevated — gradient border, subtle tint, it's the hero
2. Every metric number should be BOLD (semibold or bold weight) — these are the stars of the show
3. The indigo primary should be SATURATED (#4F46E5 at full strength) — not washed out or gray
4. The dashboard should feel ALIVE — activity feed scrolling, current class with pulse indicator, real-time counts
5. Information density should be HIGH but not overwhelming — every pixel earns its place
6. Navigation should feel instant — everything is 1-2 clicks from anything else
7. The mobile app should feel WARM and PREMIUM — not clinical, not corporate
8. Guided classes should always have a visual distinction (violet accent) from Open Sauna (indigo)
9. Trainer attribution (promo codes, fill rates, bonuses) should feel like a first-class feature, not an afterthought
10. The overall feeling: you're in command of your business, you have intelligence your competitors don't, and the tool is beautiful enough that you want to use it
```
