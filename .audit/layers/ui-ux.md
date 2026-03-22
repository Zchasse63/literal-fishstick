# Layer Report: UI/UX

**Agent:** ui-ux
**Completed:** 2026-03-22
**Severity legend:** CRITICAL / HIGH / MEDIUM / LOW / INFO

---

## Executive Summary

Meridian's admin dashboard is visually polished and architecturally coherent. The design system is well-defined in `globals.css` with proper CSS custom properties, Inter is loaded globally, and shadcn/ui primitives handle the low-level component layer cleanly. The visual aesthetic (indigo primary, warm-gray surfaces, 2xl rounded cards, spring animations via framer-motion) is applied consistently across all pages.

The audit uncovered no catastrophic layout breaks, but it did surface a cluster of HIGH-severity broken interactions — buttons that render correctly but have no `onClick` handler and therefore silently do nothing when clicked. These are the most urgent items to address because they create a broken product experience on first contact.

The second major category is data integrity: a significant number of pages (Analytics, Operations, Corporate, Engagement, Marketing) display hardcoded mock data, including real business names (Tampa Bay Buccaneers, The Sauna Guys) and hardcoded staff names (Whitney Cooper, Jake Martinez) that will embarrass the product if shown to any user other than the original developer.

Accessibility is the weakest area of the codebase. Across all admin pages, only one `aria-label` attribute exists. Labels are not associated to inputs via `htmlFor`/`id` pairs. There are no `focus-visible` styles on custom buttons. Keyboard navigation beyond basic tab order is unimplemented.

---

## 1. Broken Interactions

### HIGH — "Add Member" button has no `onClick` handler

**File:** `apps/web/src/app/(admin)/members/page.tsx`, line 496–499

```tsx
<button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 ...">
  <Plus className="h-4 w-4" />
  Add Member
</button>
```

The button renders and accepts hover/focus states but clicking it does nothing. No modal state, no route navigation, no form sheet is triggered. The Command Palette routes `Add Member` to `/members?action=add-member` (command-palette.tsx line 49), but `members/page.tsx` never reads `useSearchParams`, so even that path is a dead end. This is the user-reported bug.

**Fix:** Add a modal/sheet state variable, wire the button's `onClick` to open it, and read the `?action=add-member` param on mount to auto-open it when navigated from the command palette.

---

### HIGH — "New Class" button has no `onClick` handler

**File:** `apps/web/src/app/(admin)/schedule/page.tsx`, line 559–562

```tsx
<button className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 ...">
  <Plus className="w-4 h-4" />
  New Class
</button>
```

The schedule page's primary call-to-action renders with no handler. Similarly, the "Check In All", "Send Reminder", and "Edit Class" buttons inside the `ClassDetailPanel` component (lines 329–341) are all presentation-only with no `onClick`.

---

### HIGH — "Quick Create" header button has no `onClick` handler

**File:** `apps/web/src/components/layout/header.tsx`, line 72–75

```tsx
<button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 ...">
  <Plus className="w-4 h-4" />
  <span className="hidden sm:block">Quick Create</span>
</button>
```

This button appears on every admin page in the fixed header. It is the most visible action in the entire UI and does nothing when clicked. The Bell (Notifications) button on line 66–69 is likewise clickable-styled with no handler.

---

### HIGH — LogOut button in admin sidebar has no `onClick` handler

**File:** `apps/web/src/components/layout/sidebar.tsx`, line 167–170

```tsx
<button className="text-gray-400 hover:text-gray-600">
  <LogOut className="w-4 h-4" />
</button>
```

`signOut` from Supabase Auth is never called. The `useAuth` context is imported and used for reading `profile`, but signing out requires an `onClick` that calls `supabase.auth.signOut()`. As a result, users cannot log out.

---

### HIGH — "Save Account" button on Corporate New form has no `onClick`

**File:** `apps/web/src/app/(admin)/corporate/new/page.tsx`, line 68–71

The entire Corporate New Account form (company info, contact, billing, contract terms) is built with uncontrolled inputs that have no `name` attributes, no `<form>` wrapper, and no `onSubmit`. The "Save Account" button has no `onClick`. None of the field data can be collected or submitted.

