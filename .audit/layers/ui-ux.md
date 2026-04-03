# UI/UX Audit Report

**Agent**: ui-ux
**Model**: claude-sonnet-4-6
**Timestamp**: 2026-04-02T00:00:00Z

---

## Scope

- **Files examined**: 94 TSX files (48 admin pages, 9 employee pages, 2 auth pages, 24 shared UI components, 2 layout components, 1 command palette)
- **Framework**: Next.js 16 App Router, React 19, Tailwind CSS v4, shadcn/ui (base-nova), Framer Motion, Recharts, ReactFlow
- **Design system spec**: Indigo `#4F46E5` primary, Amber `#F59E0B` secondary, Emerald `#10B981` success, Coral `#F97316` warning, Inter typography, light/dark modes

---

## Executive Summary

Meridian's frontend is visually cohesive and shows clear design intent. The Tailwind v4 token layer, globals.css, and the AI gradient border treatment are all implemented correctly. The core layout shell (sidebar, header, command palette) is well-structured. However, five systemic issues demand attention before Phase 2 scaling:

1. **Dark mode is non-functional for all page content.** The toggle exists and persists preferences, but every card and panel in admin and employee pages is hardcoded `bg-white` / `bg-gray-*` with zero `dark:` variant classes. Only the command palette and shadcn base components have dark mode support.
2. **No modal abstraction.** shadcn `Dialog` and `Sheet` are installed but used in zero pages. Eleven pages implement bespoke `fixed inset-0` modals with no focus trapping, no `<dialog>` semantics, and no keyboard escape handling beyond the backdrop click.
3. **Mega-page antipattern.** Fourteen pages exceed 700 lines (the largest is 1,562 lines). Business logic, type definitions, helper functions, sub-components, and data fetching all coexist in single page files. This makes testing impossible and refactoring dangerous.
4. **ARIA coverage is near zero.** Only 1 out of 14 ARIA attributes counted across the entire app (`aria-label` on a single automation toggle). Icon-only buttons in the header have no accessible names. Interactive `<tr>` rows are not keyboard accessible. SVGs lack `aria-hidden`.
5. **Animation constants are copy-pasted 55 times.** The `fadeInUp` Framer Motion variant is independently declared in 55 files rather than imported from a shared module.

---

## Findings by Severity

### Critical

#### C-1: Dark Mode is Visually Non-Functional on All Content

**Files affected**: Every admin page (48), every employee page (9)

The dark mode toggle in the sidebar calls `document.documentElement.classList.toggle('dark')` and persists to localStorage. The global CSS correctly defines `.dark` token overrides (`--background: #0F0F11`, `--card: #1A1A1F`, etc.). However, the Tailwind v4 custom variant is defined as:

```css
@custom-variant dark (&:is(.dark *));
```

This means `dark:` utility classes will apply correctly when `.dark` is on `<html>`. The problem is that **no admin page uses `dark:` variant classes on any card, panel, or surface**. Every card uses literal `bg-white`, `bg-gray-50`, `border-gray-200`, and `text-gray-900` classes that do not respond to the dark token at all. The toggle changes `<html class="dark">` but nothing visible on the page changes.

The sidebar and header themselves have zero `dark:` classes. The shadcn base components (Button, Badge, etc.) do have `dark:` variants, which means dropdowns and badges would correctly invert — surrounded by cards that stay white. This creates a partially-inverted state that would look broken.

The employee layout compounds this with a separate bug: the `.dark` class is applied to a wrapper `<div>` rather than `<html>`, meaning the custom variant selector `(&:is(.dark *))` would work for child elements, but the admin layout's sidebar toggle applies `.dark` to `<html>`, so the two portals use different scoping. If a user logs into the employee portal after using dark mode in admin, the state stored in localStorage (`meridian-theme: dark`) would add `.dark` to `<html>` but the employee layout also adds it to an inner `<div>`, doubling the class.

**Impact**: The dark mode feature, which is prominently surfaced in both the admin and employee sidebars, is entirely inert for all page content.

**Fix**: Replace all `bg-white` / `bg-gray-*` / `border-gray-*` / `text-gray-*` instances in page components with semantic token classes (`bg-card`, `bg-background`, `border-border`, `text-foreground`, etc.). Add `dark:` variants to sidebar and header for their own backgrounds. Standardize the `.dark` class scope to `<html>` only, and remove the inner `<div>` scoping from the employee layout.

