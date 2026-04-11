# The Sauna Guys — SMS Opt-In Disclosure

**Document type:** SMS marketing consent and opt-in disclosure (TCPA compliance)
**Entity:** The Sauna Guys, LLC
**Contact:** info@thesaunaguys.com
**Privacy policy:** thesaunaguys.com/privacy
**Source provided:** 2026-04-10 by user (Zach)
**Canonical copy:** This file. When the SMS opt-in form ships (member sign-up, profile settings, etc), this text is the exact disclosure that must be shown to the member before they enter their phone number.

---

## Full disclosure text

> By providing your phone number and opting in, you consent to receive recurring automated marketing and informational text messages from The Sauna Guys, LLC, including promotions, booking reminders, membership updates, and event notifications. Message frequency varies. Message and data rates may apply. Consent is not a condition of purchase or membership.
>
> To opt out, reply STOP at any time. For help, reply HELP or contact us at info@thesaunaguys.com.
>
> Carriers are not liable for delayed or undelivered messages. View our full Privacy Policy at thesaunaguys.com/privacy.
>
> By opting in, you confirm you are at least 18 years old and agree to these terms.

---

## Legal requirements checklist

This text satisfies TCPA (Telephone Consumer Protection Act) and CTIA (Cellular Telecommunications Industry Association) best practices:

- ✅ Identifies the business name (The Sauna Guys, LLC)
- ✅ States the types of messages sent (marketing, reminders, updates, events)
- ✅ Discloses "recurring" and "automated" nature
- ✅ Discloses "Message and data rates may apply"
- ✅ Clarifies "consent is not a condition of purchase"
- ✅ Provides STOP opt-out instructions
- ✅ Provides HELP command
- ✅ Provides non-SMS contact (email)
- ✅ Links to Privacy Policy
- ✅ Age gate (18+)
- ✅ Carrier liability disclaimer

---

## Where this text must appear

1. **Member sign-up form** — before the phone number input field; "Opt in to SMS" checkbox must be unchecked by default
2. **Member profile settings** — if SMS is not currently enabled, the opt-in toggle shows this text as a hover/expand
3. **Booking confirmation page** — if the member opts in during the booking flow
4. **Landing page footer** — linked from "SMS Terms" link in site footer

## Required DB fields (for member SMS consent tracking)

- `profiles.sms_opt_in_at` — timestamp of opt-in
- `profiles.sms_opt_in_ip` — IP at time of opt-in (legal defense)
- `profiles.sms_opt_in_version` — which disclosure version was shown
- `profiles.sms_opt_out_at` — timestamp of opt-out (if opted out)
- `email_preferences.sms_marketing` — boolean current state
- `email_preferences.sms_reminders` — boolean current state
- `email_preferences.sms_events` — boolean current state

The `email_preferences` table (exists in schema) needs SMS fields added if they aren't there yet — verify during Tier 5 (Marketing) or Tier 7 (Settings) runs.

## STOP/HELP handler

When implemented, the SMS provider webhook must:

1. **STOP** — immediately set `sms_marketing=false`, `sms_reminders=false`, `sms_events=false` + `sms_opt_out_at=now()`. Return a confirmation SMS: *"You have been unsubscribed from The Sauna Guys SMS. Reply START to resubscribe."*
2. **HELP** — return: *"The Sauna Guys: For help, contact info@thesaunaguys.com. Reply STOP to unsubscribe."*
3. **START** (re-opt-in) — requires a new explicit opt-in flow, NOT just STOP reversal

## SMS provider (per CLAUDE.md)

> **SMS:** Stub out for now, provider TBD. Campaign infra must be provider-agnostic.

When the provider is chosen (Twilio, Bandwidth, MessageBird, etc.), the opt-in text above should be shown verbatim in the UI and stored server-side as the canonical consent. The provider integration must call the STOP/HELP webhook handlers.
