/**
 * Pre-built Automation Flow Templates
 *
 * Each template maps to a trigger type and provides a complete, ready-to-use
 * flow definition. Studios can install a template to create a new automation
 * flow pre-populated with sensible steps, exit conditions, and configuration.
 *
 * Template step types match the FlowStep union in execute-flow.ts:
 *   email | wait | condition | sms | tag | update_field
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AutomationTemplateStep {
  type: 'email' | 'wait' | 'condition' | 'sms' | 'tag' | 'update_field';
  /** Email step fields */
  subject?: string;
  body?: string;
  preheader?: string;
  /** Wait step fields */
  delay_minutes?: number;
  /** Condition step fields */
  condition_type?: string;
  config?: Record<string, unknown>;
  true_branch?: number;
  false_branch?: number;
  /** Tag step fields */
  tag_name?: string;
  action?: 'add' | 'remove';
  /** Update field step fields */
  field?: string;
  value?: string | number | boolean;
}

export interface AutomationTemplate {
  /** Unique slug for the template (kebab-case) */
  slug: string;
  /** Display name */
  name: string;
  /** Short description of what the flow does */
  description: string;
  /** The trigger type this template is designed for */
  trigger_type: string;
  /** Default trigger configuration */
  trigger_config: Record<string, unknown>;
  /** The flow steps array (matches automation_flows.steps JSONB) */
  steps: AutomationTemplateStep[];
  /** Exit conditions (matches automation_flows.exit_conditions JSONB) */
  exit_conditions: Record<string, unknown>;
  /** Whether members can re-enter after completing */
  allow_reenrollment: boolean;
  /** Days before a completed member can re-enter (if allow_reenrollment is true) */
  reenrollment_cooldown_days: number;
  /** Template category for UI grouping */
  category: 'onboarding' | 'retention' | 'upsell' | 'engagement' | 'winback' | 'conversion';
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  // ── 1. Welcome: Never Booked Nudge ────────────────────────────────────
  {
    slug: 'welcome-never-booked-nudge',
    name: 'Welcome: Never Booked Nudge',
    description:
      'Sends a welcome email to new members who haven\'t booked their first class within 48 hours, followed by a second nudge if they still haven\'t booked after 3 more days.',
    trigger_type: 'never_booked',
    trigger_config: { hours_since_join: 48 },
    steps: [
      {
        type: 'email',
        subject: 'Ready to book your first class?',
        body: 'Hi {{first_name}},\n\nWelcome to {{studio_name}}! We noticed you haven\'t booked your first class yet.\n\nYour first session is the hardest part — after that, you\'ll be hooked. Check out our schedule and grab a spot that works for you.\n\n{{booking_link}}\n\nSee you soon!',
        preheader: 'Your first class is waiting for you',
      },
      {
        type: 'wait',
        delay_minutes: 72 * 60, // 72 hours
      },
      {
        type: 'condition',
        condition_type: 'days_since_last_visit',
        config: { operator: 'eq', value: 0 },
        true_branch: 5, // skip to tag (they booked/visited)
        false_branch: 3, // continue to second email
      },
      {
        type: 'email',
        subject: 'Your first class is waiting!',
        body: 'Hi {{first_name}},\n\nWe get it — starting something new can feel like a big step. But everyone here was once a first-timer too.\n\nHere\'s what to expect at your first visit:\n- Arrive 5 minutes early\n- Bring a towel and water bottle\n- We provide everything else\n\nBook your first class now: {{booking_link}}\n\nQuestions? Just reply to this email.',
        preheader: 'Here\'s what to expect at your first visit',
      },
      {
        type: 'wait',
        delay_minutes: 48 * 60, // 48 hours
      },
      {
        type: 'tag',
        tag_name: 'onboarding_completed',
        action: 'add',
      },
    ],
    exit_conditions: {
      on_booking: true,
      conditions: [{ type: 'booking_made' }],
    },
    allow_reenrollment: false,
    reenrollment_cooldown_days: 365,
    category: 'onboarding',
  },