---

#### C-2: Accessible Modals Missing Across 11 Pages

**Files affected**:
- `operations/payroll/page.tsx` (line 472)
- `members/page.tsx` (line 1190)
- `revenue/orders/page.tsx` (line 142)
- `marketing/leads/page.tsx` (line 285)
- `analytics/pricing/[id]/page.tsx` (line 705)
- `analytics/reports/[id]/page.tsx` (line 569)
- `analytics/pricing/[id]/page.tsx`
- `corporate/[id]/page.tsx` (line 721)
- `marketing/campaigns/new/page.tsx` (partial overlay at line 338)
- `marketing/campaigns/[id]/page.tsx` (partial overlay at line 355)
- `operations/payroll/page.tsx` (action menu at line 530 with bare `div onClick`)

Every modal in the application is a hand-rolled `fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm` div. These have the following accessibility failures:

- No focus is moved into the modal when it opens (keyboard users remain focused on the page behind).
- No focus trap — Tab navigates out of the modal into the obscured page content behind the backdrop.
- No `role="dialog"` or `aria-modal="true"`.
- No `aria-labelledby` linking the modal title to the dialog container.
- Escape key handling is absent (only backdrop click closes most modals).
- Screen readers present the modal as ordinary page content without announcing it as a dialog.

The shadcn `Dialog` component (which wraps Radix UI `Dialog.Root`) handles all of the above automatically, including the focus trap via `@radix-ui/react-dialog`. It is installed and present at `components/ui/dialog.tsx` but imported by zero pages.

**Impact**: Modals are inaccessible to keyboard and screen reader users. This is a WCAG 2.1 Level A failure (4.1.2 Name, Role, Value; 2.1.2 No Keyboard Trap).

**Fix**: Replace all bespoke modal patterns with the installed `Dialog` and `Sheet` components. For slide-over panels (the member detail panel in members/page.tsx), use `Sheet`. For centered dialogs, use `Dialog`.

---

#### C-3: Mega-Page Files — Untestable and Unmaintainable

**Files affected** (lines):
- `marketing/campaigns/[id]/page.tsx` — 1,562 lines
- `marketing/campaigns/new/page.tsx` — 1,354 lines
- `members/page.tsx` — 1,300 lines
- `revenue/page.tsx` — 1,295 lines
- `operations/page.tsx` — 1,130 lines
- `analytics/page.tsx` — 1,050 lines
- `analytics/reports/new/page.tsx` — 1,048 lines
- `settings/page.tsx` — 883 lines
- `members/[id]/page.tsx` — 881 lines
- `analytics/migration/page.tsx` — 878 lines
- `schedule/page.tsx` — 825 lines
- `marketing/automations/[id]/page.tsx` — 807 lines
- `marketing/automations/new/page.tsx` — 790 lines
- `corporate/[id]/page.tsx` — 784 lines

Each of these files mixes TypeScript interface definitions, data-fetching logic, formatting utilities, multiple sub-component function definitions, and rendering. For example, `members/page.tsx` defines: 4 TypeScript interfaces, 12 avatar color constants, 7 utility functions (`hashString`, `getAvatarColor`, `getInitials`, `splitName`, `mapTier`, `mapStatus`, `formatLastVisit`, `formatJoinDate`, `statusDot`, `statusLabel`, `membershipBadgeColor`, `generateHeatmap`), and 10 JSX sub-components (`FilterTabs`, `MemberRowSkeleton`, `MemberRow`, `ProfileHeader`, `OverviewTab`, `HistoryTab`, `FinancialsTab`, `CommunicationsTab`, `MemberDetailPanel`, the page itself) — all in one file.

Component Testing Library tests for any of these components require rendering the entire 1,300-line module. The two components (`MemberRow` and `ProfileHeader`) that would benefit most from isolation tests are not extractable without significant refactoring.

**Fix**: Extract sub-components into collocated component files per page directory (e.g., `app/(admin)/members/components/MemberRow.tsx`). Extract shared utility functions into `lib/` or `packages/utils`. The `fadeInUp` animation object should be defined once in a `lib/motion.ts` file and imported — it is currently copy-pasted across 55 files.

---

### High

#### H-1: ARIA Coverage is Near Zero

Across 94 TSX files, only 5 ARIA-related attributes appear in the codebase:
- 1 `aria-label` (on an automation toggle button in `marketing/automations/page.tsx`)
- 2 `role="group"` (in the `input-group.tsx` UI component)
- 2 `role="checkbox"` references in table column CSS selectors