Additionally, all `<label>` elements in this form are not associated to their inputs — they have no `htmlFor` attribute, and the inputs have no `id` attribute (lines 91–190). Clicking a label does not focus its input.

---

### HIGH — Day and Month calendar views are unimplemented stubs

**File:** `apps/web/src/app/(admin)/schedule/page.tsx`, line 356

The Schedule page displays a three-way toggle for Day / Week / Month views. The Week view is fully implemented. Clicking "Day" or "Month" updates the `viewMode` state but there is no conditional branch rendering a different layout — the week grid always renders. Users can click these buttons and see no change, with no indication the feature is unavailable.

---

### MEDIUM — Command Palette quick actions produce dead URLs

**File:** `apps/web/src/components/command-palette.tsx`, lines 48–53

Quick actions route to `?action=add-member`, `?action=new-class`, `?action=record-payment`, etc. None of the target pages (`members/page.tsx`, `schedule/page.tsx`, `revenue/page.tsx`) read `useSearchParams` or handle these parameters. Selecting a quick action navigates to the correct page but no modal or action opens.

---

### MEDIUM — MoreHorizontal (context menu) button on member rows has no menu

**File:** `apps/web/src/app/(admin)/members/page.tsx`, line 656–660

Each member row has an actions column with a `MoreHorizontal` button that calls `e.stopPropagation()` but opens no dropdown, context menu, or sheet.

---

### LOW — "Email" and "Call" buttons in member detail panel have no handlers

**File:** `apps/web/src/app/(admin)/members/page.tsx`, lines 741–748

The Email and Call quick-action buttons in the member profile sidebar have no `onClick`. Neither opens a compose dialog, nor triggers a `mailto:` or `tel:` link.

---

### LOW — AI insight action buttons ("Send re-engagement", "View details") have no handlers

**File:** `apps/web/src/app/(admin)/members/page.tsx`, lines 859–862, 876–879

The AI Predictive Insights panel renders contextual action buttons that look interactive (indigo text, ArrowUpRight icon, hover state) but have no `onClick`.

---

## 2. Error Handling in UI

### MEDIUM — Schedule page error was previously broken; now correctly handled

**File:** `apps/web/src/app/(admin)/schedule/page.tsx`, line 568

The error display now correctly renders `{classesError.message}` rather than `{classesError}`. The `useQuery` hook (use-supabase.ts line 110) properly normalizes errors: `err instanceof Error ? err : new Error(String(err))`. This bug is resolved.

---

### MEDIUM — Segments page renders raw error string (safe but inconsistent)

**File:** `apps/web/src/app/(admin)/segments/page.tsx`, lines 150, 195

```tsx
const [error, setError] = useState<string | null>(null)
// ...
setError(err instanceof Error ? err.message : 'Failed to load segments')
// ...
<p className="mt-1 text-xs text-gray-400">{error}</p>
```

This is technically correct (storing a string, not an Error object), but error handling is inconsistent across the codebase. The schedule page uses the `useQuery` hook which normalizes errors; the segments page fetches via `fetch()` and manages its own error string. The pattern should be standardized.

---

### MEDIUM — Members and Revenue pages silently swallow errors

**File:** `apps/web/src/app/(admin)/members/page.tsx`, lines 309–313; `apps/web/src/app/(admin)/revenue/page.tsx`

When the members fetch fails, the code calls `console.error` and `setMembers([])`. No error banner or retry button is shown to the user — they see an empty table with "No members found matching your search." There is no way for the user to know a network error occurred vs. no members existing.

---

### INFO — Global `error.tsx` boundary is well-implemented

**File:** `apps/web/src/app/error.tsx`

The root error boundary correctly catches unhandled React errors, exposes dev-only stack traces inside a `<details>`, and provides a retry button. This is good.

---

## 3. Hardcoded Data and Strings

### HIGH — Analytics page KPIs are hardcoded mock strings, not real data

**File:** `apps/web/src/app/(admin)/analytics/page.tsx`, lines 88–93

```tsx
{ label: 'MRR', value: '$18,420', trend: 12.3, ... }
{ label: 'ARPM', value: '$67.40', trend: 4.2, ... }
{ label: 'Active Members', value: '273', trend: 8.1, ... }
{ label: 'Avg Fill Rate', value: '71%', trend: 5.6, ... }
{ label: 'Revenue MTD', value: '$24,850', trend: 9.7, ... }
```

