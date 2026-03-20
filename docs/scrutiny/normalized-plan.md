# Meridian — Normalized Scrutiny Plan (v2 — PRD v1.0)

**Scrutiny Date:** 2026-03-20
**Complexity Class:** MAJOR
**Mode:** Deep+ (all 7 agents, extended analysis)
**Question:** Is this PRD ready for a developer to start building? What risks, gaps, or issues exist?

---

## 1. Core Proposition

Build a full-stack fitness studio operating system called Meridian that replaces Glofox for The Sauna Guys (Tampa, FL sauna/cold plunge studio). Scope for this build: admin dashboard + employee portal (Next.js, Supabase backend). The Supabase backend is also the shared foundation for future iOS apps and member web portal.

**Current state:** Pre-code. UI prototypes exist (MagicPath — Vite+React, 17 pages). PRD v1.0 locked. 18 edge cases all decided. No production code.

**Future:** SaaS product sold to other fitness/wellness studios once stress-tested internally.

---

## 2. What Is Being Built (PRD Scope)

### Phase 1 — Admin Dashboard + Employee Portal
- Admin Dashboard: 8 modules (Command Center, Schedule, Members, Revenue, Marketing, Operations, Analytics + Segments)
- Employee Portal (web): clock in/out with geofencing, timesheets, payroll, trainer performance, promo codes
- Supabase backend: Postgres schema + RLS + Edge Functions + Auth — shared foundation for all future apps
- Stripe integration: memberships (recurring), drop-ins, credit packs, merch, gift cards, proration
- Resend email: transactional + marketing campaigns
- AI Briefing Card: rules-based + LLM via Anthropic SDK (Claude)
- QR code check-in system
- Data migration from Glofox (CSV export already available)

### Explicitly OUT of scope for this build
- iOS member app (Phase 2 — React Native)
- Member web booking portal (Phase 1 but stated as "separate future build" in PRD Section 13)
- Walk-in kiosk (separate — part of employee iOS app per Section 13)
- Landing page (Astro — partial build exists, Wix operational now)

**NOTE: Scope conflict — Section 11 (Phase 1 deliverables) includes "Web Booking Portal" but Section 13 explicitly excludes it. This is unresolved.**

---

## 3. Tech Stack (Locked)

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router), hosted Netlify |
| Backend | Supabase (Postgres + Auth + Realtime + Edge Functions) |
| Database | Postgres with pgvector, RLS multi-tenancy |
| Payments | Stripe direct (+ Apple Pay, Google Pay) |
| Auth | Supabase Auth (Magic Link / SSO for members) |
| Email | Resend |
| SMS | Stubbed, provider TBD, provider-agnostic architecture |
| AI/LLM | Anthropic SDK (Claude) |
| Repo | Turborepo monorepo |
| UI | shadcn/ui + Tailwind v4 + Framer Motion + Recharts |
| Icons | Lucide React (~65 icons) |
| Charts | Recharts (Area, Line, Bar, Pie/Donut) |

---

## 4. Business Model Context (The Sauna Guys)

- **Facility:** 1 sauna (12-person capacity), 6 cold plunges, Tampa, FL
- **Booking model:** Group-class time slots (like yoga), NOT individual resource reservation
- **Class types:** Open Sauna/Free Flow (self-directed, 12 max) and Guided (instructor-led breathwork, 7-10 typical)
- **Weekly schedule:** ~17 slots — Weekdays Mon-Fri 5/6/7pm, Weekends Sat-Sun 9/10/11am/12pm
- **Current scale:** ~11 active memberships + additional class pack users, 3 trainers
- **Trainers:** Whitney (Wed 7pm), Drennen (Sun 12pm), Trent (Mon 6pm)

**Pricing (locked):**
- Unlimited $225/mo (2 guest passes/month)
- 10-class $180/mo (1 guest pass/month)
- 6-class $120/mo (1 guest pass/month)
- 8-pack $225, 4-pack $120, Sampler 3-pack $60 (no expiry)
- Drop-in: $39
- Private events: $395/hr first hour, tapering rate (configurable)
- Gift cards: $39, $120, $225 preset + custom amount (wallet balance, never expires)
- Member discount: 10% off merch + gift cards for active recurring members

**Trainer economy (locked):**
- Base: $35/class
- Bonus: $20 if 7+ check-ins (evaluated at class end; trainer excluded from count)
- Promo commission: 10% of attributed sale (code-based, point-in-time, one use per member)

---

## 5. Key Design & Policy Decisions (All Locked)