The following elements lack accessible names:

**Icon-only buttons in `header.tsx`:**
- Hamburger/sidebar toggle (`Menu` icon) — no `aria-label` or `title`
- Keyboard shortcuts (`Keyboard` icon) — no `aria-label`
- Notifications bell (`Bell` icon) — no `aria-label`; the orange dot badge has no screen reader text (e.g., "3 unread notifications")

**Icon-only buttons across pages:**
- Close buttons on custom modals (X icon with no label) in members, leads, operations pages
- Copy button in revenue page (`Copy` icon at line 672)
- Tag remove buttons in corporate/new and leads/[id]

**Interactive table rows (`<tr onClick>`):**
The operations page employee table uses `<tr onClick>` to select a row. This is not keyboard accessible — rows are not `<button>` elements, have no `tabIndex`, and are not announced as interactive to screen readers.

**SVGs:** Lucide icons render as inline `<svg>` elements. React Lucide adds `aria-hidden="true"` by default to its icons in version 0.300+, so this is likely not a problem, but decorative SVGs created manually (login page email icon, leads page circular progress indicator) should be verified.

**Forms without error association:** Error messages rendered as `<p className="text-sm text-red-600">{error}</p>` are not linked to their triggering input via `aria-describedby`. Screen readers may not announce the error when focus returns to the field.

**Impact**: WCAG 2.1 Level A failures in 4.1.2 (Name, Role, Value) across navigation, buttons, and interactive table rows.

---

#### H-2: Keyboard Navigation Shortcuts Are Displayed But Not Implemented

The sidebar shows keyboard shortcuts (⌘1 through ⌘0) on hover for each navigation item. The command palette shows the same shortcuts as visual badges. However, no event listener in the application responds to `Cmd+[digit]` key combinations. Only `Cmd+K` is wired up (in `command-palette.tsx` line 67). The shortcuts shown in the UI are decorative labels, not functional bindings.

This is a power-user expectation gap: an admin who notices ⌘3 next to Members will attempt it, fail silently, and lose trust in the interface.

Furthermore, the shortcut numbering is **inconsistent** between the sidebar and command palette:

| Position | Sidebar | Command Palette |
|----------|---------|-----------------|
| 6 | Corporate | Operations |
| 7 | Operations | Analytics |
| 8 | Analytics | Segments |
| 9 | Segments | Engagement |
| 0 | Engagement | (absent) |

The command palette omits Corporate entirely from its navigation list.

**Fix**: Implement `useEffect` in `AdminLayout` with a `keydown` handler for `metaKey + ['1'-'0']` that navigates to the corresponding route. Reconcile the navigation item arrays in sidebar and command palette (they should reference a single shared constant).

---

#### H-3: No Shared Page Header Component — Inconsistent Heading Typography

Every admin page independently renders its own `<h1>` with varying font weights. Across 24 pages with `<h1>` tags:
- 20 use `font-bold`
- 20 use `font-black`
- 1 uses `font-semibold` (`docs/api/page.tsx`)

The schedule page and command center page have no `<h1>` at all. The command center uses `<h2>` as its highest heading (the AI briefing greeting). The schedule page has no `<h*>` heading at its top level.

There is no `PageHeader` shared component. Each page assembles its own title section, filter bar, and action button row independently. This leads to subtle visual drift: some pages have `tracking-tight` on the h1, some do not; button arrangements differ; some pages put the search input left of filters, others right.

**Impact**: Minor visual inconsistency across pages; meaningful heading structure gap for screen readers on 2 of 48 pages.

---

#### H-4: Custom Skeleton Components Fragmented Across 13 Files

The shadcn `Skeleton` component (`animate-pulse rounded-md bg-muted`) is installed and correct, but 13 pages define their own local skeleton wrapper:

- `CommandCenterSkeleton` in `page.tsx`
- `ScheduleSkeleton` in `schedule/page.tsx`
- `MetricSkeleton` in `corporate/page.tsx`
- `LoadingSkeleton` in `engagement/page.tsx`, `analytics/page.tsx`, `analytics/insights/page.tsx`, `analytics/dashboards/operations/page.tsx`, `analytics/dashboards/growth/page.tsx`, `analytics/dashboards/executive/page.tsx`
- `SkeletonPulse` in `marketing/page.tsx`
- `ProfileSkeleton` in `members/[id]/page.tsx`
- `MemberRowSkeleton` in `members/page.tsx`
- `ChartSkeleton` in `revenue/page.tsx`