These numbers will never change and do not reflect any real database query. The Analytics page is labeled Phase 3, so this is expected for now, but the values are specific enough to look real and will mislead users.

---

### HIGH — Corporate pages contain real business names as mock data

**Files:** `apps/web/src/app/(admin)/corporate/page.tsx` (lines 63–84); `apps/web/src/app/(admin)/corporate/events/page.tsx` (lines 44–50); `apps/web/src/app/(admin)/corporate/[id]/page.tsx` (lines 44–53)

Real business names appear as hardcoded mock data:
- `'Tampa Bay Buccaneers'`
- `'The Sauna Guys'`
- `'USAA Tampa'`
- Addresses: `'1 Buccaneer Pl, Tampa, FL 33607'`

This is appropriate for a single-tenant demo but is a blocker for any SaaS or multi-tenant scenario and should be clearly marked.

---

### HIGH — Operations, Payroll, and Documents pages display hardcoded staff

**Files:** `apps/web/src/app/(admin)/operations/page.tsx` (line 94+); `apps/web/src/app/(admin)/operations/payroll/page.tsx` (line 84); `apps/web/src/app/(admin)/operations/documents/page.tsx` (lines 58–155)

Staff names `'Whitney Cooper'`, `'Jake Martinez'`, `'Elena Volkov'`, etc. are hardcoded in mock data arrays. The payroll page shows their exact hours, pay rates, and estimated net pay as static numbers.

---

### MEDIUM — Member profile sidebar shows hardcoded session preferences

**File:** `apps/web/src/app/(admin)/members/page.tsx`, lines 343–346

```tsx
preferredTime: '6:00 PM',
preferredType: 'Open Sauna',
guidedSessions: 0,
avgDuration: '50 min',
```

Every member shows identical "Session Preferences" values because these fields are not in the database query and are hardcoded during the mapping step. The "Preferred Time" and "Preferred Type" appear credible enough to be mistaken for real data.

---

### MEDIUM — Members page pagination is a hardcoded stub

**File:** `apps/web/src/app/(admin)/members/page.tsx`, line 685

```tsx
<span className="text-xs text-gray-500">Page 1 of 1</span>
```

The footer shows "Showing N of M members · Page 1 of 1" with no next/previous buttons. The query is `LIMIT 50` with no offset. If a studio has more than 50 members, results are silently truncated.

---

### MEDIUM — Member "Next Billing" and "Payment Method" are hardcoded

**Files:** `apps/web/src/app/(admin)/members/page.tsx` (lines 341–342); `apps/web/src/app/(admin)/members/[id]/page.tsx` (line 233)

```tsx
nextBilling: row.membership_status === 'paused' ? 'Paused' : 'N/A',
paymentMethod: 'On file',
```

`nextBilling` always shows "N/A" for active members instead of pulling the actual Stripe billing anchor date. `paymentMethod` always shows "On file" regardless of what payment method Stripe has on record.

---

### MEDIUM — Visit Activity heatmap on member profile is randomized static data

**File:** `apps/web/src/app/(admin)/members/page.tsx`, lines 204–217

```tsx
const heatmapData = generateHeatmap()  // module-level, Math.random()
```

The heatmap is generated once at module initialization using `Math.random()`. Every member shows the same random pattern (seeded at page load). This can also cause a React hydration mismatch because server and client will generate different random values.

---

### LOW — Corporate New form has hardcoded initial tags

**File:** `apps/web/src/app/(admin)/corporate/new/page.tsx`, line 27

```tsx
const [tags, setTags] = useState<string[]>(['enterprise', 'tampa'])
```

New corporate account forms pre-populate with `['enterprise', 'tampa']` as default tags, which are specific to The Sauna Guys' use case.

---

## 4. Typography Inconsistency

### MEDIUM — Arbitrary font sizes bypass the type scale

**Files:** All admin pages (585 instances of `text-[10px]`, 29 instances of `text-[28px]`, 19 instances of `text-[11px]`, 8 instances of `text-[9px]`, 2 instances of `text-[8px]`, 1 instance of `text-[42px]`)

The Tailwind design system provides a clean type scale (`text-xs` = 12px, `text-sm` = 14px, `text-base` = 16px, etc.). The codebase instead uses arbitrary values for two primary patterns:

