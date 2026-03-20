# Scope Decomposition -- Meridian PRD v1.0 (Run 2)

**Date:** 2026-03-20
**Source:** Synthesis of all 7 scrutiny agent reports

---

## Revised Phase Structure

### Phase 0 -- Pre-Build (2-3 weeks)

| Task | Priority | Effort | Notes |
|---|---|---|---|
| Write database schema (all tables, columns, types, constraints, FKs) | BLOCKER | 1-2 days | All business logic is in PRD + edge cases. Translation work. |
| Write RLS policies for all tables x all roles | BLOCKER | 4-6 hours | 5 roles (owner, manager, trainer, front_desk, member) x 35-40 tables |
| Update PRD Section 13 -- remove web portal exclusion | BLOCKER | 30 min | Decision already made; text needs updating |
| Fix Edge Case 6 prices ($79/$149 to $120/$225) | HIGH | 5 min | Prevents wrong proration UI |
| Fix Edge Case 12 timing ("at class_end_time") | HIGH | 5 min | Prevents wrong bonus evaluation |
| Write auth flow spec (role storage, middleware, magic link, context switching) | HIGH | 2-4 hours | Implementation spec for decided architecture |
| Write Stripe integration spec (webhook inventory, payment surfaces, wallet offset) | HIGH | 4-6 hours | Implementation spec for each payment scenario |
| Write credit state machine (states, transitions, deduction algorithm, family pools) | HIGH | 3-4 hours | Most complex data problem in the system |
| Audit Glofox/Stripe Connect account type | CRITICAL | 1 hour | Call Stripe support. Determines payment method portability. |
| Request + validate full Glofox data export | CRITICAL | 2 hours | Verify member emails, credits, bookings, membership status |
| Create Supabase project + apply schema | HIGH | 2-3 hours | Project setup with schema and RLS |
| Configure Stripe products/prices ($120, $180, $225/mo + packs + drop-in) | HIGH | 1-2 hours | Sandbox first, then production |
| Set up Resend sending domain | MEDIUM | 30 min | DNS verification |
| Test Stripe proration in sandbox | MEDIUM | 2 hours | Validate Edge Case 6 formula with real API calls |
| Verify pg_cron on chosen Supabase plan | MEDIUM | 30 min | Required for scheduled jobs |
| Update waiver text ("Cigar City CrossFit" to actual facility name) | MEDIUM | 5 min | Legal liability if deployed as-is |
| Establish team size + Phase 1 target date | CRITICAL | Decision | Forcing constraint for scope |

---

### Phase 1 -- Core Operating System + Minimal Member Portal (4-6 months, 2 engineers)

#### Foundation (Week 1-2)
- Turborepo monorepo scaffold (@meridian/types, @meridian/db, @meridian/stripe, @meridian/email, @meridian/ui, @meridian/utils)
- Next.js App Router with route groups: (admin), (employee), (member), (auth)
- shadcn/ui installation + Meridian design tokens (CSS custom properties)
- Tailwind v4 global stylesheet
- Auth implementation (Supabase magic link + JWT custom claims + middleware)
- Role-based route gating in middleware.ts

#### Phase 1A: Core Admin (Month 1-3)
- Members module (directory, profiles, family accounts, analytics exclusion toggle)
- Schedule module (class slot creation, trainer assignment, recurring schedules)
- Revenue core (Stripe subscriptions, credit packs, drop-ins, proration)
- Booking engine (atomic insert, capacity check, credit reservation)
- Waitlist (auto-promotion, email notification, 30-min claim window for Phase 1)
- Check-in (name-based lookup + QR code scanning)
- Command Center (live metrics via polling, activity feed, rules-based AI briefing)
- Operations (staff management, roles/permissions, booking rules, settings)
- Waivers (digital signature, per-studio text from database)
- Email notifications (booking confirmation, cancellation, waitlist promotion, credit expiry)

#### Phase 1B: Trainer Economy + Employee Portal (Month 2-3, parallel)
- Trainer promo code dashboard (code performance, attributions, commission tracking)
- Trainer bonus visibility ("5/7 check-ins for tonight's class -- 2 more for bonus")
- Trainer payroll calculation (base + bonus + commission per pay period)
- Employee clock-in/out (geofenced, 300m radius, manager override)
- Timesheet management

#### Phase 1C: Member Web Portal (Month 3-4)
- Schedule view (upcoming slots, capacity, trainer info)
- Booking flow (select slot, confirm, credit deduction)
- Account management (view membership, credit balance, payment method)
- Self-service membership upgrade with proration preview
- QR code display for check-in
- Magic link authentication

#### Phase 1D: Migration + Go-Live (Month 4-6)
- Data migration (Waves 1-3: members, bookings, credits from Glofox CSV)
- Double-billing prevention (track Glofox renewal dates)
- Stripe customer creation for all migrated members
- Parallel operation period (staff uses Meridian, members still have Glofox access)
- Wave 4-5: switch members to Meridian booking, decommission Glofox

