# Layer Report: UI/UX Architecture

**Agent:** ui-ux
**Date:** 2026-04-08
**Status:** Complete

---

## Executive Summary

Meridian's admin dashboard implements a sophisticated, information-dense UI built on a consistent design system. The layout architecture follows a fixed-sidebar + fixed-header pattern with collapsible navigation, dark mode support, Framer Motion animations, and a Cmd+K command palette. The design system uses Tailwind CSS v4 with shadcn/ui primitives and a well-defined Meridian color palette (indigo-600 primary, emerald success, amber warning). Two distinct portals share the same design language: the Admin Dashboard (8 modules) and the Employee Portal (7 sections). Key concerns are accessibility gaps (ARIA labels are inconsistent, keyboard navigation outside nav items is limited) and the absence of mobile-responsive design for the admin dashboard (fixed pixel sidebar widths).

---

## Component Hierarchy

### Layout Layer
```
AdminShell (client component)
├── CommandPaletteProvider (context)
│   └── CommandPalette (Cmd+K dialog, cmdk library)
├── Sidebar (fixed left, collapsible 72px ↔ 240px)
│   ├── Logo block
│   ├── NAV_ITEMS (9 items: Command Center → Settings)
│   └── User identity + theme toggle + logout
├── Header (fixed top, auth-aware)
│   ├── Breadcrumbs
│   └── Search trigger + notifications
└── main (pt-16, pl-[72px|240px], max-w-7xl)
    └── {page children}

EmployeeLayout (client component — separate shell)
├── Sidebar (fixed left, collapsible 64px ↔ 220px)
│   ├── Logo (gradient indigo → violet)
│   ├── mainNav (5 items: Home, Schedule, Timesheets, Pay, Profile)
│   ├── trainerNav (3 items: Classes, Performance, Promo Code)
│   ├── "Switch to Admin" link
│   └── Theme toggle + user identity
└── Header (fixed top, clock-in/out button + notifications)
```

### Shared UI Primitives (shadcn/ui — 29 components)
`avatar`, `badge`, `button`, `calendar`, `card`, `chart`, `command`, `dialog`, `dropdown-menu`, `input-group`, `input`, `label`, `popover`, `progress`, `scroll-area`, `select`, `separator`, `sheet`, `skeleton`, `switch`, `table`, `tabs`, `textarea`, `toast-notification`, `tooltip`

### Page-Level Client Components
Each admin module follows the pattern:
- `page.tsx` (Server Component) — data fetching, auth check, renders Client
- `[Module]Client.tsx` (Client Component) — all interactivity, state, UI

Notable complex client components:
- `CampaignsClient.tsx` — multi-step campaign builder with A/B test config
- `AutomationsClient.tsx` — ReactFlow-powered visual flow builder
- `MemberProfilePanel.tsx` — slide-over panel with member 360 view
- `AIInsightsClient.tsx` — AI insight cards with urgency styling
- `PricingSimulatorClient.tsx` — pricing scenario editor with AI analysis
- `ReportLibraryClient.tsx` — report builder with filter/column config
- `EventCalendarClient.tsx` — calendar event management
- `PayrollClient.tsx` — payroll period calculation and approval

---

## Design System Analysis

### Color Tokens
| Token | Value | Usage |
|-------|-------|-------|
| Primary | `indigo-600` / `#4F46E5` | Nav active state, CTAs, AI borders |
| Background | `#FAFAFA` | Light mode page background |
| Card | `#F5F5F4` | Light mode card surfaces |
| Dark BG | `#0F0F11` | Dark mode page background |
| Dark Card | `#1A1A1F` | Dark mode card surfaces |
| Success | `emerald-500` / `#10B981` | Check-in status, positive metrics |
| Warning | `amber-500` / `#F59E0B` | Alert states, at-risk indicators |
| Error | `rose-500` | Negative metrics, critical states |

### Typography
- Font: Inter (system fallback to SF Pro on Apple devices)
- Navigation: `text-sm font-medium`
- Headings: `text-xl font-bold` to `text-3xl font-bold`
- Labels: `text-[10px] font-bold uppercase tracking-widest` (category labels)

### Animation
- Framer Motion used throughout:
  - `layoutId="nav-pill"` — animated active nav indicator (shared motion)
  - `layoutId="employee-nav-pill"` — employee portal nav
  - Transition: `spring, bounce: 0.2, duration: 0.4`
  - Global animation config exported from `lib/motion.ts`

