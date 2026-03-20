# Meridian — Fitness Studio Operating System

Full-stack management platform for fitness/wellness studios. Replaces Glofox. Built for The Sauna Guys (Tampa sauna/recovery studio), designed for SaaS from day one.

## Architecture

Turborepo monorepo with shared packages:

```
apps/
  web/                    # Next.js — admin dashboard + employee portal (role-based routing)
packages/
  types/                  # Shared TypeScript interfaces (Member, Booking, Class, etc.)
  supabase/               # Supabase client, queries, RLS helpers
  business-logic/         # Pricing, credits, strikes, proration rules
  ui/                     # Shared shadcn/ui components styled with Meridian tokens
  utils/                  # Date formatting, currency, validation
```

**Route groups (Next.js App Router):**
- `(admin)/` — studio owner/manager dashboard (8 modules)
- `(employee)/` — trainer/staff portal (clock in/out, timesheets, pay, performance)
- `(auth)/` — login, magic link callback

**Future apps (separate builds, same Supabase backend):**
- React Native iOS app (employee + member)
- Member web booking portal (Next.js)
- Landing page (Astro — Wix operational for now)

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) on Netlify |
| Language | TypeScript (strict) |
| Monorepo | Turborepo |
| Database | Supabase (Postgres 17, us-west-2) |
| Auth | Supabase Auth — Magic Link / SSO (passwordless) |
| Payments | Stripe (direct, not Connect) + Apple Pay + Google Pay |
| AI/LLM | Anthropic SDK (Claude) — core infrastructure |
| Vector Search | pgvector |
| Email | Resend + @react-email/components |
| SMS | Stubbed out — provider TBD |
| Components | shadcn/ui (Radix primitives) + Meridian design tokens |
| Icons | Lucide React |
| Charts | Recharts |
| Animations | Framer Motion |
| Styling | Tailwind CSS v4 |
| Data Fetching | @tanstack/react-query |
| Validation | Zod |
| Real-time | 60-second polling (Phase 1), WebSocket-ready Phase 2 |

## Supabase

- **Project:** TSG SaaS
- **ID:** rhdmiyttafsbfuflnjza
- **Region:** us-west-2
- **Multi-tenancy:** Every table has `studio_id` — Postgres RLS enforces tenant isolation
- **Env vars:** `.env.local` (never committed)
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

## Design System

**Aesthetic:** Linear meets Apple Health meets Stripe Dashboard. Confident, information-dense, never boring.

| Token | Value | Tailwind |
|---|---|---|
| Primary | `#4F46E5` | indigo-600 |
| Violet/AI | `#8B5CF6` | violet-500 |
| Success | `#10B981` | emerald-500 |
| Warning | `#F59E0B` | amber-500 |
| Danger | `#F97316` | orange-500 |
| Background | `#FAFAFA` | custom |
| Cards | `#FFFFFF`, `rounded-2xl`, `border`, `shadow-sm` | |
| Font | Inter (Google Fonts) | weights: 500/600/700/900 |
| Large metrics | `text-[28px] font-black tabular-nums` | |
| Micro labels | `text-[10px] font-bold uppercase tracking-widest` | |
| Buttons | `rounded-xl` (12px) | |
| Cards | `rounded-2xl` (16px) | |

**AI visual treatment:** Indigo-to-violet gradient border on AI insight cards. Sparkles icon.

**Full design guide:** `/Users/zach/Desktop/Fitness Dashboard/magicpath-design-guide.md`

## Business Model (The Sauna Guys)

**Group-class booking model** (NOT individual resource booking):
- 1 sauna (12 capacity), 6 cold plunges
- Hour-long time slots — members book a slot like a yoga class
- Two types: Open Sauna (self-directed) and Guided (instructor-led breathwork)

**Schedule:**
- Weekdays: 5pm, 6pm, 7pm (guided on Mon 6pm by Trent, Wed 7pm by Whitney)
- Weekends: 9am, 10am, 11am, 12pm (guided Sun 12pm by Drennen)

**Pricing:**
- Unlimited: $225/mo | 10-class: $180/mo | 6-class: $120/mo
- 8-pack: $225 | 4-pack: $120 | Sampler: $60 (3 classes)
- Drop-in: $39 | Private events: $395/hr first hour, configurable taper

**Trainer economy:** $35/class base + $20 bonus (7+ check-ins) + 10% promo commission

## Key Conventions

- **Single account, multiple roles** — owner+member, trainer+member under one email
- **Analytics exclusion toggle** — comped profiles excluded from revenue/attendance stats but count toward physical capacity
- **Credits deducted at booking time**, not check-in
- **Atomic insert** for booking race conditions (no hold pattern)
- **Progressive strike system** — 1st free, 2nd $5, 3rd $10. Rolling 30-day window. Unlimited members: warning-only. System + member-level toggles.
- **Late cancellation:** 1 hour before class (configurable in Settings)
- **Gift cards:** Wallet balance system. Never expires. No split payments.
- **Member discount:** 10% off merch/gift cards for active recurring members. Locked at checkout start.
- **Stripe native proration** for upgrades. Downgrades at next billing cycle.
- **Credit expiry:** 7-day grace period with auto-notifications at 7/3/1 days
- **Guest passes:** QR/link invite, counts toward capacity, same waiver, must attend with host
- **Geofencing:** 200m radius for employee clock-in verification

## Key Reference Documents

All in `/Users/zach/Desktop/Fitness Dashboard/`:

| File | Purpose |
|---|---|
| `meridian-prd.md` | Complete PRD — all decisions locked |
| `magicpath-design-guide.md` | Design tokens, components, animations, dependencies |
| `edge-case-policies.md` | All 18 edge case policies |
| `sauna-guys-business-model.md` | Business operations detail |
| `glofox-to-meridian-audit.md` | Architecture comparison and migration plan |
| `magicpath-project (11)/` | MagicPath admin dashboard source (reference UI) |
| `magicpath-project (12)/` | MagicPath employee portal source (reference UI) |

## Development Notes

- **Do not commit credentials.** `.env.local` must be in `.gitignore`.
- **"Meridian" is a working name** — may change. Keep branding configurable.
- **MagicPath code is reference only** — extract design patterns, don't copy architecture. It's single-file Vite+React; we're building proper Next.js with component splitting.
- **shadcn/ui components** should be styled with Meridian tokens, not default shadcn theme.
- **Every number in the UI should be clickable/drillable.**
- **Cmd+K command palette** for power users (all admin pages).
- **Dark mode** support required but not Phase 1 priority.
- **This project is managed through Claude Desktop** — present key content inline in conversation, not just written to files silently.
