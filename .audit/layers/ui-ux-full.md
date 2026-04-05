# Layer Report: UI/UX Audit (Full)

**Audit Date:** 2026-04-05
**Agent:** ui-ux
**Framework:** Next.js 16 App Router, React 19, Tailwind CSS v4, shadcn/ui, Recharts, framer-motion
**Severity Scale:** Critical / High / Medium / Low / Info

---

## Executive Summary

Meridian's admin dashboard has a strong design foundation. The card vocabulary (rounded-2xl, gray-200 border, shadow-sm), typography hierarchy (10px uppercase labels, 28px metric values), and the indigo brand color are applied consistently across the majority of the 60+ component files reviewed. The AI-specific gradient border treatment (`.ai-border` CSS class) is correctly defined and used on the AI Briefing Card. Dark mode is structurally sound via Tailwind CSS's `.dark` class selector.

However, the audit identified three categories of meaningful defects:

1. **Layout inflation bug** — Twenty-plus client components redeclare `min-h-screen bg-[#FAFAFA]` when they are already nested inside AdminShell's `<main>` element, creating double-background layers and adding spurious height to pages. This is the most widespread structural issue.

2. **Accessibility near-absence** — Interactive elements throughout the app have no `aria-label`, no `aria-describedby`, and no keyboard interaction beyond what the browser provides by default. Icon-only buttons (close, dismiss, toggle) have zero accessible names. This is a systemic gap across all 60+ pages.

3. **Navigation inconsistency** — The sidebar and command palette list different modules at different shortcut keys. Settings has no sidebar entry. The breadcrumb in the Header is a flat string while a full `Breadcrumbs` component exists but is not wired into the header.

---

## 1. Component Hierarchy

The component tree is clean and purposeful. There are three layout surfaces (admin, employee, auth) and within admin, each module follows a consistent `page.tsx → *Client.tsx → sub-components` pattern.

```
AdminLayout (RSC)
  └── AdminShell (client boundary — sidebar state, keyboard shortcuts)
        ├── CommandPalette
        ├── Sidebar
        ├── Header
        └── <main>
              └── page.tsx children
                    └── *Client.tsx (per-module interactive shell)
                          └── Tab components, panels, forms
```

**Nesting depth:** Maximum observed depth is 5 levels (AdminShell → page → Client → panel → stat card). No components exceed 6 levels. No concern here.

**Naming conventions:** Consistent. Pages live at `page.tsx`, interactive shells at `*Client.tsx` (co-located in `_components/`), reusable primitives in `components/ui/`. One exception: `HeroMetricCard` and `WeeklyReviewBar` live in `app/(admin)/_components/` rather than `components/ui/` — they are used only on the Command Center today but appear designed as reusable.

**Line counts (spot-checked files over 200 lines):**
- `apps/web/src/app/(admin)/page.tsx` — ~653 lines. Contains `CommandCenterSkeleton`, `AIBriefingCard`, `MetricCard`, `ClassStatusBoard`, `TodaysTimeline`, `ActivityFeed`, and `EngagementBreakdown` all inline. Should be split.
- `apps/web/src/app/(admin)/analytics/kpi/_components/KpiDeepDiveClient.tsx` — ~800+ lines.
- `apps/web/src/app/(admin)/marketing/campaigns/new/page.tsx` — large multi-step form, estimated ~600+ lines.

---

## 2. Design System Compliance

### Colors

The design system is well-defined in `apps/web/src/app/globals.css` with CSS custom properties for all brand tokens. Tailwind's utility classes (`indigo-600`, `emerald-500`, `amber-400`, `orange-500`) map correctly to the spec values.

**Compliant patterns observed:**
- Primary CTAs: `bg-indigo-600 hover:bg-indigo-700` — consistent.
- Success states: `text-emerald-600` — consistent.
- AI cards: `.ai-border` CSS class with the `from-indigo-500/via-violet-500` gradient — correct.
- Dark surfaces: `dark:bg-gray-950` maps to `#030712` (Tailwind), not the spec's `#0F0F11`. The CSS variable `--background: #0F0F11` in `.dark {}` is correct, but components using `dark:bg-gray-950` directly diverge from the spec by approximately 3 luminance steps. This is a minor visual inconsistency, not a broken experience.