Most of these are thin wrappers over `<div className="animate-pulse bg-gray-100 rounded">` that duplicate what the shadcn `Skeleton` already provides. Some (`LoadingSkeleton` in analytics pages) are identical character-for-character:

```tsx
function LoadingSkeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse bg-gray-100 rounded', className)} />
}
```

The shadcn `Skeleton` accepts a `className` prop and does the same thing.

---

#### H-5: Charts Are Broken Under Dark Mode (Hardcoded Hex Colors)

All Recharts charts across 18 pages use hardcoded hex string props that are not responsive to dark mode:

```tsx
// revenue/page.tsx
const AREA_COLORS = ['#4F46E5', '#8B5CF6', '#14B8A6', '#F59E0B', '#10B981']
<CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
<stop offset="0%" stopColor="#4F46E5" stopOpacity={0.2} />
```

The grid lines (`stroke="#f0f0f0"`) are near-white and will be invisible against the dark canvas background. Chart tooltips use `border: '1px solid #e5e7eb'` inline styles. This is an inevitable consequence of Recharts SVG rendering not participating in CSS cascade — the fix requires reading CSS custom properties at render time:

```tsx
const primaryColor = getComputedStyle(document.documentElement)
  .getPropertyValue('--color-brand-primary').trim()
```

Or using a React context to pass theme-aware colors. The globals.css already defines `--chart-1` through `--chart-5` tokens for both light and dark — they are just never consumed by chart components.

---

### Medium

#### M-1: `fadeInUp` Animation Variant Duplicated 55 Times

```tsx
const fadeInUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] as const },
}
```

This exact object (with minor value variations on `y` and `duration`) is declared 55 times across page files. A `lib/motion.ts` shared module would reduce this to a single import, make global animation tuning a one-line change, and allow tests to mock animation state cleanly.

---

#### M-2: No Form State Management Library — Inconsistent Validation

Forms across the application use three different patterns:

1. **Uncontrolled with `FormData`** — `corporate/new/page.tsx` (line 43)
2. **Controlled state with inline `onSubmit`** — `members/page.tsx` Add Member modal, `schedule/page.tsx` Walk-in modal
3. **onClick submit handlers** — `marketing/content/new/page.tsx` (separate Draft and Publish buttons)

No form uses React Hook Form, Formik, or Zod resolver. Validation is ad-hoc and inconsistent:
- Some fields use `required` HTML attribute only (no error message on blur)
- Error messages use `text-sm text-red-600` paragraphs that are not associated with inputs via `aria-describedby`
- There is no consistent error state display position (some above the submit button, some below the field, some inside the card header)

The project already has Zod installed. Adding React Hook Form with `zodResolver` would standardize validation, error display, and submission state across all forms.

---

#### M-3: Responsive Design is Admin-Desktop-First With Uneven Mobile Coverage

The admin layout has a fixed sidebar that collapses to 72px but never hides fully on mobile. On viewport widths below ~640px, the collapsed sidebar still occupies 72px of horizontal space, and the `main` content gets `pl-[72px]` applied unconditionally. There are no breakpoint overrides to switch to a mobile drawer or bottom navigation.

Individual pages do use responsive classes (`grid-cols-2 lg:grid-cols-5`, `hidden md:table-cell`), and tables use `overflow-x-auto` wrappers in 20+ locations. But the outermost layout structure does not accommodate small screens.

The employee portal uses an identical sidebar-based layout without mobile accommodation. The employee portal is designed for field use (clock in/out), making this a more acute gap than for the admin dashboard.

---

#### M-4: `STUDIO_ID` Hardcoded in 104 Page Files

```tsx
const STUDIO_ID = '11111111-1111-1111-1111-111111111111'
```

This string appears in 104 locations across page-level files. This is flagged as a structural issue in the project-structure report, but it has UI/UX consequences: if the studio ID changes during migration or multi-tenant expansion, every page breaks in production with no compile-time warning. It should come from a React context or environment variable.

---

#### M-5: Notification Bell is Non-Functional

The header notification bell (`header.tsx` line 66) has a hardcoded orange dot badge with no count, no state, no click handler, and no dropdown. It is purely decorative. Users who click it receive no feedback. This should either be implemented or removed until Phase 2.

