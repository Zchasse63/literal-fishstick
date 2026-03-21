# Layer Report: UI/UX

**Agent:** ui-ux
**Completed:** 2026-03-20
**Severity legend:** CRITICAL / HIGH / MEDIUM / LOW / INFO

---

## Executive Summary

Meridian's frontend is a well-crafted, design-system-consistent admin dashboard built on React 19 and Next.js 16 App Router. The visual language is coherent: deep indigo primary, framer-motion spring animations, shadcn/ui component primitives, lucide-react icons, and a sidebar-plus-header layout. The UI is information-dense without feeling cluttered. Several significant UX issues exist: hardcoded user identities, mock data on production pages, missing dark mode implementation, no accessibility audit, and no responsive design for mobile admin use.

---

## Component Hierarchy

### Layout Layer

```
AdminLayout (server-side route group)
├── CommandPalette (global overlay, ⌘K)
├── Sidebar
│   ├── Logo mark
│   ├── Search button (triggers CommandPalette)
│   ├── NavItems (10 items with framer-motion active pill)
│   └── Bottom section: dark mode toggle, user identity
└── Header
    ├── Breadcrumb
    └── Header actions

EmployeeLayout (separate route group)
├── Sidebar (collapsible)
│   ├── Logo + "Employee Portal" label
│   ├── Main nav (5 items)
│   ├── Trainer section (3 items)
│   └── Switch to Admin link
└── Header
    ├── Clock in/out status badge
    └── Notification bell
```

### Page-Level Components

| Module | Components Detected |
|--------|---------------------|
| Command Center | AI Briefing card, KPI metrics grid, Schedule Timeline, Activity Feed, Live Facility Map, AI Insight cards |
| Members | Search + filter bar, Member card grid, Slide-over profile panel (4 tabs: Overview, History, Financials, Communications), AI health score |
| Marketing | Campaign overview stats, Recent campaigns table with sparklines, Lead funnel chart, Automation overview |
| Analytics | KPI grid with trend indicators, Area chart (recharts), Pie chart, Heatmap, AI Recommendations panel |
| Employee Portal | Clock in/out button, Timesheet viewer, Pay stub display, Performance metrics |

### UI Primitives (shadcn/ui components in `/components/ui/`)

avatar, badge, button, calendar, card, chart, command, dialog, dropdown-menu, input, input-group, label, popover, progress, scroll-area, select, separator, sheet, skeleton, switch, table, tabs, textarea, tooltip

---

## Design System Analysis

### Token Consistency

The design tokens from CLAUDE.md are consistently implemented:
- `#4F46E5` indigo-600 — used in sidebar active states, logo, primary buttons
- `#F59E0B` amber — used in warning/action badges
- `#10B981` emerald — used for success states (clocked-in badge, active member)
- `#F97316` coral/orange — used in cancellation icons
- `#FAFAFA` near-white background — confirmed in employee layout
- `#F5F5F4` warm gray — card backgrounds

**AI visual treatment:** `from-indigo-600 to-violet-500` gradient on employee portal logo, AI cards use `Sparkles` icon with indigo coloring. The gradient border treatment described in CLAUDE.md is not yet implemented on AI insight cards — they use border-based styles instead.

### Typography

Inter/SF Pro is the specified font stack. The implementation uses the system font stack via Tailwind defaults (`font-sans`). No explicit `@font-face` or Google Fonts import found, which means SF Pro is used on Apple devices (correct) but no specific Inter loading is configured for non-Apple.

### Animation

Framer Motion is used thoughtfully:
- `layoutId="nav-pill"` creates a shared layout animation for the active sidebar indicator
- `fadeInUp` variants are consistently defined per page with `opacity: 0, y: 6` → `opacity: 1, y: 0` at 0.25s
- `AnimatePresence` used for panel transitions in members page
- Spring physics: `type: 'spring', bounce: 0.2, duration: 0.4` — appropriate for nav transitions

---

## Component Issues

### Hardcoded User Identity

**Admin sidebar:**
```
<p className="text-sm font-semibold text-gray-900 truncate">Zach M.</p>
<p className="text-xs text-gray-500">Studio Owner</p>
```

**Employee sidebar:**
```
<p className="text-sm font-semibold text-gray-900 truncate">Whitney C.</p>
<span>Trainer</span>
```

Both layouts display hardcoded names and roles. The `AuthContext` exists in `src/contexts/auth-context.tsx` but is not wired to the layout user displays.

### Mock Data in Production Pages

Marketing page (`/marketing/page.tsx`) contains `RECENT_CAMPAIGNS` mock data array defined inline as a TypeScript constant. Analytics page similarly contains extensive mock data for charts. These pages visually display data but do not fetch from the API, meaning admins see fabricated numbers in these modules.

### Dark Mode Toggle