**Divergences:**
- `MetricCard` in `page.tsx` (line 209) uses `text-orange-600` for downward trends rather than the spec's "soft coral" `#F97316` (which is `orange-500`). `HeroMetricCard` uses `text-red-500` for the same semantic. Two components performing the same role use different signal colors.
- `EngagementBreakdown` in `page.tsx` uses `bg-blue-500` for "engaged" status. The design system has no "blue" token — this should be indigo or a named system color.
- KPI Deep Dive charts (`KpiDeepDiveClient.tsx`, lines 680-684) use hardcoded hex `#6366F1` (indigo-500) and `#C7D2FE` (indigo-200) directly in Recharts `<Cell fill>` props. These are not wrong values, but they should reference the CSS custom properties or Tailwind variables for maintainability.
- `STATUS_COLORS` record in `KpiDeepDiveClient.tsx` (lines 115-126) contains `'churned': '#1F2937'` (gray-800, near-black). On a dark background this will be invisible. This is a chart data color, not a UI color, but the choice is semantically confusing.
- The `SEGMENT_COLORS` map in `marketing/campaigns/new/page.tsx` (lines 66-74) defines its own ad-hoc color system using string keys (`'blue'`, `'red'`, `'orange'`). These values are all Tailwind colors and broadly consistent, but this is a second parallel color system not referenced from the global tokens.

### Typography

Typography is very consistent. The three-level hierarchy appears throughout:
- Section label: `text-[10px] font-bold uppercase tracking-widest text-gray-400`
- Body/supporting: `text-sm font-medium text-gray-700`
- Metric value: `text-[28px] font-black tabular-nums`

The use of `text-[10px]`, `text-[11px]`, `text-[28px]` as arbitrary values is by design — these don't correspond to standard Tailwind type-scale steps. They work visually but would benefit from being extracted into CSS custom properties (e.g., `--text-label`, `--text-metric`) to enable global scale changes.

### Card Styles

Card styles are consistent: `bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm`. Hover states are `hover:shadow-md` on interactive cards. Padding is `p-5` on most cards, `p-4` on the WeeklyReviewBar and some secondary cards — minor inconsistency.

### AI Gradient Border

The `.ai-border` class is defined in `globals.css` (line 156) and used correctly on the `AIBriefingCard` in `page.tsx` (line 165). In `MemberProfilePanel.tsx` (line 184), the AI Predictive Insights section uses an inline `rounded-xl p-[1px] bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500` technique — this achieves the same visual result but is a different implementation. Both approaches work but create implementation divergence. Recommend consolidating on the `.ai-border` class.

---

## 3. Information Architecture

### Sidebar Navigation

The sidebar (`sidebar.tsx`) lists 10 items:
```
1  Command Center   (/)
2  Schedule         (/schedule)
3  Members          (/members)
4  Revenue          (/revenue)
5  Marketing        (/marketing)
6  Corporate        (/corporate)
7  Operations       (/operations)
8  Analytics        (/analytics)
9  Segments         (/segments)
0  Engagement       (/engagement)
```

**Issues:**
- Settings (`/settings`) is reachable via URL but has no sidebar entry. A studio owner cannot find it without knowing the URL or using the command palette. This is a dead end for discovery.
- "Segments" and "Engagement" at positions 9 and 0 are functionally sub-features of "Members" — they feel more like tabs on the Members page than top-level modules. A studio owner scanning the sidebar must mentally categorize these, adding cognitive load.
- The sidebar does not visually group related items. Linear meets Stripe would typically group: Core (Command Center), Operations (Schedule, Members, Revenue), Marketing & Growth (Marketing, Corporate), Intelligence (Analytics, Segments, Engagement), and System (Operations, Settings).

### Command Palette vs. Sidebar Mismatch

The command palette (`command-palette.tsx`, lines 35-45) lists 9 navigation items. The sidebar lists 10. The command palette omits "Corporate" entirely. The shortcut numbering in the command palette also diverges from the sidebar: command palette shows Operations at shortcut 6 while the sidebar shows Corporate at 6. A keyboard-first user relying on shortcut hints in the command palette will navigate to the wrong module.

**Sidebar shortcut 6:** Corporate (`/corporate`)
**Command palette shortcut 6:** Operations (`/operations`)

### Breadcrumbs

`components/layout/breadcrumbs.tsx` is a fully implemented component with `aria-label="Breadcrumb"`, proper link hierarchy, and UUID detection. However, the `Header` component (`header.tsx`) renders only a flat string breadcrumb (`<span className="font-medium">{breadcrumb}</span>`) from a static lookup map in `admin-shell.tsx`. The `Breadcrumbs` component is not used in the header at all. Dynamic pages (e.g., `/members/[id]`) show "Members > Directory" in the header regardless of which member is open.