1. `text-[10px]` — used for uppercase section labels (`MEMBER`, `TIME`, `MEMBERSHIP`, etc.). This is a consistent design choice but bypasses the design system token. Should be a custom utility class like `text-label`.
2. `text-[28px]` — used for large metric values in stat cards (MRR, visit counts). Also consistent but arbitrary.
3. `text-[11px]` — used inconsistently as a "between xs and sm" size in various detail panels.

The pattern is visually consistent but makes global type scale changes impossible without grep-replacing hundreds of instances.

---

### LOW — `font-black` (weight 900) used for metric numbers; no design token defines this

Metric values use `font-black` (tw weight 900) across stat cards. This is consistent but undocumented in the design system. The design guide should establish when `font-black` vs `font-bold` vs `font-semibold` is appropriate.

---

## 5. Spacing and Layout Consistency

### HIGH — Many pages override the layout's padding with their own `min-h-screen` wrappers

**Files:** 48 admin pages use `min-h-screen bg-[#FAFAFA]` at the page component root level

The admin layout (`(admin)/layout.tsx`) already provides:
- `pt-16` (header height)
- `pl-[240px]` or `pl-[72px]` (sidebar width)
- `p-5 md:p-7` inner padding
- `max-w-7xl mx-auto` container

Despite this, 48 page files add their own `min-h-screen bg-[#FAFAFA] p-6` or similar wrappers. This double-wraps the padding (the layout gives 5/7 units, the page adds 6 more) and creates inconsistent effective padding across pages. Pages in the `(admin)` group should not redeclare `min-h-screen` or `bg-[#FAFAFA]` — the layout already handles both.

---

### MEDIUM — Employee portal sidebar width is 220px; admin sidebar is 240px

**Files:** `apps/web/src/app/(employee)/layout.tsx` (line 108, `w-[220px]`); `apps/web/src/components/layout/sidebar.tsx` (line 82, `w-[240px]`)

The 20px difference is unlikely to be intentional. Both collapsed states differ too: employee is `w-16` (64px), admin is `w-[72px]`. These should be unified via CSS variables that are already defined: `--sidebar-width: 240px` and `--sidebar-collapsed: 72px` in `globals.css`.

---

### MEDIUM — Member detail panel stat cards use three different font size patterns

**File:** `apps/web/src/app/(admin)/members/page.tsx`

The profile sidebar uses three distinct stat card treatments:
- Line 776: `text-[28px] font-black` for LTV / Visits / Avg Visits
- Line 788: `text-lg font-bold` for Credits / Last Visit
- Line 892: `text-sm font-semibold` for Membership Price

These three visual weights create hierarchy but are inconsistent in their scale — they were chosen independently rather than from a defined card system.

---

## 6. Color System

### MEDIUM — 51 instances of hardcoded hex colors in admin pages

**Files:** Multiple admin pages use `bg-[#FAFAFA]`, `bg-[#0F0F11]`, etc.

CSS custom properties `--background`, `--card`, `--color-surface` are defined in `globals.css` and the `@theme inline` block maps them to Tailwind utilities. Pages should use `bg-background` instead of `bg-[#FAFAFA]`. The `error.tsx` and `not-found.tsx` also hardcode `bg-[#FAFAFA]`.

---

### LOW — Dark mode toggle in sidebar toggles the class correctly, but page content does not respond

**Files:** All admin pages

The sidebar correctly adds/removes the `dark` class to `document.documentElement`. The CSS variables for dark mode are properly defined in `globals.css`. However, all page-level Tailwind classes use hardcoded light-mode values (`bg-white`, `border-gray-200`, `text-gray-900`) with no `dark:` variants. Only 0 instances of `dark:bg-*` or `dark:text-*` exist across all admin pages. Dark mode is visually defined in the token system but never applied in the component layer. The sidebar and header go dark (they use CSS variables via shadcn), but the main content area does not.

---

## 7. Accessibility

### HIGH — Essentially no ARIA attributes across all admin pages

**Files:** All admin pages (`apps/web/src/app/(admin)/`)

Across all 45+ admin page files, only one `aria-label` attribute exists:

```tsx
// apps/web/src/app/(admin)/marketing/automations/page.tsx:235
aria-label={active ? 'Deactivate automation' : 'Activate automation'}
```