---

#### M-6: Breadcrumb Navigation Uses String Concatenation, Not a Component

`AdminLayout` maintains a static lookup table of 40+ path-to-breadcrumb-string mappings using `>` as a separator. Dynamic routes (member detail, campaign detail) are handled by regex pattern matching. This approach has no clickable segments — the breadcrumb text is a single unlinked string in the header.

Standard breadcrumb patterns (ARIA `nav` with `aria-label="Breadcrumb"`, `<ol>` with `<li>` items, clickable links for parent segments) are missing. The current implementation provides orientation but not navigation utility.

---

#### M-7: ReactFlow Canvas Has No Dark Mode or Accessible Alternative

The automation flow builder (`marketing/automations/new/page.tsx` and `marketing/automations/[id]/page.tsx`) renders a ReactFlow canvas with `className="bg-[#FAFAFA]"` and `<Background color="#e5e7eb">`. These are hardcoded to light mode. When dark mode is eventually fixed at the page level, the canvas will remain light-colored.

ReactFlow provides a `colorMode` prop that accepts `'light' | 'dark' | 'system'`. Additionally, the canvas has no keyboard navigation alternative — users who cannot use a mouse cannot create or connect nodes.

---

### Low

#### L-1: Login Page Uses Hardcoded Hex Instead of CSS Variables

```tsx
// login/page.tsx
className="focus:ring-2 focus:ring-[#4F46E5]"
className="bg-[#4F46E5]"
className="text-[#4F46E5]"
```

The login page was built without the design token layer, using raw hex values where `ring-primary`, `bg-primary`, and `text-primary` would pull from CSS variables. This is a minor inconsistency since the login page is outside the admin theme, but it will become an issue if the primary brand color is updated.

---

#### L-2: Missing `lang` Attribute on Inner HTML Elements with Non-English Content

The root layout correctly sets `<html lang="en">`. No inner elements override this for non-English text (which currently does not exist but will matter when adding Spanish language support, which is likely for a Florida studio).

---

#### L-3: `not-found.tsx` and `error.tsx` Do Not Exist Within Route Groups

The global `not-found.tsx` and `error.tsx` exist at the app root but not within `(admin)` or `(employee)` route groups. This means 404s and runtime errors inside the admin layout will render the error page without the sidebar, header, or any admin chrome — users see a blank centered card with no way to navigate back to the dashboard without using the browser back button (the "Back to Dashboard" link is hardcoded, which is fine, but users lose their sidebar context and navigation state).

Route-group-level error boundaries would keep users inside the app shell.

---

#### L-4: The `<tr onClick>` Pattern Does Not Provide Keyboard Row Selection

Operations, revenue, members, and analytics pages use clickable `<tr>` rows for selection:

```tsx
<tr
  onClick={() => setSelectedEmployee(emp)}
  className="cursor-pointer hover:bg-gray-50/80 transition-colors"
>
```

These rows are not keyboard navigable. They need `tabIndex={0}` and `onKeyDown={(e) => e.key === 'Enter' && handler()}` at minimum, and ideally `role="row"` with `aria-selected` to form a proper grid widget.

---

#### L-5: No `viewport` Export in Root Layout (Next.js App Router)

Next.js App Router convention is to export a `viewport` object from `layout.tsx` for the viewport meta tag:

```tsx
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}
```

The root `layout.tsx` only exports `metadata`. Next.js will inject a default viewport tag, but the explicit export is recommended for control over viewport configuration, particularly for the employee portal which is used on mobile.

---

## Design System Adherence

### Positive

- `globals.css` is well-structured with all brand colors as CSS custom properties
- Light and dark token sets are complete and correct
- Chart palette tokens (`--chart-1` through `--chart-5`) are defined for both modes
- The `.ai-border` gradient treatment is correctly implemented and used on the AI briefing card
- Inter loaded via `next/font/google` with `display: 'swap'` — correct
- `tabular-nums` applied consistently to metric displays
- `text-[10px] font-bold uppercase tracking-widest` used as a consistent "label" typographic style
- `rounded-2xl` used consistently for card containers
- Status dots and badge colors (`emerald`, `amber`, `orange`, `indigo`) are consistent across pages

### Issues