---

## 4. Critical Findings

---

### CRITICAL-UX-001: Double background / layout inflation on 20+ pages

**Severity:** Critical
**Files affected:**
- `apps/web/src/app/(admin)/analytics/insights/_components/AIInsightsClient.tsx` — line 170
- `apps/web/src/app/(admin)/analytics/kpi/_components/KpiDeepDiveClient.tsx` — line 569
- `apps/web/src/app/(admin)/analytics/page.tsx` — line 430
- `apps/web/src/app/(admin)/corporate/[id]/_components/CompanyDetailClient.tsx` — line 240
- `apps/web/src/app/(admin)/corporate/events/[id]/_components/EventDetailClient.tsx` — line 118
- `apps/web/src/app/(admin)/analytics/reports/[id]/_components/ReportViewerClient.tsx` — line 140
- (and 14+ more — see `min-h-screen bg-[#FAFAFA]` grep results)

**Description:** The `AdminShell` wraps all children in a `<main>` element that already applies `min-h-screen` and a page background via `bg-[var(--background)]`. Approximately 20 client components then add their own `min-h-screen bg-[#FAFAFA] dark:bg-[#0F0F11]` wrapper as the outermost element. The result is:
1. A double background rendering pass.
2. Each component's inner `div` creates a new stacking context with `min-h-screen`, which means these components implicitly size themselves to viewport height independent of their content.
3. Inside the `AdminShell`, the `max-w-7xl mx-auto` content constraint is bypassed by components that set their own `max-w-[1440px] mx-auto px-6 py-8` — resulting in inconsistent page widths and double padding (`AdminShell p-5/p-7` + page `px-6 py-8`).

The components should be plain `<div className="space-y-6">` wrappers, relying on the AdminShell for the page background and padding.

**Impact:** Visual inconsistency on every affected page. Double padding. Inconsistent max-width across modules (some use `max-w-7xl`, some `max-w-[1440px]`, the analytics sub-pages use `max-w-[960px]`, `max-w-[720px]`, etc.).

---

### CRITICAL-UX-002: Engagement page is a stub with hardcoded zero data

**Severity:** Critical
**File:** `apps/web/src/app/(admin)/engagement/_components/EngagementClient.tsx` — lines 63-83
**File:** `apps/web/src/app/(admin)/segments/_components/SegmentsClient.tsx` — note in context

**Description:** The Engagement module (keyboard shortcut 0, always visible in sidebar) renders an "Achievements" tab and "Challenges" tab with hardcoded `memberCount: 0` and `participants: 0` for all entries. The static data comment on line 63 explicitly acknowledges this: "TODO: Achievements and challenges are currently static placeholders." The sidebar presents this as a first-class module alongside Revenue and Members. A studio owner clicking on it sees a leaderboard that may have real data but achievements/challenges that show 0 for everything, with no indication this is incomplete.

**Impact:** Misleading UX. A new studio owner will believe the system has a gamification feature that is not functional.

**Recommendation:** Either mark the page as "Coming Soon / Phase 3" with a placeholder state that explains what the feature will do, or remove it from the sidebar until the data pipeline exists.

---

## 5. High Findings

---

### HIGH-UX-003: Command palette missing Corporate; shortcut keys conflict with sidebar

**Severity:** High
**File:** `apps/web/src/components/command-palette.tsx` — lines 35-45
**File:** `apps/web/src/components/layout/sidebar.tsx` — lines 27-38
**File:** `apps/web/src/components/layout/admin-shell.tsx` — lines 11-22

**Description:** Three separate files maintain independent navigation item lists and shortcut key assignments:

| Location | Item at ⌘6 |
|---|---|
| Sidebar `navItems` | Corporate |
| AdminShell `shortcutRoutes` | Corporate |
| Command Palette `navigationItems` | Operations |

The command palette omits Corporate entirely and reassigns shortcut 6 to Operations. A user who memorizes shortcuts from the sidebar will navigate to the wrong place when using the command palette. The command palette also does not show Settings as a navigation target.

**Recommendation:** Extract a single `NAV_ITEMS` constant into a shared module (e.g., `lib/nav.ts`) that all three files import. The command palette should derive its shortcut hints from that single source.

---

### HIGH-UX-004: Breadcrumb in header is a flat static string, not the Breadcrumbs component