  // ── 2. ClassPass Conversion Offer ─────────────────────────────────────
  {
    slug: 'classpass-conversion-offer',
    name: 'ClassPass Conversion Offer',
    description:
      'Targets ClassPass members who have visited at least twice, offering them a direct membership at a better rate than ClassPass credits.',
    trigger_type: 'classpass_repeat',
    trigger_config: { min_visits: 2 },
    steps: [
      {
        type: 'tag',
        tag_name: 'classpass_repeat_visitor',
        action: 'add',
      },
      {
        type: 'email',
        subject: 'You clearly love it here — let\'s make it official',
        body: 'Hi {{first_name}},\n\nYou\'ve visited us {{total_visits}} times through ClassPass, and we love seeing you come back.\n\nHere\'s the thing: a direct membership gives you more flexibility, priority booking, and saves you money compared to using ClassPass credits.\n\nAs a thank-you for being a repeat visitor, we\'d love to offer you a special rate. Reply to this email or stop by the front desk to learn more.\n\n{{membership_link}}',
        preheader: 'Save money with a direct membership',
      },
      {
        type: 'wait',
        delay_minutes: 5 * 24 * 60, // 5 days
      },
      {
        type: 'condition',
        condition_type: 'membership_type',
        config: { has_direct_membership: true },
        true_branch: 5, // they converted — tag and exit
        false_branch: 4, // send follow-up
      },
      {
        type: 'email',
        subject: 'Last chance: Your exclusive membership offer',
        body: 'Hi {{first_name}},\n\nJust checking in — did you get a chance to look at our membership options?\n\nMembers get:\n- Priority booking (no more sold-out classes)\n- Automatic 10% discount on merch\n- Access to member-only events\n\nLet us know if you have any questions: {{studio_email}}\n\n{{membership_link}}',
        preheader: 'Priority booking, discounts, and more',
      },
      {
        type: 'tag',
        tag_name: 'classpass_conversion_attempted',
        action: 'add',
      },
    ],
    exit_conditions: {
      conditions: [{ type: 'membership_active' }],
    },
    allow_reenrollment: false,
    reenrollment_cooldown_days: 90,
    category: 'conversion',
  },

  // ── 3. Win-Back: One and Done ─────────────────────────────────────────
  {
    slug: 'winback-one-and-done',
    name: 'Win-Back: One and Done',
    description:
      'Re-engages members who visited once and haven\'t returned within 7 days. Two-touch email sequence with an incentive to come back.',
    trigger_type: 'one_and_done',
    trigger_config: { days_since_visit: 7 },
    steps: [
      {
        type: 'email',
        subject: 'We missed you — how was your first visit?',
        body: 'Hi {{first_name}},\n\nWe noticed you visited us about a week ago — we hope you loved it!\n\nMost people say the second visit is even better than the first. Your body knows what to expect, and you can really settle into the experience.\n\nReady for round two?\n\n{{booking_link}}\n\nIf something wasn\'t right about your visit, we\'d love to hear about it. Just reply to this email.',
        preheader: 'Your second visit is even better',
      },
      {
        type: 'wait',
        delay_minutes: 5 * 24 * 60, // 5 days
      },
      {
        type: 'condition',
        condition_type: 'days_since_last_visit',
        config: { operator: 'lte', value: 5 },
        true_branch: 5, // they came back — tag and exit
        false_branch: 3, // send second email
      },
      {
        type: 'email',
        subject: 'A little something to get you back in',
        body: 'Hi {{first_name}},\n\nWe really think you\'d love making this a regular thing. The benefits of consistent heat + cold therapy compound over time — better sleep, reduced inflammation, and improved recovery.\n\nBook your next session and experience the difference:\n\n{{booking_link}}\n\nHope to see you soon!',
        preheader: 'The benefits compound over time',
      },
      {
        type: 'wait',
        delay_minutes: 3 * 24 * 60, // 3 days
      },
      {
        type: 'tag',
        tag_name: 'winback_attempted',
        action: 'add',
      },
    ],
    exit_conditions: {
      conditions: [{ type: 'checked_in' }],
    },
    allow_reenrollment: false,
    reenrollment_cooldown_days: 60,
    category: 'winback',
  },

