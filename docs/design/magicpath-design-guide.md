# Meridian — Design Guide (Extracted from MagicPath)

**Source:** MagicPath projects 11 (Admin Dashboard) and 12 (Employee Portal)
**Date:** March 19, 2026
**Purpose:** Reference guide for building the real Meridian app in Next.js. All UI patterns, design tokens, component specifications, and animation details extracted from MagicPath output.

---

## 1. Design Tokens

### Colors

| Role | Hex | Tailwind | Usage |
|---|---|---|---|
| **Primary** | `#4F46E5` | `indigo-600` | Buttons, active states, sidebar, charts, links |
| **Primary Light** | `#EEF2FF` | `indigo-50` | Selected backgrounds, hover states |
| **Violet** | `#8B5CF6` | `violet-500` | Guided classes, AI gradient, secondary accent |
| **Success** | `#10B981` | `emerald-500` | Active status, positive trends, check-ins, clock-in state |
| **Warning** | `#F59E0B` | `amber-500` | Alerts, scheduled states, pending items |
| **Danger** | `#F97316` | `orange-500` | Churn risk, negative trends, failed payments |
| **Error** | `#EF4444` | `red-500` | Destructive actions, expired items |
| **Teal** | `#14B8A6` | `teal-500` | Merch category, front desk role |
| **Background** | `#FAFAFA` | Custom | App-level background |
| **Content Area** | `#F5F5F4` | Custom | Main content background |
| **Cards** | `#FFFFFF` | `white` | All card surfaces |
| **Text Primary** | `#111827` | `gray-900` | Headings, primary text |
| **Text Secondary** | `#6B7280` | `gray-500` | Body text, descriptions |
| **Text Tertiary** | `#9CA3AF` | `gray-400` | Labels, placeholders |
| **Borders** | `#E5E7EB` | `gray-200` | Card borders, dividers |
| **Borders Light** | `#F3F4F6` | `gray-100` | Subtle dividers |

### AI Visual Treatment
```css
/* Indigo-to-violet gradient border for AI insight cards */
background: linear-gradient(white, white) padding-box,
            linear-gradient(135deg, rgba(99,102,241,0.4), rgba(139,92,246,0.4)) border-box;
border: 1px solid transparent;

/* Interior subtle gradient overlay */
background: linear-gradient(135deg, rgba(99,102,241,0.04), rgba(139,92,246,0.04));
```
Icon: Sparkles from Lucide React

### Typography

| Element | Classes | Example |
|---|---|---|
| Page title | `text-2xl font-black text-gray-900` | "Command Center" |
| Section header | `text-lg font-bold text-gray-900` | "Class Status Board" |
| Card header | `font-bold text-gray-900` (base size) | "Active Membership" |
| Large metric | `text-[28px] font-black text-gray-900 tabular-nums` | "$2,847" |
| Medium metric | `text-2xl font-bold` or `text-xl font-black` | "34" |
| Micro label | `text-[10px] font-bold uppercase tracking-widest text-gray-400` | "BOOKINGS TODAY" |
| Body | `text-sm text-gray-600` | Description text |
| Small | `text-xs text-gray-500` | Timestamps, metadata |
| Clock display | `font-mono text-5xl font-black` | "3:30 PM" |

**Font Family:** Inter (Google Fonts), with system fallbacks: `-apple-system, BlinkMacSystemFont, sans-serif`
**Font Weights Used:** medium (500), semibold (600), bold (700), black (900)

### Spacing

| Element | Value | Tailwind |
|---|---|---|
| Card padding | 20px | `p-5` |
| Modal padding | 24px | `p-6` |
| Main content padding (mobile) | 16px | `p-4` |
| Main content padding (tablet) | 24px | `md:p-6` |
| Main content padding (desktop) | 32px | `lg:p-8` |
| Section gaps | 20px | `space-y-5` |
| Grid gaps | 12-20px | `gap-3` to `gap-5` |
| Sidebar width (expanded) | 240px (admin), 220px (employee) | Custom |
| Sidebar width (collapsed) | 72px (admin), 64px (employee) | Custom |
| Header height | 64px | `h-16` |
| Content max-width (admin) | 1280px | `max-w-7xl` |
| Content max-width (employee) | 1024px | `max-w-5xl` |