**Severity:** High
**File:** `apps/web/src/components/layout/admin-shell.tsx` — lines 24-70 (static `breadcrumbs` map)
**File:** `apps/web/src/components/layout/header.tsx` — line 54
**File:** `apps/web/src/components/layout/breadcrumbs.tsx` — full file (unused in header)

**Description:** The header renders `{breadcrumb}` — a string from a hardcoded lookup table in `admin-shell.tsx`. The `Breadcrumbs` component (which handles dynamic routes, UUIDs, entity names, and proper `aria-label`) exists but is not connected to the header. Several dynamic pages (member profiles, event details, company details) show the wrong breadcrumb text: `/members/some-uuid` shows "Members > Directory" in the header, not the member's name.

The `breadcrumbs` map in `admin-shell.tsx` is also incomplete — it covers about 25 routes but misses `/revenue/products/[id]`, `/analytics/kpi`, `/analytics/trainers/[id]`, and most employee portal routes.

**Recommendation:** Replace the string-based breadcrumb in the Header with `<Breadcrumbs />`. Update page components to pass the `entityName` prop. Remove the static `breadcrumbs` map from `admin-shell.tsx`.

---

### HIGH-UX-005: Settings module has no sidebar entry

**Severity:** High
**File:** `apps/web/src/components/layout/sidebar.tsx` — lines 27-38 (navItems array)
**File:** `apps/web/src/app/(admin)/settings/` (exists, fully implemented)

**Description:** `/settings`, `/settings/sms`, and `/settings/geofence` are fully implemented pages with real forms. They are reachable through the command palette's "Employee Portal" group (which navigates to `/operations/settings`, a non-existent route) and through direct URL, but Settings has no sidebar navigation entry. A studio owner who needs to configure studio hours, membership plans, or Glofox sync settings cannot find this through the sidebar. The command palette "Settings" entry also links to `/operations/settings` (wrong path) instead of `/settings`.

---

### HIGH-UX-006: Dark mode toggle logic duplicated across sidebar and employee layout

**Severity:** High
**File:** `apps/web/src/components/layout/sidebar.tsx` — lines 49-63
**File:** `apps/web/src/app/(employee)/layout.tsx` — lines 58-71

**Description:** Both files implement the same `localStorage.getItem('meridian-theme')` + `document.documentElement.classList.add('dark')` pattern independently. If a user switches dark mode in the admin sidebar and then navigates to the employee portal, the employee layout re-reads localStorage on mount — which is correct. However, if the employee layout applies the dark class before the sidebar can, or vice versa, there is a brief flash of the wrong theme. More importantly, there is no system-level dark mode context — meaning any future surface (settings page, modal) that needs to read the dark mode state must re-implement this pattern.

**Recommendation:** Move dark mode state to a React context (or Zustand store) initialized from localStorage. A single source of truth eliminates duplication and prevents flash-of-wrong-theme.

---

### HIGH-UX-007: Accessibility — icon-only interactive elements have no accessible names

**Severity:** High
**Scope:** Systemic across the codebase. Representative examples:

- `apps/web/src/components/layout/sidebar.tsx` — line 177: LogOut button has `title="Sign out"` (tooltip only, not screen reader accessible as an accessible name)
- `apps/web/src/components/layout/header.tsx` — line 68: Keyboard shortcuts button has no accessible name
- `apps/web/src/components/layout/header.tsx` — line 85-90: Bell/notification button has no accessible name
- `apps/web/src/app/(admin)/members/_components/MemberProfilePanel.tsx` — line 84-89: "X" close button has no `aria-label`
- `apps/web/src/app/(admin)/marketing/campaigns/_components/CampaignsClient.tsx` — line 91: MoreHorizontal action button has no accessible name

Out of all interactive buttons in the entire `(admin)` route group, only 2 files contain `aria-label` attributes: `breadcrumbs.tsx` (nav landmark) and `AutomationsClient.tsx` (one toggle). All other buttons rely on visual context only.

**Impact:** Zero screen reader support. Fails WCAG 2.1 AA criterion 4.1.2 (Name, Role, Value).

**Recommendation:** Add `aria-label` to all icon-only buttons. For repeated patterns (close button, action menu trigger, collapse toggle), create a small `IconButton` wrapper component that requires an `aria-label` prop.

---

### HIGH-UX-008: MetricCard (Command Center) and HeroMetricCard are redundant components with inconsistent trend color