  // ── 4. Retention: Cooling Off Re-engagement ───────────────────────────
  {
    slug: 'retention-cooling-off',
    name: 'Retention: Cooling Off Re-engagement',
    description:
      'Targets members whose engagement status has dropped to "cooling". Sends a personal re-engagement email, waits, then flags at-risk members for staff follow-up.',
    trigger_type: 'cooling_off',
    trigger_config: {},
    steps: [
      {
        type: 'email',
        subject: 'We haven\'t seen you in a while — everything okay?',
        body: 'Hi {{first_name}},\n\nWe noticed it\'s been a bit since your last visit. Life gets busy — we get it.\n\nBut your body misses the routine. Even one session can reset your stress levels and get you back on track.\n\nWe\'ve got spots open this week:\n\n{{booking_link}}\n\nSee you soon?',
        preheader: 'Even one session can reset your routine',
      },
      {
        type: 'wait',
        delay_minutes: 7 * 24 * 60, // 7 days
      },
      {
        type: 'condition',
        condition_type: 'days_since_last_visit',
        config: { operator: 'lte', value: 7 },
        true_branch: 5, // they came back
        false_branch: 3, // still haven't visited
      },
      {
        type: 'tag',
        tag_name: 'at_risk',
        action: 'add',
      },
      {
        type: 'update_field',
        field: 'health_risk_level',
        value: 'at_risk',
      },
      {
        type: 'tag',
        tag_name: 're_engaged',
        action: 'add',
      },
    ],
    exit_conditions: {
      conditions: [{ type: 'checked_in' }],
    },
    allow_reenrollment: true,
    reenrollment_cooldown_days: 30,
    category: 'retention',
  },

  // ── 5. Upsell: Plan Upgrade Candidate ─────────────────────────────────
  {
    slug: 'upsell-plan-upgrade',
    name: 'Upsell: Plan Upgrade Candidate',
    description:
      'Identifies members on class packs or drop-in who are visiting frequently (8+ times/month) and nudges them toward an unlimited membership upgrade.',
    trigger_type: 'plan_upgrade_candidate',
    trigger_config: { min_monthly_visits: 8 },
    steps: [
      {
        type: 'tag',
        tag_name: 'upgrade_candidate',
        action: 'add',
      },
      {
        type: 'email',
        subject: 'You\'re visiting so often — time to upgrade?',
        body: 'Hi {{first_name}},\n\nYou\'ve been on fire lately! With {{recent_visits}} visits this month, an unlimited membership would actually save you money compared to your current plan.\n\nHere\'s what you\'d get:\n- Unlimited classes (no counting credits)\n- Priority booking\n- 10% member discount on merch & gift cards\n- Freeze your membership anytime\n\nUpgrade in one tap from your account:\n\n{{upgrade_link}}\n\nQuestions? Just reply to this email.',
        preheader: 'An unlimited membership would save you money',
      },
      {
        type: 'wait',
        delay_minutes: 4 * 24 * 60, // 4 days
      },
      {
        type: 'condition',
        condition_type: 'membership_type',
        config: { is_unlimited: true },
        true_branch: 6, // they upgraded
        false_branch: 4, // send second nudge
      },
      {
        type: 'email',
        subject: 'Quick math: You\'d save with unlimited',
        body: 'Hi {{first_name}},\n\nAt your current pace, switching to unlimited could save you significant money each month — and you\'d never have to think about credits again.\n\nUpgrading takes 30 seconds and Stripe handles the prorated billing automatically:\n\n{{upgrade_link}}\n\nNo commitment — you can change plans anytime.',
        preheader: 'Stop counting credits',
      },
      {
        type: 'wait',
        delay_minutes: 7 * 24 * 60, // 7 days
      },
      {
        type: 'tag',
        tag_name: 'upgrade_offered',
        action: 'add',
      },
    ],
    exit_conditions: {
      conditions: [{ type: 'membership_active' }],
    },
    allow_reenrollment: true,
    reenrollment_cooldown_days: 60,
    category: 'upsell',
  },