### Border Radius

| Element | Value | Tailwind |
|---|---|---|
| Cards | 16px | `rounded-2xl` |
| Buttons | 12px | `rounded-xl` |
| Inputs | 12px | `rounded-xl` |
| Badges | Full | `rounded-full` |
| Nav items | 12px | `rounded-xl` |
| Modals | 16px | `rounded-2xl` |
| Progress bars | Full | `rounded-full` |
| Large avatars | 16px | `rounded-2xl` |
| Small avatars | Full | `rounded-full` |

---

## 2. Component Specifications

### Badge
```
Pill-shaped status indicator
Sizes: xs (text-[9px] px-1.5 py-0.5), sm (text-[10px] px-2 py-0.5)
Variants: indigo, amber, emerald, orange, gray, violet, red, teal
Pattern: bg-{color}-50 text-{color}-700 (light bg + dark text)
Border radius: rounded-full
Font: font-bold uppercase tracking-wider
```

### Card
```
Container: bg-white rounded-2xl border border-gray-200 shadow-sm
Hover (clickable): hover:shadow-md hover:border-indigo-100
Padding: p-5 (standard), p-6 (feature cards)
```

### Metric Card
```
Label: text-[10px] font-bold uppercase tracking-widest text-gray-400
Value: text-[28px] font-black text-gray-900 tabular-nums
Trend: flex items-center gap-1 text-xs font-bold
  Positive: text-emerald-600 (ArrowUpRight icon)
  Negative: text-orange-600 (ArrowDownRight icon)
  Neutral: text-gray-500
Sparkline/icon optional
```

### Button (Primary)
```
bg-indigo-600 text-white rounded-xl px-4 py-2.5
font-bold text-sm
hover:bg-indigo-700
active:scale-95
transition-colors
Shadow: shadow-sm
Icon + text pattern: flex items-center gap-2
```

### Button (Secondary)
```
bg-white border border-gray-200 text-gray-700 rounded-xl px-4 py-2.5
font-medium text-sm
hover:bg-gray-50
transition-colors
```

### Sidebar Navigation
```
Width: 240px expanded, 72px collapsed
Background: bg-white, border-r border-gray-200
Logo: Indigo square (rounded-xl) with "M" + "Meridian" text
Active indicator: animated indigo pill bar (left side, layoutId animation)
Active item: bg-indigo-50 text-indigo-700
Inactive item: text-gray-500 hover:bg-gray-50 hover:text-gray-900
Collapsed: icons only, tooltips on hover
Bottom: dark mode toggle, user avatar + name + role badge, logout
```

### Table
```
Standard HTML table (not shadcn DataTable)
Header: text-[10px] font-bold uppercase tracking-widest text-gray-400
Row hover: hover:bg-gray-50/50
Selected row: bg-indigo-50/40 border-l-2 border-l-indigo-500
Cell padding: px-4 py-3
Responsive: hidden md:table-cell for secondary columns
```

### Modal
```
Backdrop: bg-gray-900/40 backdrop-blur-sm
Container: bg-white rounded-2xl shadow-2xl max-w-md mx-auto
Animation: scale 0.96→1, opacity 0→1, y 12→0
Close: X button top-right, ESC key, backdrop click
```

### Toast
```
Position: fixed bottom-right (bottom-6 right-6)
Max visible: 4, stacks upward
Animation: slide from right (x: 40→0), scale 0.95→1, 220ms
Auto-dismiss: 4-4.5 seconds
Types: success (emerald), error (red), warning (amber), info (indigo)
Manual dismiss: X button
```

### Clock In/Out Widget (Employee Portal)
```
Hero element — most prominent on page
Clock out state: Large indigo circle button (192x192px), "Clock In" text
Clocked in state: Large emerald circle button, "Clock Out" text, live timer
Timer: font-mono, HH:MM:SS counting up
Geofencing: "At Studio ✓" (green) or "Outside Studio ⚠" (amber)
Break button: appears below main button when clocked in
whileTap: scale 0.96
```