**Severity:** High
**File:** `apps/web/src/app/(admin)/page.tsx` — lines 202-220 (`MetricCard` component)
**File:** `apps/web/src/app/(admin)/_components/HeroMetricCard.tsx`

**Description:** `MetricCard` is defined inline in `page.tsx` and `HeroMetricCard` is a shared component in `_components/`. They render identically (same layout, same font sizes, same hover behavior). The visual difference is that `MetricCard` uses `text-orange-600` for downward trends while `HeroMetricCard` uses `text-red-500`. These colors have different semantic meanings in the design system:
- `orange-500 / #F97316` is the spec's "Warning / soft coral" color
- `red-500 / #EF4444` is the spec's "Error" color

The Command Center renders `MetricCard` instances for KPI data that is not sourced through the `useKpiData` hook, creating a second rendering path for the same data. Only the four HeroMetricCards at the top of the page use `useKpiData`; the three MetricCards below that use separate data (not visible in the provided excerpt, but the pattern is there).

**Recommendation:** Delete `MetricCard` from `page.tsx`. Use `HeroMetricCard` for all metric display on the Command Center. Standardize on `text-red-500` for negative trends.

---

## 6. Medium Findings

---

### MEDIUM-UX-009: Engagement breakdown uses off-system color tokens

**Severity:** Medium
**File:** `apps/web/src/app/(admin)/page.tsx` — lines 485-496

**Description:** The `ENGAGEMENT_CONFIG` array uses `bg-blue-500`, `bg-green-500`, `bg-sky-500`, `bg-slate-400`, and `bg-gray-800` as dot colors for member status segments. The design system does not define "blue" or "green" as brand tokens — it uses `indigo`, `emerald`, and `violet`. `bg-green-500` and `bg-emerald-500` are visually similar but distinct; using both in the same widget creates a subtle but real inconsistency.

---

### MEDIUM-UX-010: Page headers lack consistent layout — page-level H1 heading missing on most pages

**Severity:** Medium
**Scope:** Multiple pages

**Description:** Most module-level client components render an `<h1>` inline (e.g., `<h1 className="text-2xl font-black">Campaigns</h1>`). However, the overall page content area — the `<main>` → inner `<div className="p-5 md:p-7 max-w-7xl">` — has no top-level heading. Pages that do define an H1 embed it inside the client component wrapper at unpredictable vertical positions, sometimes after breadcrumbs, sometimes after charts.

A studio owner using a screen reader or keyboard navigation cannot reliably jump to the page heading to understand context. Additionally, pages with the double-background issue (CRITICAL-UX-001) add `py-8` inside an already-padded container, pushing the H1 down by 3rem (48px) from the top of the content area.

---

### MEDIUM-UX-011: Add Member modal — no trap focus, no Escape key handler at component level

**Severity:** Medium
**File:** `apps/web/src/app/(admin)/members/_components/AddMemberModal.tsx` — lines 18-100

**Description:** The modal is a `motion.div` overlay. Clicking the backdrop (`onClick={onClose}`) correctly closes it. However:
1. Focus is not trapped inside the modal. A keyboard user can tab past the form into the background.
2. There is no Escape key handler in the component — the modal only closes via backdrop click or the X button.
3. The X close button at line 36 has no `aria-label`.
4. `autoFocus` is applied to the Full Name input (line 74) — this is correct, but works only because the browser assigns focus on render. In some screen reader modes this does not announce the modal context.

**Recommendation:** Use a proper Dialog component from shadcn/ui (`components/ui/dialog.tsx` exists). The Dialog primitive handles focus trapping, Escape key, and ARIA roles automatically.

---

### MEDIUM-UX-012: KPI Deep Dive chart axis colors do not adapt to dark mode

**Severity:** Medium
**File:** `apps/web/src/app/(admin)/analytics/kpi/_components/KpiDeepDiveClient.tsx` — lines 660-675

**Description:** Recharts axis and grid line colors are hardcoded:
```
tick={{ fontSize: 10, fill: '#9CA3AF' }}   // gray-400 — fine in light, disappears in dark
axisLine={{ stroke: '#E5E7EB' }}           // gray-200 — invisible in dark mode
CartesianGrid stroke="#F3F4F6"             // gray-100 — invisible in dark mode
```
In dark mode the chart background is `dark:bg-gray-950` (near-black), but the axis text (`#9CA3AF` / gray-400) and grid lines (`#E5E7EB` / gray-200) remain at light-mode values. Grid lines disappear entirely and axis labels become very low contrast.

