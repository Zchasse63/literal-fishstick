# Unknowns Register -- Meridian PRD v1.0

**Date:** 2026-03-20
**Source:** Synthesis of all 7 scrutiny agent reports

---

## Technical Unknowns (Resolve via Spikes/Prototypes)

| # | Unknown | Why It Matters | How to Resolve | Effort |
|---|---|---|---|---|
| U1 | Glofox Stripe Connect account type (standard vs. managed) | Determines whether member payment methods are portable at migration. If not portable, all members re-enter cards -- expect 20-40% temporary churn. | Call Stripe support. Log into Stripe dashboard and check account type. | 1 hour |
| U2 | Stripe proration behavior with actual price objects | Edge Case 6 formula may not match Stripe's actual calculation (rounding, anchor date handling, mid-cycle timing). | Spike 1: Create sandbox prices, test upgrade/downgrade scenarios. | 3-4 hours |
| U3 | RLS behavior for dual-role users | Can RLS distinguish "same user, admin context" from "same user, member context"? The broadest role may always win. | Spike 2: Test with multi-role JWT custom claims. | 4-6 hours |
| U4 | Geofencing accuracy at studio location | GPS accuracy indoors can be 100m+. At 200m radius, this causes false rejections. | Spike 4: On-site test with actual devices. | 2 hours |
| U5 | QR scanning reliability via iPad browser camera | Web browser camera API on iPad Safari may not reliably scan QR codes at typical arm's-length distance. | Spike 5: Test with qrcode package output on iPad. | 2-3 hours |
| U6 | Wallet offset atomicity across Stripe + Supabase | Wallet debit and Stripe charge must be atomic. If Stripe succeeds but wallet debit fails (or vice versa), money is lost or double-charged. | Spike 3: Prototype the cross-system transaction pattern. | 6-8 hours |
| U7 | Embedding model for pgvector | Anthropic SDK generates text, not embeddings. If pgvector is used for semantic search, a separate embedding model is needed. | Decision + integration test. Not Phase 1. | 2-3 hours (Phase 3) |
| U8 | pg_cron availability on chosen Supabase plan | pg_cron is not available on Supabase free tier. Required for 5+ scheduled jobs. | Check Supabase plan features. Upgrade if needed. | 30 minutes |

---

## Market Unknowns (Resolve via Research)

| # | Unknown | Why It Matters | How to Resolve | Effort |
|---|---|---|---|---|
| U9 | Do other sauna/recovery studios share the same Glofox pain points? | Validates the SaaS thesis. If pain is unique to The Sauna Guys, the SaaS path fails. | Interview 3-5 sauna studio owners outside Tampa. Ask about dual-role accounts, proration, trainer attribution. | 3-5 hours |
| U10 | Will studios pay $200-350/month for Meridian? | Price point determines SaaS viability. Too high = no customers. Too low = unsustainable margins. | Informal pricing conversations with 3-5 target studios. Show screenshots of Meridian dashboard. | 3-5 hours |
| U11 | Is the AI differentiation window still open? | Competitors (Walla, Mariana Tek) may be shipping AI features. If the window closes before Meridian launches, the positioning changes. | Monitor competitor release notes quarterly. Check Walla and Glofox blogs for AI announcements. | 1 hour/quarter |
| U12 | Is corporate event demand real and recurring? | Corporate module is Phase 4 scope. If demand doesn't exist, it's wasted architecture. | Track corporate event inquiries for 60 days. If <2 inquiries, deprioritize further. | Tracking only |
| U13 | ClassPass integration requirements | Studios on ClassPass may not switch to Meridian if they lose ClassPass bookings. Important for SaaS. | Research ClassPass partner API. Determine integration feasibility and timeline. | 4-6 hours |

---

## User Unknowns (Resolve via Conversations)

| # | Unknown | Why It Matters | How to Resolve | Effort |
|---|---|---|---|---|
| U14 | Do trainers agree with $20 bonus at 7+ check-ins? | Trainer satisfaction drives trainer advocacy. Wrong threshold or rate creates resentment. | Discuss with Whitney, Drennen, and Trent before building payroll. | 1 conversation |
| U15 | Will members actually use self-service upgrades? | If members prefer calling/texting the studio, the upgrade UI has no impact. | Survey 5 members who have previously upgraded manually. | 30 minutes |
| U16 | What devices do employees use for clock-in? | Geofencing via Web Geolocation API varies by device. iPhone Safari vs. Android Chrome vs. desktop have different accuracy and permission UX. | Ask staff what devices they use. Test on those specific devices. | 30 minutes |
| U17 | Current walk-in volume | Walk-in kiosk priority depends on how many walk-ins occur. If it is 0-1/week, a kiosk is unnecessary for Phase 1. | Track walk-ins manually for 4 weeks. | Tracking only |
| U18 | Actual active member count (beyond ~11 memberships) | The "~11 active memberships" figure may not include class pack holders, drop-in regulars, or paused members. True active user count affects capacity planning and migration scope. | Pull current member report from Glofox. Count: active subscriptions + active credit packs + drop-in purchases last 30 days. | 1 hour |

---

## Resource Unknowns (Resolve via Planning)

| # | Unknown | Why It Matters | How to Resolve | Effort |
|---|---|---|---|---|
| U19 | Team composition for Phase 1 | Solo developer: 6-10 months. 2-person team: 4-6 months. Determines realistic Phase 1 scope and timeline. | Decide team size. Assess skills against requirements (Next.js App Router, Supabase RLS, Stripe). | Decision |
| U20 | Phase 1 target go-live date | Without a deadline, scope expands indefinitely. A hard date forces prioritization. | Pick a date. Work backwards from it. Cut scope to fit. | Decision |
| U21 | Monthly Glofox cost | Exact cost determines break-even math for the internal build. Estimated $150-300/month but actual invoice amount unknown. | Check Glofox billing. | 5 minutes |
| U22 | Budget for development | If hiring a developer, the budget determines team size and duration. If founder-built, budget is opportunity cost only. | Define budget constraint. | Decision |
