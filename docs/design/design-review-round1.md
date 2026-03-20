# Meridian UI — Design Review Round 1

**Tool Used:** MagicPath
**Prompt Tested:** Prompt 1 — Command Center (Home Dashboard)
**Date:** March 19, 2026

---

## What the tool got right

### Layout & Structure
- Left sidebar with Meridian branding, Cmd+K search bar, correct navigation items (Dashboard, Schedule, Members, Revenue, Marketing, Corporate, Operations, Analytics)
- Active state on Dashboard with indigo left border accent — exactly as specified
- User avatar at bottom (Zach M., Studio Owner) with Dark Mode toggle
- Four-row content layout matching the specified hierarchy

### AI Briefing Card
- "Good morning, Zach" greeting with sparkle icon
- All 3 specified insights present with correct content
- Action links (Add Slot, Send Campaign, Contact Account) present and styled as links

### Metrics Strip
- All 5 metrics rendered: Bookings Today (34), Live Occupancy (6/8), Revenue Today ($2,847), Walk-ins (7), No-Shows (1)
- Sparkline charts on each card
- Trend badges (+12%, Steady, +8.2%, +2, -50%)

### Live Facility Map
- 8 equipment units in a 2x4 grid layout
- Status indicators with dots (Occupied/Cleaning/Available/Maintenance)
- Member names on occupied units (Alex P., Sarah L., Marcus G., Elena R.)
- Countdown timers (12:45 remaining, 23:41 remaining, etc.)
- Utilization percentages per unit (88%, 94%, 72%, 65%, 81%, 45%, 91%, 77%)
- Expanded resource types beyond prompt (Infrared Room 1 & 2, Private Suite, Wellness Pod) — smart interpretation

### Today's Schedule
- Vertical timeline with time slots (8 AM through 4 PM visible)
- Booking blocks with member names and resource types
- Current time indicator (08:31 AM)

### Global Elements
- "Live Status: Healthy" indicator top right with green dot
- "+" floating action button top right
- Clean typography hierarchy

---

## What needs to be fixed

### Priority 1 — Visual Hierarchy Issues

**AI Briefing Card is too flat:**
- Currently blends in with the metrics strip below it — reads as just another card
- NEEDED: Subtle indigo-to-violet gradient border (1px) to elevate it as the hero element
- NEEDED: Slightly different background treatment (very subtle gradient or tint) to distinguish it from standard cards
- This card should be the first thing your eye lands on after the page title

**Typography weight on big numbers is timid:**
- $2,847, 34, 6/8 etc. should feel bolder and more confident
- Current weight appears to be medium — needs to be semibold or bold
- The numbers are the point of this strip — they should command attention

**Indigo primary is reading too gray/muted:**
- The sidebar active state and occupied dots need more saturation
- Target: #4F46E5 at full saturation, not desaturated
- The overall palette should feel confident and premium, not washed out

### Priority 2 — Missing Elements

**Activity Feed (Row 4) is completely absent:**
- The real-time event stream was specified as Row 4 and is not rendered at all
- This should be a compact scrolling list below the Facility Map / Schedule section
- Content: check-ins, new bookings, payments received, failed payments
- Each entry: timestamp + icon by type + event description + clickable
- This is a critical "alive" element — without it the dashboard feels static

**No "+" buttons on empty schedule slots:**
- The schedule timeline should have quick-add buttons on empty time slots
- This enables fast booking creation without leaving the dashboard

### Priority 3 — UX Refinements

**Facility map needs better scanability at a distance:**
- Status dots are too small to scan quickly from 3 feet away
- Available units should have a more pronounced visual treatment (subtle green tint/border on the card)
- Occupied units could have a subtle indigo tint
- Maintenance (Infrared Room 2) should feel more visually distinct — maybe a diagonal stripe pattern or more prominent red indicator

**Schedule timeline is clipped on the right edge:**
- Layout overflow — the schedule column content extends past the viewport
- Needs proper containment or the column proportions need adjustment (maybe 55/45 instead of 60/40)

**Color coding on booking blocks in schedule:**
- Currently the booking blocks in the schedule are all similar colors
- Should be color-coded by resource type (indigo = sauna, blue = cold plunge, violet = contrast, teal = recovery) matching the system defined in the prompt

### Priority 4 — Nice-to-Haves

- Cleaning status on Cold Plunge A shows "Resetting..." — nice touch but the amber color could be more distinct
- The "Interactive View" text link on the Facility Map section header could be a more prominent toggle/button
- Consider adding a subtle divider or spacing increase between Row 2 (metrics) and Row 3 (map/schedule) to create clearer visual grouping

---

## Changes for Next Iteration

If re-prompting or manually adjusting, address in this order:

1. Add indigo-to-violet gradient border on AI Briefing Card
2. Bold up the metric numbers (semibold/bold weight)
3. Add the Activity Feed as Row 4
4. Increase indigo saturation across the board
5. Add green tint to Available facility cards, increase status dot size
6. Fix schedule column overflow
7. Color-code schedule booking blocks by resource type
8. Add "+" quick-add buttons on empty schedule slots