The same pattern appears in `OverviewTab.tsx` and `analytics/page.tsx`.

**Recommendation:** Define Recharts theme values as JS constants that reference CSS variables or conditionally select values based on `document.documentElement.classList.contains('dark')`.

---

### MEDIUM-UX-013: Sidebar dark mode toggle icon is inverted — shows Moon when in dark mode

**Severity:** Medium
**File:** `apps/web/src/components/layout/sidebar.tsx` — lines 148-155

**Description:**
```tsx
{isDark ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
{!collapsed && <span>{isDark ? 'Dark Mode' : 'Light Mode'}</span>}
```
When the user is already in dark mode, the button shows the Moon icon and says "Dark Mode." This is labeling the current state, not the action. Convention (used by virtually every OS and design system) is to show the icon for what the toggle *will switch to*, or to label the button as an action ("Switch to Light Mode"). Additionally, the icon choices (Moon = dark, Sun = light) are both inverted and mirrored — it should show a Sun when in dark mode (offering to switch to light).

The employee portal layout (`layout.tsx`, lines 200-205) has the same inverted icon bug.

---

### MEDIUM-UX-014: Notification dropdown is permanently empty with no real data

**Severity:** Medium
**File:** `apps/web/src/components/layout/header.tsx` — lines 92-103

**Description:** The notification bell opens a dropdown that always shows "No new notifications / You're all caught up." There is no API call, no polling, and no data model backing it. The bell has an implied red badge dot in the employee portal layout (`apps/web/src/app/(employee)/layout.tsx`, line 262: `<span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />`) that hardcodes a permanent red notification badge with no backing data. This tells users they have notifications when they do not.

---

### MEDIUM-UX-015: Engagement/Segments module placement in sidebar is incorrect for IA

**Severity:** Medium
**File:** `apps/web/src/components/layout/sidebar.tsx` — lines 35-37

**Description:** Segments and Engagement are sidebar items 9 and 0 (accessible via keyboard shortcuts). Their breadcrumbs in `admin-shell.tsx` are:
- `'/segments': 'Members > Segments'`
- `'/engagement': 'Members > Engagement'`

The breadcrumbs correctly reveal these as sub-features of Members, but the sidebar presents them as co-equal top-level modules with their own icons and shortcuts. This contradicts the breadcrumb information architecture. Users who navigate via the sidebar see "Segments" and "Engagement" as independent modules; users who navigate via breadcrumbs see them as nested under "Members."

---

### MEDIUM-UX-016: Missing `<label>` association on inputs in inline forms

**Severity:** Medium
**Scope:** Multiple inline forms

**Description:** Several pages use raw `<input>` elements with adjacent text nodes or visually-placed labels that are not programmatically associated via `htmlFor` / `id` pairs. Examples:
- Search inputs throughout (Members page, Campaigns list, Lead Pipeline) use `<input type="text">` with a placeholder but no `<label>` element.
- The tag input in `corporate/new/page.tsx` (line 361) uses `onKeyDown` with no associated label.

The `AddMemberModal` (`AddMemberModal.tsx`, line 66) does use `<label>` elements correctly. The inconsistency suggests labels were added to the modal as an afterthought rather than as a systematic pattern.

---

## 7. Low Findings

---

### LOW-UX-017: HeroMetricCard and WeeklyReviewBar placed in `(admin)/_components/` rather than `components/ui/`

**Severity:** Low
**File:** `apps/web/src/app/(admin)/_components/HeroMetricCard.tsx`
**File:** `apps/web/src/app/(admin)/_components/WeeklyReviewBar.tsx`

These components are generic enough to be used on other pages (e.g., the Analytics Overview page renders its own inline `MetricCard` rather than importing `HeroMetricCard`). Placing them under `(admin)/_components/` makes them invisible to other route groups.

---

### LOW-UX-018: Recharts color tokens not referenced from design system

**Severity:** Low
**File:** `apps/web/src/app/(admin)/revenue/_components/OverviewTab.tsx` — line 75
**File:** `apps/web/src/app/(admin)/analytics/kpi/_components/KpiDeepDiveClient.tsx` — lines 115-126

Both files define their own chart color arrays (e.g., `['#4F46E5', '#8B5CF6', '#14B8A6', '#F59E0B', '#10B981']`) as inline constants. These values match the design system tokens, but they're duplicated. A single `CHART_COLORS` array exported from `lib/constants.ts` or `lib/chart-theme.ts` would keep them DRY.