- **291 hardcoded hex instances** in page files, primarily in Recharts SVG props and a few inline styles. These bypass the token system and break dark mode.
- **Heading weight inconsistency**: `font-bold`, `font-black`, and `font-semibold` all used for `<h1>` across pages with no documented rule for when to use which.
- **Card border color**: Most pages use `border-gray-200` directly; a few use `border-border`. These are equivalent in light mode but `border-border` respects dark mode.
- **Sidebar uses `bg-white border-gray-200`** without dark tokens instead of `bg-sidebar border-sidebar-border` which are defined in globals.css.
- **Employee layout sidebar width** is `w-[220px]` (an arbitrary value) vs admin sidebar's `w-[240px]` and the CSS variable `--sidebar-width: 240px`. The CSS variable is never consumed by either layout.

---

## Component Hierarchy

### Structure

```
RootLayout
├── AuthProvider + TooltipProvider (global)
├── (auth)/layout.tsx → LoginPage
├── (admin)/layout.tsx (Sidebar + Header + CommandPalette)
│   ├── CommandCenter (page.tsx)
│   │   ├── AIBriefingCard
│   │   ├── MetricCard (×5)
│   │   ├── ClassStatusBoard
│   │   ├── TodaysTimeline
│   │   └── ActivityFeed
│   ├── Schedule
│   │   ├── WeekView / MonthView
│   │   ├── ClassBlockCard
│   │   └── ClassDetailPanel
│   ├── Members
│   │   ├── FilterTabs
│   │   ├── MemberRow (×N)
│   │   ├── MemberDetailPanel (slide-over)
│   │   └── AddMemberModal (bespoke)
│   ├── Revenue
│   │   ├── MetricCard (redefined locally)
│   │   ├── OverviewTab (Recharts ×4)
│   │   ├── MembershipsTab
│   │   └── TransactionsTab
│   ├── [12 more page modules, each self-contained]
│   └── components/ui/ (24 shadcn components, rarely imported by pages)
└── (employee)/layout.tsx (EmployeeLayout)
    └── [9 employee pages, all self-contained]
```

### Key Observations

- **Component nesting depth** stays within 4–5 levels in all pages. This is well-controlled.
- **No barrel files** in `components/ui/` or `components/layout/`. Each component must be individually imported. This is acceptable at current scale.
- **Shared components** are exclusively in `components/ui/` (shadcn base) and `components/layout/` (sidebar, header). No feature-specific shared components exist.
- **shadcn components used in pages**: Badge (schedule, members), Skeleton (schedule, command center), Command (command palette), Tabs (revenue, members), Switch (settings, automations), Select (campaign builder, automation builder). Usage is light relative to what is available — Dialog, Sheet, Popover, and DropdownMenu are installed but unused in pages, with custom HTML alternatives built instead.

---

## Loading States

### Coverage by Pattern

| Pattern | Pages Using It | Notes |
|---------|---------------|-------|
| Local `CommandCenterSkeleton`-style full-page skeleton | 13 | Correct pattern, poorly standardized |
| `Loader2` spinner with `animate-spin` | 22 | Used for button states and inline data loads |
| Conditional `{loading ? <Skeleton /> : <Data />}` | ~15 | Revenue page uses this per-chart |
| No loading state at all | ~6 (corporate, settings) | Corporate pages fetch server-side; some settings use hardcoded data |

### Consistency Issues

- `LoadingSkeleton` is redefined identically in 7 different files
- Some pages use the shadcn `Skeleton` component; others use `animate-pulse bg-gray-100 rounded` raw divs
- Revenue page has the most sophisticated loading state (per-chart `ChartSkeleton` with correct height preservation). This pattern is not shared with analytics pages that also have charts
- Employee pages mostly show `min-h-[400px]` centered spinners rather than content-shaped skeletons

---

## Accessibility Summary

