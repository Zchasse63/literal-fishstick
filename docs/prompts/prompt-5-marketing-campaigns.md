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