---

### LOW-UX-019: `cursor-pointer` on non-interactive stat cards without click handler

**Severity:** Low
**File:** `apps/web/src/app/(admin)/page.tsx` — line 204
**File:** `apps/web/src/app/(admin)/_components/HeroMetricCard.tsx` — line 46

Both `MetricCard` and `HeroMetricCard` apply `cursor-pointer` and `hover:shadow-md` hover effects, suggesting they are clickable. Neither has an `onClick` handler. The design intent ("every number should be clickable/drillable" from the PRD) is sound, but the affordance currently lies about the interactive state.

---

### LOW-UX-020: Employee portal notification badge hardcoded red with no data

**Severity:** Low
**File:** `apps/web/src/app/(employee)/layout.tsx` — line 262

```tsx
<span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
```

A permanent, unconditional red badge dot on the notification bell in the employee header implies the user always has unread notifications. Since there is no notification system yet, this should be removed until actual notification data is available.

---

### LOW-UX-021: `w-4.5` is not a valid Tailwind v3 utility (used in AI Insights header)

**Severity:** Low
**File:** `apps/web/src/app/(admin)/analytics/insights/_components/AIInsightsClient.tsx` — line 176

```tsx
<Sparkles className="w-4.5 h-4.5 text-white" />
```

`w-4.5` does not exist in Tailwind v3's default spacing scale (which increments at 0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5). This class will silently produce no width effect, defaulting the icon to its intrinsic SVG size. In Tailwind v4 this may work if the 4.5 step exists in the new scale. This should be `w-[18px]` or `w-5`.

---

### LOW-UX-022: Date format inconsistency between modules

**Severity:** Low
**Scope:** Multiple files

**Description:** Date formats observed across the app:
- `formatEasternTime()` in `page.tsx` produces 12-hour time strings (`5:00 PM`)
- `formatLastVisit()` in `members/page.tsx` produces relative strings (`3 days ago`, `2mo ago`)
- `formatJoinDate()` in `members/page.tsx` produces `Apr 5, 2026` (short month, no leading zero)
- Transaction dates in `TransactionsTab.tsx` use `t.date` (raw string from API, format uncontrolled)
- `getTimeAgo()` in `AIInsightsClient.tsx` produces `2 hours ago`, `1 day ago`, `3 weeks`

There is no centralized date formatting utility used consistently. `@meridian/utils` has date utilities — they should be audited and used uniformly. "3 weeks" (no "ago") in `getTimeAgo` is grammatically incomplete.

---

### LOW-UX-023: Segments page `SegmentsClient.tsx` adds its own `p-6 lg:p-8` inside AdminShell

**Severity:** Low
**File:** `apps/web/src/app/(admin)/segments/_components/SegmentsClient.tsx` — line 152

The component's outer div is:
```tsx
<div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0F0F11] p-6 lg:p-8">
```
This adds padding *on top of* the AdminShell's `p-5 md:p-7`. The Segments page has more padding than any other admin page.

---

## 8. Responsive Design Assessment

The admin dashboard is designed for desktop. The responsive breakpoints observed:
- `grid-cols-2 lg:grid-cols-4` on hero metric cards (wraps to 2 on tablet — acceptable)
- `hidden md:table-cell` columns in member table rows (columns progressively hide on mobile — well done)
- `hidden md:flex` on header search/status bar (collapses on mobile — acceptable)

**Gaps:**
- The sidebar (`w-[240px]` or `w-[72px]`) is always visible with no mobile hamburger menu. On viewports < 600px, the sidebar + content would overflow or be very cramped. No `sm:` breakpoint override exists for the sidebar width.
- The AdminShell `main` element uses `pl-[240px]` or `pl-[72px]` as fixed left padding. On mobile, this leaves very little room for content.
- This is an admin dashboard accessed primarily on desktop — the severity is Low-Medium, but any iPad access will have a degraded experience.

---

## 9. Interaction Design

### Primary Actions
Primary CTA buttons (`bg-indigo-600 text-white`) are consistently styled. "New Campaign," "Quick Create," "Add Member" are all visually prominent and well-placed.

### Destructive Actions
The Campaigns action dropdown (`CampaignsClient.tsx`, line 106) correctly styles Delete in red (`text-red-600 hover:bg-red-50`) with a separator. No confirmation dialog is wired — the delete action is immediate. This is an acceptable interaction for a list item but should be reviewed for critical operations.