| Category | Status | Detail |
|----------|--------|--------|
| Semantic HTML | Partial | Correct use of `<nav>`, `<aside>`, `<header>`, `<main>`. Missing `<dialog>` for modals. `<tr onClick>` misuse. |
| Heading hierarchy | Partial | Most pages have h1→h3. Command Center and Schedule pages missing h1. |
| ARIA labels | Poor | 1 `aria-label` in 94 files. Icon buttons missing names. No `role="dialog"`. No `aria-live` regions. |
| Focus management | Poor | No focus trapping in any custom modal. No `autoFocus` on modal open (except Add Member form inputs via HTML `autoFocus`). |
| Keyboard navigation | Poor | No number shortcuts despite display. No keyboard row selection in tables. No Skip to Content link. |
| Color contrast | Likely passing | Primary indigo (#4F46E5) on white exceeds 4.5:1 for normal text. Amber (#F59E0B) on white is marginal — needs audit. `text-gray-400` on `bg-gray-50` is borderline. |
| Focus indicators | Partial | `focus:ring-2 focus:ring-indigo-500/20` on form inputs is too subtle (20% opacity). shadcn components have `focus-visible:ring-3 focus-visible:ring-ring/50`. |

---

## Navigation Patterns

### Sidebar
- Framer Motion `layoutId="nav-pill"` for active indicator animation — correct and performant
- Keyboard shortcut hints shown on hover (collapsed state) — not wired to actual handlers
- No skip-to-content link at page top
- Dark mode toggle is the correct location; just not implemented at page level

### Command Palette
- shadcn `CommandDialog` (Radix UI) — correct, keyboard accessible, properly trapped
- Navigation items misaligned with sidebar (Corporate omitted, shortcut numbers diverge)
- Employee Portal items point to `/operations/clock` and `/operations/payroll` — these URLs do not exist in admin routing (employee portal is at `/employee/*`)

### Breadcrumbs
- Static string-based, no clickable segments, no semantic markup
- `>` separator in a plain text span with no `aria-hidden`

---

## Data Display Patterns

### Tables
- Native `<table>` with `overflow-x-auto` wrapper — correct approach for horizontal scroll
- Responsive column hiding via `hidden md:table-cell` and `hidden lg:table-cell` — good
- Missing `<caption>` elements on all tables
- `<thead>` `<th>` cells lack `scope="col"` attribute

### Charts (Recharts)
- All charts are built per-page with no shared chart wrapper
- Colors hardcoded as hex strings — not dark mode aware
- No accessible fallback (table representation of chart data) for screen readers
- `ResponsiveContainer` used correctly

### Cards and Metric Displays
- Consistent `rounded-2xl border border-gray-200 shadow-sm` pattern
- `tabular-nums` applied correctly to metrics
- `text-[10px] font-bold uppercase tracking-widest text-gray-400` label style used as a consistent convention

### Empty States
- 42 instances of inline empty state messages
- Mostly `<p className="text-sm text-gray-500 mt-4">No X found.</p>`
- No shared `EmptyState` component
- Some empty states include contextual actions (good); most are text-only

---

## Diagram

See `/Users/zach/Desktop/literal-fishstick/.audit/diagrams/ui-ux.mmd`

---

## Prioritized Fix List

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| P0 | Implement dark mode on page cards (replace `bg-white`/`bg-gray-*` with semantic tokens) | High | Dark mode works end-to-end |
| P0 | Replace all bespoke modals with shadcn `Dialog` / `Sheet` | Medium | Keyboard + screen reader accessible modals |
| P1 | Add `aria-label` to all icon-only buttons (header, modals, tables) | Low | Immediate WCAG A compliance |
| P1 | Wire up Cmd+1 through Cmd+0 keyboard shortcuts | Low | Delivers on advertised power-user feature |
| P1 | Reconcile sidebar and command palette navigation arrays into a shared constant | Low | Eliminates shortcut mismatch |
| P1 | Extract `fadeInUp` to `lib/motion.ts` | Low | Eliminates 55 duplicate declarations |
| P2 | Add `tabIndex={0}` + `onKeyDown` to clickable `<tr>` rows | Low | Keyboard table navigation |
| P2 | Pass `colorMode` to ReactFlow canvases | Low | Dark mode in automation builder |
| P2 | Replace chart hex constants with CSS variable reads | Medium | Dark mode in all charts |
| P2 | Extract `LoadingSkeleton` wrappers into shared `Skeleton` usage | Low | Consistent loading states |
| P2 | Add route-group `error.tsx` inside `(admin)` and `(employee)` | Low | Error pages keep nav context |
| P3 | Replace static breadcrumb strings with a `<Breadcrumb>` component (ARIA nav) | Medium | Accessible navigation labels |
| P3 | Add `aria-describedby` to form error messages | Low | Screen reader error announcements |
| P3 | Extract sub-components from mega-page files into collocated component directories | High | Testability, maintainability |
| P3 | Add `scope="col"` to `<th>` and `<caption>` to all `<table>` elements | Low | Table accessibility |
| P3 | Implement `PageHeader` shared component to standardize h1 typography | Low | Visual consistency |