#### Explicitly Deferred from Phase 1
- Marketing module (entire module)
- Merch inventory and gift cards
- Full employee payroll (tax docs, detailed pay stubs)
- Community / social board
- Corporate module
- LLM-powered AI features (rules-based briefing is Phase 1)
- Automation flow builder
- Analytics dashboards (beyond Command Center metrics)
- Dunning automation (manual follow-up for Phase 1; automated in Phase 2)
- SMS notifications

---

### Phase 2 -- Engagement + Revenue Expansion (3-5 months)

**Marketing:**
- Email campaign builder (templates, audience selection, scheduling)
- Pre-built automation workflows (welcome series, failed payment, re-engagement, membership expiring, booking reminder)
- Lead pipeline (lead -> trial -> member tracking)
- Dunning automation (email escalation sequence on failed payment)

**Revenue expansion:**
- Merch inventory (SKUs, stock levels, in-studio pickup checkout)
- Gift card system (purchase, wallet balance, never-expires)
- Wallet offset payment flow (wallet consumed before card)

**Member experience:**
- Wellness journey tracking (visit history, streaks, personal records)
- Trainer public profiles (bio, photo, upcoming schedule)
- SMS integration (provider TBD, unblocks push-like waitlist notifications)
- Self-service membership downgrade (takes effect at next billing cycle)

**Employee:**
- Full payroll system (detailed pay stubs, exportable reports)
- Tax documentation
- Geofencing refinement based on Phase 1 data

---

### Phase 3 -- Intelligence (2-4 months)

- Analytics dashboards (utilization heatmap, cohort retention, revenue by dimension, class fill trends)
- LLM-powered AI briefing upgrade (replace rules engine with Claude-powered insights)
- Member AI summaries on profiles (behavioral patterns, churn risk score)
- Churn prediction (rules-based: visit frequency drop + payment history + membership age)
- pgvector + embedding model integration (semantic search across member notes, classes)
- Campaign analytics (open rate, click rate, revenue attribution)
- Advanced reporting (PDF export, scheduled email reports)

---

### Phase 4 -- Growth + SaaS (3-5 months)

- iOS React Native member app
- Corporate module (company accounts, corporate invoicing, usage reports) -- only if demand validated
- Event management (private events, group bookings, deposit scheduling)
- Merch shipping (activate DB infrastructure, carrier API integration)
- SaaS onboarding flow for new studios
- ClassPass integration (competitive gap closure vs. Mindbody)
- Multi-location support (if The Sauna Guys expands)
- Open API documentation

---

## Feature Priority Matrix

### Must Ship (Phase 1 -- before Glofox can be turned off)

- Group-class booking engine with capacity management and atomic insert
- Member-facing web booking portal (schedule, book, account, QR)
- Member directory + profiles with analytics exclusion
- Membership management + credits + self-service upgrades + proration
- Stripe billing (subscriptions, one-time payments, credit packs)
- Waitlists with auto-promotion (email + extended claim window)
- Check-in (name lookup + QR scanning)
- Staff + trainer management
- Trainer promo code dashboard + bonus visibility
- Business settings + booking rules
- Waivers
- Email transactional notifications
- Rules-based AI briefing on Command Center
- Employee clock-in/out with geofencing
- Data migration from Glofox

### Should Ship (Phase 2 -- within 6 months of Phase 1 go-live)

- Email campaigns (basic)
- Automation workflows (5 pre-built)
- Dunning automation
- Merch inventory + in-studio sales
- Gift cards + wallet
- Wellness journey tracking
- Trainer public profiles
- SMS integration

### Could Ship (Phase 3 -- based on demand)

- LLM-powered AI insights
- Churn prediction
- Analytics dashboards
- Advanced reporting

### Won't Ship Until Validated (Phase 4)

- Corporate portal (validate demand: track inquiries for 60 days first)
- iOS app (Phase 4, not Phase 2 -- web portal covers member needs initially)
- Community / social board (validate: only if 100+ active members)

### Drop Entirely

- Instagram API integration (use SnapWidget embed)
- Weather correlation analysis
- IoT equipment logging
- Custom dashboard widget builder (pre-built dashboards serve single-location better)

---

## Effort Estimates

| Phase | Solo Developer | 2-Person Team | Key Risk |
|---|---|---|---|
| Phase 0 | 2-3 weeks | 2 weeks | Stripe portability finding changes migration plan |
| Phase 1 | 6-10 months | 4-6 months | Scope creep; member portal underestimated |
| Phase 2 | 4-6 months | 3-4 months | Gift card wallet offset is complex Stripe work |
| Phase 3 | 3-4 months | 2-3 months | AI features need 3-6 months of data first |
| Phase 4 | 4-6 months | 3-5 months | Corporate demand may not materialize |
| **Total** | **19-29 months** | **14-20 months** | |
