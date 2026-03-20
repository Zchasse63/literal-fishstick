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