---

## 3. Animation Specifications

### Page Transitions
```js
initial: { opacity: 0, y: 6 }
animate: { opacity: 1, y: 0 }
exit: { opacity: 0, y: -4 }
transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] }
// Wrap with <AnimatePresence mode="wait">
```

### Nav Active Pill
```js
<motion.div layoutId="nav-pill" />
// Framer Motion shared layout animation — pill smoothly moves between nav items
```

### Progress Bars
```js
initial: { width: 0 }
animate: { width: `${percentage}%` }
transition: { duration: 0.8-1.0, ease: "easeOut", delay: index * 0.1 }
```

### Sidebar Collapse
```
transition-all duration-300
Expanded: width 240px, show text labels
Collapsed: width 72px, show icons only, tooltips on hover
```

### Mobile Sidebar Overlay
```js
initial: { x: -240 }
animate: { x: 0 }
transition: { type: "spring", damping: 28, stiffness: 300 }
```

### Toast Entry
```js
initial: { opacity: 0, x: 40, scale: 0.95 }
animate: { opacity: 1, x: 0, scale: 1 }
transition: { duration: 0.22, ease: [0.25, 1, 0.5, 1] }
```

### Skeleton Loading
```
animate-pulse with gray placeholder blocks
300ms delay before showing skeleton (prevents flash for fast loads)
```

---

## 4. Responsive Breakpoints

| Breakpoint | Width | What Changes |
|---|---|---|
| Mobile | < 768px | Sidebar hidden, bottom tab nav, stacked layouts, some columns hidden |
| Tablet (md) | 768px | Sidebar visible, 2-column grids, more table columns |
| Desktop (lg) | 1024px | Full sidebar, 3-5 column grids, all table columns, side panels |

### Key Responsive Patterns
- Grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` (or up to 5)
- Table columns: progressively reveal with `hidden sm:table-cell`, `hidden md:table-cell`
- Sidebar: `hidden md:flex` on desktop, hamburger-triggered overlay on mobile
- Bottom nav (employee): `md:hidden` — 5 icons, mobile only
- Content padding: `p-4 md:p-6 lg:p-8`

---

## 5. Icon Library

**Lucide React** (`lucide-react`)

~65 unique icons used across both projects. Key icons by function:

| Function | Icon |
|---|---|
| AI/Insights | `Sparkles` |
| Navigation | `LayoutDashboard`, `Calendar`, `Users`, `DollarSign`, `Megaphone`, `Building2`, `BarChart3`, `Target`, `Trophy` |
| Employee Nav | `Home`, `Clock`, `BookOpen`, `Tag`, `User` |
| Actions | `Plus`, `Edit3`, `Copy`, `Download`, `Send`, `Share2`, `Eye`, `Trash2` |
| Status | `CheckCircle2`, `AlertCircle`, `TrendingUp`, `TrendingDown`, `ArrowUpRight`, `ArrowDownRight` |
| UI | `Search`, `Bell`, `Menu`, `X`, `ChevronRight`, `ChevronLeft`, `ChevronDown`, `MoreHorizontal`, `Filter` |
| Theming | `Sun`, `Moon` |
| Domain | `Flame` (sauna), `Activity` (wellness), `Award` (achievements), `MapPin` (geofencing) |

---

## 6. Charts (Recharts)

| Chart Type | Used In | Data Pattern |
|---|---|---|
| AreaChart | Revenue trends | Multi-series stacked, gradient fills |
| LineChart | Cohort retention, Attendance trend | Multi-line with reference line for threshold |
| BarChart (stacked) | Earnings breakdown (base + bonus) | Monthly breakdown |
| PieChart (donut) | Revenue by source | 6 categories, inner radius for donut |

**Chart color palette:**
- `#4F46E5` (indigo) — primary series
- `#6366F1` (lighter indigo) — secondary
- `#8B5CF6` (violet) — guided/tertiary
- `#14B8A6` (teal) — merch
- `#F59E0B` (amber) — corporate
- `#10B981` (emerald) — gift cards