**Roles:** Single account, multiple roles (owner+member, trainer+member)
**Analytics exclusion:** Toggle per profile; excluded from revenue/attendance but counts toward physical capacity
**Race condition:** Atomic insert, first to submit wins
**Strike system:** 1st free, 2nd $5, 3rd $10 (rolling 30-day); unlimited members = warning only
**Strike toggles:** System-level ON/OFF + member-level override (30-day auto-expiry)
**"Move" rule:** Rebook in same action = treated as move, not cancellation (no strike)
**Waitlist:** 15-min claim window; shortens if class is <15 min away; push first, SMS fallback; skip expired credits
**Proration:** Stripe native, transparent preview; old credits void on upgrade; downgrade at next cycle
**Credit expiry:** 7-day grace period; deducted at booking time (not class time); notify at 7/3/1 days
**Credit deduction priority:** Soonest-expiring first (for credit packs)
**Gift cards:** Wallet balance (not split payment); wallet consumed before card; never expires
**Discount lock:** 30-min checkout window; locked at start
**Family accounts:** Shared credit pool, individual strikes, parent waiver covers minors, pool freezes if parent lapses (7-day grace before auto-cancel)
**Promo attribution:** Code-based, final, no retroactive; admin can void fraud but not reassign
**Bonus evaluation:** At class end or 30 min after start
**Owner booking:** Acts as member, respects capacity, override requires audit log
**Trainer self-check-in:** Optional wellness tracking toggle; doesn't count toward bonus
**Migration:** 5-wave soft migration parallel with Glofox (4-8 weeks)
**Merch:** In-studio pickup Phase 1; shipping DB schema built now; carrier APIs inactive
**Guest passes:** Tier-based (1-2/month); QR/link invite; counts toward capacity; host must be present; linked to specific class; conversion tracking; reward structure TBD
**Geofencing radius:** 200 meters for employee clock-in
**Late arrival:** 50%+ of class duration elapsed = treated as no-show (staff override available)
**Real-time:** 60-second polling Phase 1, WebSocket-ready Phase 2
**Multi-tenancy:** studio_id/location_id on every table, RLS from day one

---

## 6. Design System (Complete)

- Source: MagicPath prototype (17 designed pages: 9 admin + 8 employee portal)
- **Complete design tokens:** colors (17 values), typography (8 type styles), spacing, radius, animation specs
- **Component specs:** Badge, Card, Metric Card, Button (primary/secondary), Sidebar, Table, Modal, Toast, Clock widget
- **Animation specs:** page transitions (250ms), nav pill (shared layout), progress bars (staggered), sidebar collapse, mobile overlay, skeleton loading
- **Route structure:** Defined for Next.js App Router (admin/employee/member/auth route groups)
- **Dependencies:** Keep/drop list defined; known packages to add for Next.js build listed
- **Known data corrections:** 13 values in MagicPath prototypes use wrong prices/names (documented in design guide Section 7)
- **Waiver text:** Full legal text provided in PRD Appendix A (references "Cigar City CrossFit" — needs facility name update)

---

## 7. What Specifically to Scrutinize

1. **Developer readiness:** Is PRD v1.0 complete enough to hand to a developer? What's missing?
2. **Technical gaps:** Supabase schema not written. API contracts not defined. Auth middleware not specified. What else?
3. **Scope vs. team size:** 8 modules, 30 pages, full backend, 3 integrations — what's realistic for a small team?
4. **Phase 1 conflicts:** Section 11 includes web booking portal; Section 13 excludes it. Resolution needed.
5. **Edge case completeness:** Are all 18 policies implementable as written? Any contradictions?
6. **AI architecture:** Is "AI from day one" achievable or should it be phased?
7. **Stripe complexity:** Direct integration with memberships, proration, gift card wallet, member discounts — correct approach?
8. **Multi-tenancy upfront:** RLS from day one at The Sauna Guys scale (~11 members) — right call?
9. **Migration risk:** Running Glofox parallel during migration — what can go wrong?
10. **SaaS ambition vs. internal tool:** Building for one studio but designing for N studios — does the PRD reflect this tension correctly?

---

## 8. Existing System Context

**Working directory:** /Users/zach/Desktop/Fitness Dashboard
**Prototype files:** magicpath-project (11)/ — 9 admin pages, 5,474 lines Vite+React; magicpath-project (12)/ — 8 employee portal pages, 2,189 lines Vite+React
**Current operational system:** Glofox (must stay live during migration)
**Data available:** Glofox CSV export already saved
**No production code exists**