  // ── 6. Win-Back: Lapsed with Credits ──────────────────────────────────
  {
    slug: 'lapsed-with-credits-reminder',
    name: 'Win-Back: Lapsed with Credits',
    description:
      'Remind members who still have unused credits to come back before they expire. Two-touch email sequence targeting the easiest re-engagement opportunity.',
    trigger_type: 'lapsed_with_credits',
    trigger_config: {},
    steps: [
      {
        type: 'email',
        subject: 'You still have {{credits}} credits waiting!',
        body: 'Hi {{first_name}},\n\nWe noticed you still have credits on your account, but it\'s been a while since your last visit.\n\nDon\'t let them go to waste! Your credits are ready to use — just pick a time that works:\n\n{{booking_link}}\n\nWe\'d love to see you back. Even one session can make a difference.',
        preheader: 'Your credits are waiting for you',
      },
      {
        type: 'wait',
        delay_minutes: 168 * 60, // 7 days
      },
      {
        type: 'condition',
        condition_type: 'days_since_last_visit',
        config: { operator: 'lte', value: 7 },
        true_branch: 5, // they came back — tag and exit
        false_branch: 3, // send second email
      },
      {
        type: 'email',
        subject: 'Don\'t let your credits go to waste',
        body: 'Hi {{first_name}},\n\nJust a friendly reminder — you have {{credits}} credits that are waiting to be used.\n\nYour body will thank you for getting back into the routine. Pick your next session:\n\n{{booking_link}}\n\nHope to see you soon!',
        preheader: 'Your credits won\'t last forever',
      },
      {
        type: 'wait',
        delay_minutes: 5 * 24 * 60, // 5 days
      },
      {
        type: 'tag',
        tag_name: 'lapsed_credits_winback_attempted',
        action: 'add',
      },
    ],
    exit_conditions: {
      on_booking: true,
      conditions: [{ type: 'checked_in' }],
    },
    allow_reenrollment: true,
    reenrollment_cooldown_days: 60,
    category: 'winback',
  },

  // ── 7. Engagement: Class Type Fan ─────────────────────────────────────
  {
    slug: 'engagement-class-type-fan',
    name: 'Engagement: Class Type Fan',
    description:
      'Recognizes members who are fans of a specific class type (5+ attended sessions). Sends them relevant notifications about new classes, special sessions, or instructor updates.',
    trigger_type: 'class_type_fan',
    trigger_config: { min_visits: 5 },
    steps: [
      {
        type: 'tag',
        tag_name: 'class_fan',
        action: 'add',
      },
      {
        type: 'email',
        subject: 'You\'re officially a regular — here\'s a heads up',
        body: 'Hi {{first_name}},\n\nWe couldn\'t help but notice — you really love your sessions here! With 5+ visits, you\'re officially one of our regulars.\n\nAs a thank-you, we wanted to give you early access to some exciting updates:\n- New class times being added to the schedule\n- Special themed sessions coming soon\n- Instructor spotlights and behind-the-scenes content\n\nKeep an eye on your inbox — we\'ll let you know first when something new drops.\n\nKeep up the great work!\n\n{{booking_link}}',
        preheader: 'You\'re one of our top regulars',
      },
      {
        type: 'wait',
        delay_minutes: 14 * 24 * 60, // 14 days
      },
      {
        type: 'email',
        subject: 'New on the schedule — thought you\'d want to know',
        body: 'Hi {{first_name}},\n\nSince you\'re one of our most dedicated members, we wanted to make sure you saw the latest additions to our schedule.\n\nCheck out what\'s new and grab your favorite spots before they fill up:\n\n{{booking_link}}\n\nSee you soon!',
        preheader: 'New classes just added',
      },
      {
        type: 'tag',
        tag_name: 'class_fan_notified',
        action: 'add',
      },
    ],
    exit_conditions: {},
    allow_reenrollment: true,
    reenrollment_cooldown_days: 90,
    category: 'engagement',
  },
];