---

## 7. Data That Needs Correction

| MagicPath Value | Correct Value |
|---|---|
| Unlimited: $149/mo | $225/mo |
| 10-Class: $129/mo | $180/mo |
| 6-Class: $79/mo | $120/mo |
| Day Pass: $35 | Drop-In: $39 |
| 10-person capacity | 12-person capacity |
| Bonus threshold: 8 | Bonus threshold: 7 |
| Trainer pay: $22.50/hr | $35/class + $20 bonus |
| Promo commission: varies | 10% of attributed sale |
| Whitney Chen | Whitney (real name TBD) |
| Marcus Rivera | Drennen |
| Jordan Lee | Trent |
| "Cigar City CrossFit" | The Sauna Guys current facility |
| 4 time slots | 3 weekday (5/6/7pm), 4 weekend (9/10/11/12) |
| Kiosk Mode in sidebar | Remove from admin dashboard |
| Mobile App in sidebar | Remove from admin dashboard |

---

## 8. Dependencies to Keep vs. Drop

### Keep (actively used)
| Package | Purpose |
|---|---|
| `react` / `react-dom` | Core |
| `lucide-react` | Icons |
| `recharts` | Charts |
| `framer-motion` | Animations |
| `tailwind-merge` + `clsx` | Class utilities |
| `tailwindcss` + `tailwindcss-animate` | Styling |

### Drop (MagicPath boilerplate, unused)
`@dnd-kit/*`, `@headless-tree/*`, `@react-three/*`, `three`, `class-variance-authority`, `cmdk`, `date-fns`, `embla-carousel-react`, `input-otp`, `next-themes`, `radix-ui`, `react-day-picker`, `react-hook-form`, `@hookform/resolvers`, `react-resizable-panels`, `sonner`, `uuid`, `vaul`, `zod`

### Add for Next.js Build
| Package | Purpose |
|---|---|
| `next` | Framework |
| `@supabase/supabase-js` | Backend |
| `@supabase/ssr` | Server-side auth |
| `@stripe/stripe-js` + `stripe` | Payments |
| `@anthropic-ai/sdk` | AI/LLM |
| `resend` | Email |
| `sharp` | Image optimization |
| `react-native` (separate package) | iOS app (Phase 2) |

---

## 9. Architecture Migration Notes

### MagicPath → Next.js Mapping

| MagicPath | Next.js |
|---|---|
| Single-file components (2,000-3,700 lines) | Component tree in `/components` |
| `useState` page routing | App Router (`/app/(admin)/`, `/app/(employee)/`, `/app/(member)/`) |
| Inline mock data arrays | Supabase queries via Server Components or React Query |
| No auth | Supabase Auth with role-based middleware |
| Vite dev server | Next.js dev server on Netlify |
| Single entry point | Route groups with shared layouts |

### Suggested Route Structure (Next.js App Router)
```
app/
├── (admin)/
│   ├── layout.tsx          # Admin sidebar + header
│   ├── page.tsx            # Command Center (dashboard)
│   ├── schedule/
│   ├── members/
│   │   ├── page.tsx        # Directory
│   │   └── [id]/page.tsx   # Member profile
│   ├── revenue/
│   ├── marketing/
│   ├── operations/
│   │   ├── employees/
│   │   ├── facilities/
│   │   ├── waivers/
│   │   └── settings/
│   ├── analytics/
│   └── segments/
├── (employee)/
│   ├── layout.tsx          # Employee sidebar + header
│   ├── page.tsx            # Home (clock in/out)
│   ├── schedule/
│   ├── timesheets/
│   ├── pay/
│   ├── profile/
│   ├── classes/            # Trainer only
│   ├── performance/        # Trainer only
│   └── promo/              # Trainer only
├── (member)/
│   ├── layout.tsx          # Member nav
│   ├── page.tsx            # Schedule/booking
│   ├── account/
│   ├── merch/
│   └── community/
├── (auth)/
│   ├── login/
│   └── callback/
└── (marketing)/
    └── ... (Astro site handles this for now)
```
