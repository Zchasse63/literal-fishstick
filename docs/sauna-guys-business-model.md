# The Sauna Guys — Business Model & Operations Reference

This document captures exactly how The Sauna Guys operates so that Meridian's architecture is built around reality, not assumptions.

---

## 1. Facility Setup

- **1 sauna** — capacity: 12 people
- **6 cold plunges**
- Showers available between rounds
- Located in Tampa, FL

---

## 2. Booking Model: Group Classes (Primary)

The Sauna Guys operates like a yoga or Pilates studio. Members book **time slots**, not individual equipment.

### Open Sauna / "Free Flow" Sessions

- **Format:** 1-hour time blocks (5–6pm, 6–7pm, 7–8pm, etc.)
- **Capacity:** Up to 12 per slot
- **Experience:** Members use the sauna and cold plunges freely — self-directed
- **Typical flow:** 10–20 min sauna → shower → 2–4 min cold plunge → repeat for 45–60 minutes
- **No instructor** — members manage their own time within the hour
- **Booking:** Member selects a time slot via the Glofox/Meridian portal, just like booking a group fitness class

### Guided Classes (Instructor-Led)

- **Format:** Same hour-long time block, same facility
- **Capacity:** Typically 7–10 people per guided class
- **Experience:** A trainer leads the group through a structured session
- **Example:** Whitney Cooper, Wednesdays 7–8pm
  - Guided breathwork in the sauna
  - Different "flavor" for each 15-minute sauna block (e.g., talk about your day, focused breathing, relaxed/unstructured)
  - Same sauna → cold plunge → repeat rotation, but guided
- **Booking:** Same flow as Open Sauna — member selects the time slot, but the class listing shows the trainer name and class type

### Individual Resource Booking (Future / Secondary)

- **Not the current model** — The Sauna Guys doesn't do private sauna room reservations today
- **Should exist in Meridian's backend** as a feature for future facilities that operate on a private-booking model (like sweat houses or private sauna suites)
- Architecture should support both group-class and individual-resource booking, with group-class as the default

---

## 3. Trainer / Instructor System

### Assignment
- Each class (Open Sauna or Guided) can optionally have a trainer assigned
- Open Sauna sessions may or may not have a trainer
- Guided sessions always have a trainer

### Compensation
- **Base pay per class** — flat rate for leading a session
- **Performance bonus threshold** — if class attendance exceeds a threshold (e.g., 7+ members), trainer earns a bonus on top of base pay
- **Configurable per class type** — different thresholds and bonus amounts for different class types

### Referral / Promo Codes
- Each trainer gets a **unique promo code**
- When a new member signs up for a membership or class pack using a trainer's code, the trainer gets credit
- Dashboard should track: which code was used, by whom, what was purchased, trainer attribution report

### Trainer Profiles (Public-Facing)
- Bio, photo, specialties
- Upcoming class schedule
- Visible on the iOS app and website
- Members can browse trainers and see their class schedules

---

## 4. Account & Role Architecture

### The Problem with Glofox
Glofox requires separate accounts for admin and member roles. Owners who are also members (who book and attend classes) cannot use the same email for both. Trainers have the same problem.

### What Meridian Needs
- **Single account, multiple roles:** One email address can be an admin AND a member, or a trainer AND a member
- **Role-based permissions:** Admin sees the dashboard, member role sees booking/profile, trainer role sees their classes/pay
- **Seamless switching:** An owner logged in as admin can also view their own booking history, credits, and membership without switching accounts

### Profile Exclusion from Analytics
- **Flag profiles as "exclude from calculations"**
- Use case: Former owners were given complimentary memberships. They attend but don't pay. This skews revenue-per-member, attendance-to-revenue ratios, and churn metrics.
- The flag should exclude the profile from: revenue calculations, ARPM, churn rate, attendance-to-revenue correlations
- The flag should NOT exclude from: headcount (they still occupy a slot), capacity calculations, check-in logs
- This should be a toggle in the member profile settings, not a deletion

---

## 5. Revenue Streams

| Stream | Description | Where It's Sold |
|---|---|---|
| **Memberships** | Recurring (unlimited, class packs — 6-class, 10-class, etc.) | iOS app, website, in-studio |
| **Drop-in / Day Passes** | One-time single-session purchase | iOS app, website, walk-in |
| **Credit Packs** | Prepaid bundles, non-recurring | iOS app, website |
| **Private Sessions/Events** | Private buyouts, corporate events, parties | Request via app/website → studio confirms |
| **Merchandise** | Apparel, accessories, branded items | iOS app, website, in-studio |
| **Gift Cards** | Redeemable for memberships, classes, or merch | iOS app, website |