### Dark Mode
- Full dark mode via `useTheme` context + `toggleDark()`
- Implemented via Tailwind's `dark:` prefix
- Consistent dark variants on all layout components
- User preference persisted via context (no localStorage check confirmed — may not persist across sessions)

### Command Palette
- Trigger: `Cmd+K` (keyboard shortcut via `document.addEventListener`)
- Also `Cmd+1` through `Cmd+9` for direct module navigation
- Groups: Navigation, Quick Actions, Employee Portal
- Quick Actions: New Class, Add Member, Record Payment, New Campaign, Smart Segments, Engagement
- Built on `cmdk` library with shadcn command component

---

## Accessibility Findings

### ARIA Implementation
- Sidebar collapse button: `aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}` — correct
- Dark mode toggle: `aria-label` present — correct
- Clock-in/out button: `aria-label` not present — missing
- Notification bell: `aria-label="Notifications"` — correct
- CommandDialog: `title` and `description` props set — correct
- Keyboard shortcuts documented but no ARIA keyboard hint attributes on nav items

### Semantic HTML
- Navigation uses `<aside>` and `<nav>` — correct
- Main content wrapped in `<main>` — correct
- `<header>` element used for fixed header — correct
- Interactive nav items use `<Link>` (renders as `<a>`) — correct

### Focus Management
- No visible focus ring customization observed in Tailwind config
- Framer Motion animated overlays (nav pill) may intercept focus events
- No focus trap implementation for the command palette (handled by cmdk library)
- Sheet/Dialog components from shadcn use Radix UI which has built-in focus management

### Color Contrast
- `text-gray-400 dark:text-gray-500` on light background — borderline contrast ratio (~3.8:1, below WCAG AA 4.5:1 for body text)
- Category labels at `text-[10px]` with `text-gray-400` — likely fails WCAG contrast at this size
- Active nav: `text-indigo-700 bg-indigo-50` — adequate contrast

### Mobile Responsiveness
- Admin sidebar uses fixed pixel widths: `w-[72px]` (collapsed) and `w-[240px]` (expanded)
- Main content: `pl-[72px]` or `pl-[240px]` offset + `max-w-7xl`
- No mobile breakpoint handling for the sidebar — on small screens the sidebar pushes content off-screen
- The `md:p-7` padding upgrade is the only mobile-specific breakpoint found
- Admin dashboard appears designed exclusively for desktop/tablet

---

## Findings

### CRITICAL
None.

### HIGH
- **HIGH-UX-001:** The admin dashboard has no mobile-responsive layout. Fixed pixel sidebar widths (`w-[240px]`) push content off-screen on mobile and tablet viewports. While the current use case is desktop-only, any Phase 5 or future use from a tablet (e.g., front-desk iPad kiosk) would be broken.

### MEDIUM
- **MED-UX-001:** Dark mode preference is stored in React context (`useTheme`) but there is no persistence layer observed (localStorage, cookie, or user profile setting). Dark mode preference will be lost on page refresh.
- **MED-UX-002:** The command palette quick actions reference URL params like `?action=new-class` and `?action=add-member` but it's unclear if these are handled in the destination pages — if they're not consumed, the command palette "quick actions" are misleading (they navigate to a page but don't open the modal/form).
- **MED-UX-003:** `text-[10px] font-bold uppercase tracking-widest text-gray-400` category labels likely fail WCAG AA contrast requirements. This pattern appears in both the admin sidebar and employee portal sidebar section headers.

### LOW
- **LOW-UX-001:** No loading skeletons observed for the primary nav items — when auth context loads slowly, nav items may flash or appear incorrectly.
- **LOW-UX-002:** The command palette doesn't include search functionality for members, campaigns, or classes — it only lists static navigation options and quick actions. A true "search everywhere" with live results (à la Linear or Notion) is expected from the design spec but not implemented.
- **LOW-UX-003:** The employee portal shows a "Trainer" section in the sidebar for all employees, but it should conditionally render based on the `trainer` role. Currently if a non-trainer employee views the portal, they see the trainer navigation section.

### INFO
- **INFO-UX-001:** Framer Motion `layoutId` for the nav indicator (`"nav-pill"`) is shared between admin and employee layouts in the same page context — if both layouts ever render simultaneously, there would be a Framer Motion conflict. Current architecture prevents this (separate route groups) so it's safe.
- **INFO-UX-002:** The design system closely matches the described spec: deep indigo primary, emerald success, amber warning, information-dense layout. The implementation faithfully translates the design philosophy.
- **INFO-UX-003:** 29 shadcn/ui primitives are installed — this is a well-stocked component library that provides good baseline accessibility and keyboard navigation.