All other interactive elements — navigation links, icon-only buttons, chart containers, modal close buttons, filter pills, tab controls — have no ARIA labels. Icon-only buttons (LogOut, X close, Bell, ChevronLeft/Right, MoreHorizontal) are completely opaque to screen readers.

---

### HIGH — Form labels are not associated with their inputs

**File:** `apps/web/src/app/(admin)/corporate/new/page.tsx`, lines 91–190

All form labels use bare `<label>` elements with no `htmlFor` attribute. All inputs have no `id` attribute. This means:
- Clicking a label does not focus its input (broken for mouse users, not just screen readers)
- Screen readers cannot announce which label belongs to which field

---

### MEDIUM — Custom interactive elements lack focus-visible styles

**Files:** All admin pages

Native `<button>` elements rely on the browser's default focus ring, which is often suppressed by `focus:outline-none` applied broadly (122 instances across admin pages). No `focus-visible:ring-2 focus-visible:ring-indigo-500` pattern is applied to custom buttons. Keyboard users cannot see which element is focused.

The single exception is the shadcn `<Select>` in `settings/page.tsx` which uses `focus-visible:border-ring focus-visible:ring-3`.

---

### MEDIUM — No `tabIndex` management in custom interactive elements

Interactive elements like the schedule's week navigation buttons, the member row table rows (which act as clickable items), and the class block cards in the schedule view are not in the natural tab order in a predictable way. Table rows with `onClick` are not reachable via keyboard.

---

### MEDIUM — Viewport meta tag is absent from root layout

**File:** `apps/web/src/app/layout.tsx`

Next.js does not automatically inject a viewport meta tag in App Router. The `<html>` element has `lang="en"` (good) but there is no `export const viewport` export or `<meta name="viewport">`. On mobile devices, the admin dashboard will render at desktop scale without pinch-to-zoom control.

**Fix:** Add to `layout.tsx`:
```tsx
export const viewport = {
  width: 'device-width',
  initialScale: 1,
}
```

---

### LOW — `alt` attributes are absent from all images (no images used)

No `<img>` or `<Image>` tags exist in admin pages — all avatars use initials in colored `<div>` elements. This is fine and actually better for accessibility than placeholder images.

---

## 8. Responsive Design

### MEDIUM — Admin pages are designed for 1280px+ and degrade gracefully only to ~768px

The admin layout uses responsive breakpoints (`hidden md:table-cell`, `hidden lg:table-cell`, `sm:flex`) to collapse table columns on smaller screens. The member table hides Membership at `<768px` and Last Visit/LTV at `<1024px`. This is appropriate for a data-dense admin dashboard.

However, the `max-w-7xl` container with `pl-[240px]` sidebar means the effective content width at 1280px is only ~900px. At 1024px it is only ~640px. At 768px the sidebar overlaps the content (the sidebar is `fixed` but the layout's padding is only responsive to the sidebar's pixel width, not viewport width).

There is no mobile drawer/overlay pattern for the sidebar at small viewports. At widths below ~900px, the collapsed sidebar (72px) leaves the main content at ~700px wide, which is acceptable for tablets in landscape but cramped for most tablet-portrait and all phone viewports.

---

### LOW — The Schedule week grid has `min-w-[700px]` but no fallback for narrow viewports

**File:** `apps/web/src/app/(admin)/schedule/page.tsx`, line 584

The calendar table has `overflow-x-auto` wrapping correctly, so it scrolls horizontally on small screens. This is acceptable.

---

## 9. Loading States

### INFO — Loading states are well-implemented across core pages

All live-data pages implement loading states:
- Schedule: `ScheduleSkeleton` (table-shaped Skeleton grid)
- Members: `MemberRowSkeleton` (6 placeholder rows with animated pulse)
- Command Center: `CommandCenterSkeleton` (matching card shapes)
- Employee portal: `Loader2` spinner while data loads

The `Skeleton` component from shadcn/ui (`components/ui/skeleton.tsx`) is used consistently. This is a strength of the codebase.

---

## 10. Empty States

### LOW — Empty state on Members page text is ambiguous

**File:** `apps/web/src/app/(admin)/members/page.tsx`, line 668–671