### Member Discounts
- Recurring members automatically receive **10–15% discount** on merch and gift cards
- Applied at the database level when membership status = active + recurring
- Discount should activate/deactivate automatically with membership status

### Self-Service Membership Upgrades
- Members MUST be able to upgrade their own membership tier without contacting the studio
- Example: 6-class recurring → 10-class recurring → unlimited
- One-tap upgrade with automatic proration
- Glofox explicitly blocks this — it's a major pain point

### Merchandise / Inventory
- Dashboard needs an inventory management system for merch
- Track: SKUs, stock levels, pricing, member discount pricing
- Merch is purchasable through the iOS app, website, and in-studio
- Inventory syncs across all channels

---

## 6. Payments & Authentication

### Payment Methods
- **Stripe** — primary payment processor (direct integration, not Connect wrapper)
- **Apple Pay** — required for iOS app and website
- **Google Pay** — include for Android/web coverage
- All payment methods available across: iOS app, website, in-studio POS

### Authentication
- **SSO / Magic Link** — passwordless login for members (email-based magic link)
- Members should never need to remember a password
- Admin/trainer accounts may use email + password or SSO

---

## 7. Member-Facing Features (iOS App + Website)

These consume the same Meridian backend/database:

### Core
- Book classes (view schedule, select time slot, confirm)
- View upcoming and past bookings
- Manage membership (view plan, upgrade, pause, cancel)
- View and manage credit balance
- Purchase day passes, credit packs
- Update profile and payment methods

### Commerce
- Browse and buy merchandise
- Buy gift cards
- View and request private events (request form → studio reviews and confirms)
- Member discount automatically applied at checkout

### Social / Community
- **Community board** — members-only feed
  - Trainers can post about special classes, tips, events
  - Studio can post announcements, events, promotions
  - Members can interact (like, comment, share)
- **Instagram feed integration** — embedded in the app and website, pulls from the studio's Instagram
- Only visible to signed-in members (or configurable: public vs. members-only)

### Wellness / Gamification
- Session history with visit calendar
- Streak tracking ("8 weeks of 2+ visits")
- Personal records ("Longest cold plunge: 4 minutes")
- Monthly visit summaries

### Trainer Discovery
- Browse trainer profiles (bio, photo, specialties)
- View trainer's upcoming class schedule
- Book directly from a trainer's profile

---

## 8. Dashboard Implications

Everything above flows through Meridian's admin dashboard:

| Feature Area | Dashboard Module |
|---|---|
| Class scheduling + trainer assignment | Schedule |
| Trainer pay, bonuses, promo code tracking | Operations > Staff |
| Membership management + self-service upgrades | Revenue > Memberships & Pricing |
| Merch inventory + sales | Revenue > Commerce (new sub-page) |
| Private event requests | Corporate > Events |
| Member discounts configuration | Revenue > Memberships & Pricing > Discount Rules |
| Community board moderation | Marketing > Content |
| Analytics exclusion flags | Members > Profile Settings |
| Gift card management | Revenue > Gift Cards (new sub-page) |
| Trainer promo code reporting | Analytics > Trainer Performance |

---

## 9. Architecture Corrections from This Context

The original Meridian architecture assumed an **individual resource booking** model (reserve Barrel Sauna #1 for 45 minutes). The actual model is **group class booking** (reserve a spot in the 5pm time slot, capacity 12).

### What changes:
- **Command Center facility map:** Instead of showing "Barrel Sauna 1 — Occupied by Alex P., 23:41 remaining," it should show "5:00 PM Open Sauna — 9/12 booked" and "7:00 PM Guided: Whitney C. — 8/10 booked"
- **Schedule calendar:** Instead of resource swimlanes (one row per sauna), it should show time-slot blocks with capacity bars — more like a class schedule than a resource calendar
- **Walk-in mode:** Instead of "which resource do you want?", it's "which time slot do you want to join?"
- **Booking flow:** Member picks a time slot (not a specific sauna or plunge) → confirms → checked in at arrival

### What stays the same:
- All the AI, analytics, revenue, marketing, and member management architecture is unchanged
- The resource swimlane view should still exist as an option for businesses using the individual-booking model
- The Meridian platform should support BOTH models — group class is the default for The Sauna Guys