### Form Validation
`AddMemberModal` shows an error state (`addError`) inline below the form. Most form pages (campaign new, automation new, product new) use HTML5 `required` attributes but no visible real-time validation feedback. Error states are not consistently structured across forms.

### Modals vs Full Pages
The `AddMemberModal` is a modal. Most other creation flows use full pages (`/marketing/campaigns/new`, `/corporate/new`, `/revenue/products/new`). This is appropriate — complex multi-step forms belong on full pages. The member quick-add being a modal is correct.

### Command Palette
The command palette is implemented well using shadcn/ui `CommandDialog`. It has correct keyboard accessibility (built into the primitive), navigation items, quick actions, and employee portal shortcuts. The stale navigation list (missing Corporate, wrong shortcut for Operations) as described in HIGH-UX-003 is the primary gap.

---

## 10. Accessibility Summary

| Check | Status |
|-------|--------|
| Semantic HTML (no `<div onClick>`) | Pass — no div onClick patterns found |
| `aria-label` on interactive elements | Fail — systemic absence (2 instances total) |
| Focus-visible styles | Partial — `focus:ring-2 focus:ring-indigo-500/20` on some inputs, absent on buttons |
| Modal focus trap | Fail — AddMemberModal uses custom overlay, no trap |
| Keyboard navigation (tab order) | Not tested but no `tabIndex=-1` removals observed |
| `alt` text on images | N/A — no `<img>` elements found in admin components |
| Color as sole differentiator | Fail — status dots (member status) use color only |
| Heading hierarchy | Partial — H1 present on most pages, but no H2/H3 structure in long pages |
| Form label association | Partial — AddMemberModal uses labels; most search inputs do not |
| ARIA roles | Fail — `aria-labelledby`, `role=dialog`, `role=status` absent |

---

## Summary Table

| ID | Severity | Area | Title |
|----|----------|------|-------|
| CRITICAL-UX-001 | Critical | Layout | Double background / layout inflation on 20+ pages |
| CRITICAL-UX-002 | Critical | IA | Engagement page shows stub data with all-zero counts |
| HIGH-UX-003 | High | Navigation | Command palette missing Corporate; shortcut mismatch with sidebar |
| HIGH-UX-004 | High | Navigation | Breadcrumb in header is flat static string, not the Breadcrumbs component |
| HIGH-UX-005 | High | Navigation | Settings has no sidebar entry — not discoverable |
| HIGH-UX-006 | High | Architecture | Dark mode toggle logic duplicated across sidebar and employee layout |
| HIGH-UX-007 | High | Accessibility | Icon-only buttons have no accessible names (systemic) |
| HIGH-UX-008 | High | Design System | MetricCard and HeroMetricCard duplicate with divergent trend colors |
| MEDIUM-UX-009 | Medium | Design System | Engagement breakdown uses off-system color tokens |
| MEDIUM-UX-010 | Medium | IA | Page H1 headings at inconsistent vertical positions due to double padding |
| MEDIUM-UX-011 | Medium | Accessibility | AddMemberModal lacks focus trap, Escape key handler, and ARIA roles |
| MEDIUM-UX-012 | Medium | Dark Mode | Recharts axis/grid colors hardcoded for light mode only |
| MEDIUM-UX-013 | Medium | UX | Dark mode toggle icon inverted — shows current state, not action |
| MEDIUM-UX-014 | Medium | Data Display | Notification dropdown is permanently empty; employee bell shows false badge |
| MEDIUM-UX-015 | Medium | IA | Segments/Engagement listed as top-level sidebar modules, breadcrumbs say sub-feature |
| MEDIUM-UX-016 | Medium | Accessibility | Search inputs and tag inputs lack associated `<label>` elements |
| LOW-UX-017 | Low | Component Org | HeroMetricCard/WeeklyReviewBar in admin-only directory, not shared ui |
| LOW-UX-018 | Low | Design System | Chart color arrays duplicated across files rather than from a shared constant |
| LOW-UX-019 | Low | Interaction | cursor-pointer on metric cards without onClick handlers |
| LOW-UX-020 | Low | Data Display | Employee portal bell has permanent hardcoded red badge |
| LOW-UX-021 | Low | CSS | `w-4.5` not a valid Tailwind utility class |
| LOW-UX-022 | Low | Consistency | Date format inconsistency across modules |
| LOW-UX-023 | Low | Layout | Segments page adds its own padding on top of AdminShell padding |