When no members match search or filter, the table shows: "No members found matching your search." This message is shown even when no search is active and the filter tab is "All" — for example, when the database query fails and `setMembers([])` is called silently. The user cannot distinguish between "no results" and "error."

---

### LOW — Schedule page empty time slots show an invisible plus button

**File:** `apps/web/src/app/(admin)/schedule/page.tsx`, lines 625–630

Empty calendar cells contain a hidden `<button>` that appears on hover (`opacity-0 hover:opacity-100`). This button has no `onClick`. The hover affordance is promising but the interaction goes nowhere.

---

## 11. Performance Patterns

### INFO — No code splitting or lazy loading used for heavy pages

The Marketing Campaigns builder (`marketing/campaigns/new/page.tsx`, 1,337 lines) and the Automations builder (`marketing/automations/new/page.tsx`, 790 lines) are loaded eagerly. These pages import `@dnd-kit` and `reactflow` respectively. No `dynamic()` import or `React.lazy()` is used anywhere in the app. For a dashboard app this is acceptable (server-side rendering handles initial payload), but the drag-and-drop libraries add significant client bundle weight.

---

### INFO — `Math.random()` called at module level will cause React hydration mismatches

**Files:** `apps/web/src/app/(admin)/members/page.tsx` (line 217); `apps/web/src/app/(admin)/analytics/reports/[id]/page.tsx` (lines 81–100)

```tsx
const heatmapData = generateHeatmap()  // module-level call
const MOCK_ROWS = generateRows()        // module-level call
```

Module-level `Math.random()` executes during server-side rendering and again during client hydration, producing different values each time. React will log a hydration mismatch warning. These should be moved into `useEffect` or replaced with seeded/deterministic data.

---

### INFO — 60-second polling is active on all `useQuery` calls with `poll: true`

**File:** `apps/web/src/hooks/use-supabase.ts`, lines 123–131

Three hooks poll every 60 seconds by default: `useMembers`, `useClasses`, `useBookings`. The activity log also polls (line 274). This is the Phase 1 design decision and is acceptable, but it means every user session generates continuous database queries regardless of page activity.

---

## 12. Component Size and Splitting

### MEDIUM — Several page files exceed 1,000 lines and contain multiple co-located sub-components

| File | Lines | Issue |
|------|-------|-------|
| `marketing/campaigns/new/page.tsx` | 1,337 | Campaign builder with step wizard, preview, scheduling — should be split |
| `revenue/page.tsx` | 1,295 | Overview, Memberships, and Transactions tabs in one file |
| `operations/page.tsx` | 1,123 | Employee directory, schedule, payroll, and permissions in one file |
| `members/page.tsx` | 1,152 | Directory + full profile panel with 4 tabs |
| `analytics/page.tsx` | 874 | Multiple chart types, heatmap, AI recommendations |

These files define multiple components (skeleton, card, panel, tab content) inline rather than extracting them. This is not a runtime problem but makes the files hard to maintain and test.

---

## Findings Summary

| Severity | Count | Items |
|----------|-------|-------|
| CRITICAL | 0 | — |
| HIGH | 8 | Add Member no onClick, New Class no onClick, Quick Create no onClick, LogOut no onClick, Corporate form not wired, Day/Month views stub, Analytics KPIs hardcoded, Corporate/Ops mock data with real names |
| MEDIUM | 14 | Command palette dead params, member context menu, error handling inconsistency, dark mode non-responsive, ARIA absent, form labels unassociated, focus-visible missing, viewport meta absent, type scale arbitrary values, spacing double-wrap, sidebar width mismatch, member detail stat hierarchy, visit heatmap random data, pagination stub |
| LOW | 9 | AI insight buttons no handler, email/call buttons no handler, member tags hardcoded, Next Billing hardcoded, Payment Method hardcoded, corporate default tags, empty state ambiguity, empty schedule cell button, dark mode class collisions |
| INFO | 4 | No code splitting, hydration mismatches from Math.random, polling on all queries, global error boundary good |

---

## Component Tree Diagram

See `.audit/diagrams/ui-ux.mmd`

Color coding:
- Green: well-structured, live data, production-ready
- Yellow: functional but has notable issues (stubs, mixed data, no error UI)
- Red: mock data, broken interactions, not production-ready
