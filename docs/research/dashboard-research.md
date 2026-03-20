# Where fitness booking platforms fail — and what it means for The Sauna Guys

**Every major studio management platform in the fitness industry was built for class-based businesses, and the sauna/recovery niche is paying the price.** Across 15+ platforms evaluated — Mindbody, Glofox, ClassPass, Vagaro, WellnessLiving, Wodify, TeamUp, Gymdesk, Zen Planner, Mariana Tek, Pike13, Momoyoga, bsport, and others — recurring patterns of contract lock-in, degraded support, unreliable software, and fundamental feature mismatches emerge from thousands of owner reviews, app store ratings, Reddit discussions, and investigative reporting. The most telling signal: SweatHouz, the dominant sauna franchise, built an entirely proprietary technology stack rather than use any off-the-shelf solution. No existing platform adequately handles equipment-specific booking (e.g., reserving Barrel Sauna #3), credit-pack-first business models, corporate wellness portals, pop-up event management, and multi-location scaling simultaneously. For The Sauna Guys, this research strongly supports exploring a custom platform — particularly one built atop Stripe for payments — while potentially using HelmBot or WellnessLiving as a bridge solution.

---

## Priority 1: The pain gym and studio owners won't stop talking about

Owner complaints cluster around six major themes, documented across G2 (4,000+ reviews), Capterra (7,000+ reviews), Trustpilot, BBB complaints, and Reddit threads in r/crossfit, r/yoga, r/personaltraining, and r/smallbusiness.

### Contract lock-in and data hostage situations

**Mindbody is the worst offender.** Standard contracts run **12–24 months**, and early termination requires paying all remaining fees. The BBB logged **97 complaints in three years**, with 50 classified as billing disputes. One owner wrote on Capterra: *"They locked me into a contract I was never aware of. STAY AWAY!"* Another on BBB: *"Closed business, told we have another year on a 'contract.' I don't recall signing a contract."* Reddit threads in r/mindbody document owners receiving written cancellation approval only to be told the cancellation wouldn't take effect for months.

**Glofox** advertises "no contracts" but charges quarterly, and cancellation friction is severe. One owner reported being *"charged $1,500 despite not being fully onboarded due to ongoing software issues."* Another was charged $1,300 on a credit card after cancellation. **bsport** may be the most aggressive — one studio owner reported: *"Bsport is currently coercing us to sign a new contract about payment liability by having blocked all of our payouts (Stripe payouts go via them first) unless we sign the contract."* Zen Planner charges exit fees: *"They try to get every penny they can out of their longtime customers who are fleeing the platform."*

Data portability is equally problematic. Mindbody makes export deliberately difficult — as Gymdesk's analysis notes: *"Once you're in, it's harder to switch. That's the goal; MindBody aims to be so embedded in your business that you can't leave."* Both Mindbody and Momence have been described on Reddit as *"cagey about who owns client data, with indications in the contract that the provider claims rights to your customer list."*

### Customer support that deteriorates after you sign

A consistent pattern emerges across every platform: excellent support during sales, rapid degradation after onboarding. **Mindbody** support was rated only **3.8/5 on Capterra** despite the platform's dominance. One 6-year customer wrote on Trustpilot: *"The support has been offshored and I know more about the app than they do."* Angela, owner of Yoga Sport, described waiting 45 minutes on every call: *"They never cared. They never followed up."*

**Glofox** follows the same trajectory. A 2+ year customer wrote: *"The customer support team were great when I first signed up... Now it takes weeks to resolve issues, the support team sound fatigued and are often defensive."* **Mariana Tek** offers no phone support and no weekend coverage: *"Something that would take a five-minute phone call to fix takes days or even weeks to solve."* **bsport** and **WellnessLiving** are both replacing human support with AI chatbots, drawing immediate backlash — *"I'm not a fan of the new AI-generated support replies, which often miss the point."*

The platforms with consistently praised support are **TeamUp**, **Wodify** (described as a "partnership"), and **Gymdesk** (pre-private-equity acquisition). Gymdesk's recent PE acquisition has already triggered complaints about declining support quality.

### Software reliability is shockingly poor

**Zen Planner** may have the worst track record: *"ZP goes down most days for 1-2 hours. 5-6 days per week. Just no software to run the gym."* **Glofox** is plagued by persistent bugs — Capterra's aggregate analysis found that *"most reviewers report bugs and issues, mentioning recurring glitches, slow performance, and delayed problem resolution."* One Glofox user described the impact bluntly: *"This system is actively turning away potential clients of mine during what should be my busiest time of year."*

**Pike13** suffers *"periodic 500 errors that completely take our business down... we've had to turn away customers who were about to sign up."* **Wodify** schedules maintenance during US business hours, causing Saturday morning booking outages. **Mindbody** bugs persist after updates — *"Most major releases clients complain they can't book classes."* Only **TeamUp** consistently avoids reliability complaints.

### Reporting, APIs, and customization constraints

Nearly every platform is criticized for inadequate reporting. **Glofox** report filters are *"NOT ORGANISED, meaning I have to scroll through 340 classes to find 1 class."* **Pike13** makes it *"impossible to get financial info (credit card fee report)."* **Mariana Tek** has *"some holes in reporting that require us to do more work than I would like to get KPIs."* **Momoyoga** reports are described as *"limited and lack detail."*

API access is gatekept behind premium tiers on most platforms. Mindbody offers free API access under 5,000 calls per billing cycle but charges $0.002 per call beyond that. Glofox has a developer portal but locks deeper access behind higher plans. **Gymdesk, TeamUp, and Mariana Tek** offer the most developer-friendly API access. As Two-Brain Business noted about Wodify: *"Instead of trying to guess what gym owners need, Wodify could allow easier access to the raw data and let owners build their own dashboards."*

### Multi-location management breaks down

For a business expanding to multiple locations, this is critical. **Glofox** users report major functionality loss: *"If you have multiple locations you will lose a lot of functionality (I wasn't told about that)."* The branded app bugs across locations, and members must sign in and out between studios. **Mindbody** charges per-location fees (each plan price × number of locations), creating significant cost scaling. One Absolute Pilates owner found it *"difficult to integrate multiple locations together"* — she had to run separate accounts. **TeamUp** stands out by including **unlimited locations in one subscription**. **Mariana Tek** handles multi-location well for boutique fitness (used by Barry's and Barre3). **HelmBot** offers centralized multi-location management with shared customer data.

### Payment processing friction and forced processors

**Mindbody** forces its proprietary processor at **~3.5% per transaction** and holds funds for **14 days** before bank transfer. **Vagaro** requires its proprietary merchant — no third-party processors allowed. **WellnessLiving** uses Paragon Payment Solutions with undisclosed rates. By contrast, **Glofox, TeamUp, Gymdesk, and Momoyoga** integrate directly with **Stripe** at standard rates (~2.9% + $0.30). This distinction matters enormously at scale — the difference between 3.5% and 2.9% on $50,000/month in transactions is **$3,600/year**.

---

## Priority 2: Why members hate these booking apps

End-user complaints are remarkably consistent across all platforms, drawn from iOS/Android app store reviews, Trustpilot (9,259 ClassPass reviews alone), and Sitejabber.

### Authentication is broken everywhere

Every app struggles with login. **Mindbody** is the worst — its July 2025 "Universal Account" migration caused widespread login sync issues. One Sitejabber user wrote: *"Every time I go to sign up for a yoga class, it doesn't recognize my login and password and I have to start all over again."* Another: *"Every time I have logged on, I have to change my password. I now deliberately avoid using services that require you to book on this platform."* **Glofox** members at multi-studio businesses must sign in and out between studios. **WellnessLiving's Achieve app** crashes before opening for some users. App store ratings tell the story: Mindbody's consumer app has a **1.2/5 on Sitejabber** from 79 reviews. ClassPass sits at **2.1/5 on Trustpilot** from 9,259 reviews.

### The booking flow is too complex

A Mindbody user captured the universal frustration: *"I literally need to factor in an additional 15 minutes before class just to sign in... There is ultimately just way, way, way too much clicking, searching, scrolling, entering the same info over and over just to book a yoga class. I will never go to a yoga studio that forces attendees to use this app."* **Mindbody** promotes competitor studios to members while they're trying to book — *"The app promotes a dozen other studios that are geographically closer to me, so it's kinda stealing business."* **Vagaro** requires members to create a Vagaro account (becoming Vagaro's customer and receiving competitor marketing). **WellnessLiving** makes it impossible to add a new studio from within the app — one user wrote: *"This app fails at the very basic functionality of a booking app."*

### Credit and package management confuses everyone

**ClassPass** is now facing a **class-action lawsuit** (Northern District of California) over credit expiration. Its dynamic pricing model penalizes frequent attendance — one user reported a Sunday class doubling from 7 to 14 credits overnight. Credits are immediately forfeited upon membership cancellation. **Glofox** members report credits disappearing after payment, and some accidentally purchased multiple membership packs because the UI was unclear. **Mindbody** passes frequently don't display correctly across locations. No platform makes it simple for members to see what they've purchased, what they have remaining, and when it expires.

### Family booking is universally terrible

None of the five major consumer apps handle family bookings well. **Mindbody** requires separate credit card storage per child. **Glofox** requires individual accounts and separate logins for each family member. **WellnessLiving's** family account creation is so complex that *"we spend a lot of time fixing accounts, linking family members."* This is particularly relevant for sauna/recovery businesses where couples and families book together.

### What members actually want

The gap between current apps and member expectations is wide. Members want: one-tap rebooking of regular sessions, real Google/Apple Calendar integration (currently broken on most platforms), a single unified login across all studios, transparent and stable pricing, family booking from one parent account, and responsive human customer support. Currently, **no platform delivers all of these**.

---

## Priority 3: The sauna and recovery studio feature gap

This is where the case for a custom platform becomes strongest. The sauna/cold plunge/recovery model differs fundamentally from class-based fitness, and no mainstream platform was built for it.

### Equipment-specific booking barely exists

The Sauna Guys' core need — booking a **specific sauna barrel or cold plunge tub** — is poorly supported. **Glofox** offers "Facility Rental" booking tied to named rooms, but you cannot book "Barrel Sauna #3" specifically — only "Sauna Session (Room A)" at a time slot. Only two mainstream platforms offer anything close: **Mindbody's "Pick-a-Spot"** and **WellnessLiving's "Book-a-Spot"** let clients select specific numbered spots or equipment. **Mariana Tek** also offers spot selection but is designed for cycling/HIIT studio seating, not recovery equipment. Among niche platforms, **HelmBot** (built by float tank operators) handles room-specific booking natively, and **Twice** was built specifically for sauna operations with private-vs-public session management.

### Credit pack models work, but with limits

Glofox supports Service Credit Packs with category restrictions (Class, Facility, Trainer), and credits auto-deduct before charging. This works for basic credit-pack models. **However**, packs are limited to one category, which creates friction for The Sauna Guys' model where credits should be redeemable across sauna, cold plunge, contrast sessions, and add-ons like compression boots. **WellnessLiving** and **Mindbody** offer more flexible package systems. **TeamUp** and **Gymdesk** include all pricing model features at every tier. No platform elegantly handles a credit system where 1 credit = 1 sauna session OR 1 cold plunge OR 1 contrast session, with different credit costs for premium add-ons.

### Corporate wellness and pop-up events are unsupported

**No mainstream platform** offers a dedicated corporate wellness portal with features like corporate invoicing, admin-managed group bookings, per-employee usage reporting, corporate pricing tiers, and event coordination. This is universally handled through manual workarounds and enterprise agreements. For pop-up events (a core part of The Sauna Guys' model), no platform handles temporary or mobile locations well. Glofox's "Courses" feature can be used for workshops but lacks event ticketing, pop-up location support, or an events promotion engine. **Mindbody** has a dedicated Events feature but it's expensive and complex. **WellnessLiving** supports free or paid events but with limited pop-up location management.

### The walk-in plus reservation hybrid

The sauna model needs both reserved sessions and walk-in capacity within the same time slots, with real-time availability visible. Most platforms are either appointment-first (Vagaro) or class-first (Wodify, TeamUp). Only **Mindbody's split capacity feature** — which separates online bookable spots from total capacity, reserving some for walk-ins — adequately handles this. Session turnover and cleaning management between sauna sessions is handled only by **Twice** and **HelmBot** with automated turnaround scheduling. Mainstream fitness platforms treat turnaround time as a manual buffer.

### Niche platforms worth evaluating

Several platforms designed for wellness/recovery businesses deserve consideration:

- **HelmBot** (~$150–350/month): Built by float center owners, supports room-specific booking, cross-service scheduling ("massage, then float, then cryo? No problem"), memberships, waivers, multi-location with shared customer data, and even water chemistry tracking. The closest off-the-shelf fit for The Sauna Guys' model.
- **Wunderbook** ($0/month, 2% user booking fee): Mobile-first sauna booking platform optimized for Instagram-driven businesses. Zero monthly cost but may lack depth for corporate accounts.
- **Twice**: Sauna-specific with private/public session management, dynamic pricing, cleaning/maintenance scheduling, and hygiene check logging.
- **Fresha** ($0/month, per-transaction fees): Free booking platform with a "spa and sauna" vertical supporting individual sessions, memberships, and group bookings.
- **Zenoti**: Enterprise-level spa software (10,000+ businesses) but overkill and expensive for a growing Tampa operation.

### The SweatHouz signal

The most important competitive intelligence: **SweatHouz built a fully proprietary technology stack** including a custom booking app with session tracking, suite-level booking (specific private rooms with infrared sauna + cold plunge + Vitamin C shower), membership management, IoT integration with Hyperice recovery devices, and smart monitoring. This investment signals that **the highest-growth sauna brands conclude that no off-the-shelf platform is sufficient at scale**.

---

## Priority 4: Pricing structures that bleed operators

### Platform-by-platform cost breakdown

| Platform | Base Price | Payment Processing | Contract | All Features Included? |
|---|---|---|---|---|
| **Mindbody** | $129–699/mo per location | 3.5% + 20% marketplace fee | 12–24 months | No — heavily tiered |
| **Glofox** | $80–320+/mo | Stripe standard (~2.9%) | Quarterly billing | No — tiered with add-ons |
| **Vagaro** | $24–84/mo (per calendar) | 2.2–3.5% (proprietary only) | Month-to-month | No — many add-ons |
| **WellnessLiving** | $69–349/mo | Paragon (undisclosed rates) | Month-to-month | No — branded app at $349 tier |
| **Wodify** | $79–299/mo | Proprietary (undisclosed) | No contract | No — major add-ons |
| **TeamUp** | $104–309/mo (by customer count) | Stripe/GoCardless standard | Month-to-month | **Yes** |
| **Gymdesk** | $75–200/mo (by member count) | Stripe/Square/Auth.net standard | No contract | **Yes** |
| **Zen Planner** | $99–289+/mo | Integrated (undisclosed) | Annual discounts | No — add-ons |
| **Mariana Tek** | $179–285+/mo (custom) | Integrated (undisclosed) | Custom | No — expensive add-ons |
| **Pike13** | $118–279/mo | Built-in (undisclosed) | Monthly | No — tiered |
| **Momoyoga** | $0–179/mo | Stripe (+5% on free tier) | No contract | Yes per tier |
| **bsport** | ~€150+/mo | Integrated (undisclosed) | Annual, 2-month notice | No — tiered |

### Mindbody's hidden fee structure is the industry's worst

Beyond the $129–699/month base, Mindbody layers on: a **20% marketplace commission** on new clients discovered via the Mindbody app (capped at $30), a **20% fee on Promoted Intro Offers**, a **20% affiliate network fee**, and **3.5% payment processing** on all transactions. A concrete example: a $200 membership sold through Mindbody's marketing tools nets the studio only **$153 after a $47 cut**. The branded app costs $200–599/month extra and is only included at the highest tier. API access is free under 5,000 calls but $0.002/call beyond that. For a multi-location business, costs multiply — each plan price applies per location.

### ClassPass economics devastate small studios

ClassPass takes approximately **20–30% of class value**, but effective studio payouts often tell a worse story. VICE's investigation found studios receiving as little as **$8 per class** for sessions normally priced at $25–45. One trainer earned $15.75 per booking for sessions priced at $35–60. An East London studio averages **£3–5 per ClassPass visit**. The "First Class Free" mandate (now required for all partners) compounds the damage — one studio delivered **350 free sessions to ClassPass users in a single quarter**. ClassPass counters that average Mindbody businesses see ~28% incremental revenue, but their own CEO acknowledged: *"Stronger businesses do better on ClassPass, and weaker businesses do worse."* Studios describe a prisoner's dilemma: *"We can't afford not to use it because every other studio nearby does."*

### The platforms with the most transparent pricing

**TeamUp** and **Gymdesk** stand apart by including all features at every tier, using direct Stripe/GoCardless integration at standard rates, requiring no contracts, and scaling based on active customer/member count rather than feature access. TeamUp includes **unlimited locations** in a single subscription — a significant advantage for multi-location businesses. Gymdesk starts at $75/month for up to 50 members with every feature included and direct Stripe integration.

### The payment processing markup matters at scale

Platforms forcing proprietary processors (Mindbody at ~3.5%, Vagaro at 2.2–3.5%, WellnessLiving via Paragon, Wodify via Wodify Payments) consistently charge more than direct Stripe integration (~2.9% + $0.30). On **$50,000/month** in transactions, the spread between 3.5% and 2.9% costs **$3,600/year**. On $100,000/month, it's $7,200/year. Platforms with direct Stripe integration — Glofox, TeamUp, Gymdesk, Momoyoga — provide both lower rates and faster fund access (Stripe pays out in 2 days vs. Mindbody's 14-day hold).

---

## What a custom platform for sauna/recovery must solve

The research reveals ten specific capability gaps that no current platform fills well, representing the functional requirements for a purpose-built system:

1. **Suite-level booking engine**: Reserve "Barrel Sauna #3" + "Cold Plunge Tub B" as a combined experience with automatic turnover/cleaning scheduling between sessions
2. **Flexible cross-category credit system**: Credits redeemable across sauna, cold plunge, contrast, compression boots, and red light — with different credit costs per service and multi-visit discount logic
3. **Corporate wellness dashboard**: Company admin portal for managing employee access, group bookings, corporate invoicing, and per-employee usage analytics
4. **Pop-up and mobile event module**: Temporary location creation with its own schedule, capacity, pricing, and separate marketing — essential for The Sauna Guys' event model
5. **Real-time capacity display**: Public-facing availability showing which specific suites/equipment are open, supporting both reservations and walk-ins simultaneously
6. **Direct Stripe integration**: Transparent processing at standard rates with 2-day payouts, no proprietary processor markup, and full control over dunning and failed payment recovery
7. **Session tracking and engagement**: Log sauna duration, cold plunge time, temperature preferences — creating a member wellness journey (as SweatHouz does)
8. **Dynamic pricing engine**: Peak/off-peak pricing, corporate rates, multi-visit discounts, and promotional pricing without the marketplace commission structure
9. **Integrated waiver and health screening**: Digital waivers with contraindication screening (heart conditions, pregnancy) required before first booking
10. **Group and party booking**: Private suite buyouts for corporate events, birthday parties, and bachelor/ette parties with custom package creation

### The bridge solution while building

If The Sauna Guys need an immediate off-the-shelf improvement over Glofox, **HelmBot** is the strongest candidate — purpose-built by float center owners for exactly this business model, with room-specific booking, cross-service scheduling, memberships, waivers, and multi-location support at ~$150–350/month. **WellnessLiving** offers the best mainstream alternative with its Book-a-Spot feature, event management, rewards program, and branded app (though the branded app requires the $349/month tier). **Mindbody** has the deepest feature set but its cost structure, contract requirements, competitor promotion in the marketplace, and support quality make it a poor fit for a growing independent business.

## The market is failing — and that's the opportunity

The fitness booking platform market is dominated by software built for yoga studios and CrossFit boxes, now awkwardly stretched to serve a booming recovery and wellness sector with fundamentally different operational needs. The universal complaints — contract lock-in, declining support, unreliable software, opaque pricing, poor APIs, and broken member experiences — reflect platforms optimized for vendor retention rather than operator success. The **4,000+ negative reviews** across Capterra, G2, and Trustpilot aren't anomalies; they're structural symptoms of a market where the dominant player (Mindbody, valued at billions through its EGYM merger) makes more money from marketplace commissions and locked contracts than from making studios successful. For The Sauna Guys, the strategic question isn't whether the current tools are adequate — they clearly aren't — but whether to build the platform that the entire recovery/wellness vertical is waiting for, or simply solve for your own operations. Given that SweatHouz chose to build, that HelmBot was born from float center frustration, and that a cottage industry of niche alternatives is emerging precisely because incumbents fail this market, the evidence strongly favors building — not just a better booking tool, but the operating system for the modern recovery studio.