Both sidebars have a "Light Mode"/"Dark Mode" toggle button. The admin sidebar renders `<Sun>` and "Light Mode" but the button has no `onClick` handler connected to a theme state. The employee sidebar has a proper `useState(darkMode)` and toggles a `dark` class on the root div, but only within the employee layout scope (not app-wide). Neither implementation uses `next-themes` or a proper CSS variable-based system.

### Clock In/Out Header Widget

The employee layout header has a `setClockedIn(!clockedIn)` toggle that uses local React state — it does not call `/api/clock`. This means the displayed clock status has no persistence.

### Realtime vs Polling

`use-realtime.ts` implements Supabase Realtime WebSocket subscriptions (not polling). However, the language detection file specifies "60s polling (Phase 1)." The `use-command-center-data.ts` hook likely uses polling. Both patterns exist. This inconsistency should be resolved before Phase 5.

---

## Accessibility Assessment

**No dedicated accessibility audit was performed** (no axe-core, no WAVE tool output available). Observed concerns:

- **Focus management:** The slide-over member profile panel does not visibly trap focus. When opened, keyboard users can tab to elements behind the overlay.
- **Color contrast:** Indigo-50 text on white (`text-indigo-700 on bg-indigo-50`) — likely meets WCAG AA for normal text. Gray-500 text on white background may fail for smaller text sizes.
- **ARIA:** No explicit `aria-label` or `role` attributes observed on interactive nav items or custom components. shadcn/ui components (Dialog, Sheet) include ARIA by default; custom elements do not.
- **Keyboard nav:** The `CommandPalette` (⌘K) appears to use `cmdk` which provides keyboard navigation out of the box. Custom sidebar nav items use standard `<Link>` elements which are keyboard-accessible.

---

## Responsive Design Assessment

The admin layout has a fixed sidebar (`w-[240px]` or `w-[72px]` when collapsed) and a fixed header (`pt-16`). The main content area uses `max-w-7xl mx-auto` with `p-5 md:p-7`. No breakpoints below `md` are accounted for. On mobile viewports:
- The sidebar overlaps the main content
- No mobile hamburger menu or bottom navigation exists
- The layout is not usable on screens below ~1024px

This is acceptable for an admin dashboard intended for desktop use, but should be documented. The employee portal is more likely to be accessed on mobile (employees clock in/out from their phones), yet its layout has the same fixed sidebar constraint.

---

## Findings

**HIGH — Mock data displayed as real data in Marketing and Analytics pages:**
`/marketing/page.tsx` renders `RECENT_CAMPAIGNS` with hardcoded campaign names, open rates, and revenue attribution. `/analytics/page.tsx` contains extensive hardcoded KPI values and chart data. These pages are in production and show fabricated numbers to administrators, potentially leading to incorrect business decisions.

**HIGH — Clock in/out widget uses local state, not API:**
The employee portal header's clock in/out badge updates `useState` only. No call to `/api/clock` is made. Employees who interact with the header badge are not actually clocking in or out in the database.

**MEDIUM — User identity hardcoded in both layout sidebars:**
Neither layout reads from `AuthContext`. This must be resolved before any second user can log in, as every user would see "Zach M." and "Whitney C." as their identity.

**MEDIUM — Dark mode toggle is non-functional in admin layout:**
The admin sidebar's dark mode button has no `onClick` handler. Clicking it has no effect. The employee portal dark mode works locally but is not persisted to `localStorage` or applied app-wide.

**MEDIUM — No mobile layout for employee portal:**
Employees are the most likely users to access Meridian from a mobile device (clock in, check schedule). The current fixed-sidebar layout does not adapt to mobile viewports.

**LOW — AI gradient border treatment not implemented:**
CLAUDE.md specifies "subtle indigo-to-violet gradient border on AI insight cards." Current implementation uses standard border-based styles. The visual differentiation for AI-generated content is incomplete.

**LOW — Sidebar shortcut key collision (corroborates project-structure finding):**
Analytics and Segments both have `shortcut: '8'` in the nav items array. The `⌘8` shortcut will activate the first match (Analytics), making Segments unreachable by keyboard shortcut.

**INFO — framer-motion `layoutId` conflict in employee sidebar:**
Both `trainerNav` and `mainNav` links in the employee layout use `layoutId="employee-nav-pill"`. When a trainer nav item is active, the pill may animate from the main nav incorrectly. Each section should have its own `layoutId`.

---

## Findings Summary

| Severity | Count | Items |
|----------|-------|-------|
| CRITICAL | 0 | — |
| HIGH | 2 | Mock data on production pages, clock widget disconnected from API |
| MEDIUM | 3 | Hardcoded user identity, broken dark mode, no mobile employee layout |
| LOW | 2 | AI gradient treatment missing, shortcut collision |
| INFO | 1 | framer-motion layoutId conflict |
