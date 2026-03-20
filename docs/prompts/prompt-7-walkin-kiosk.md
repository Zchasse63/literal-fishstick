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
