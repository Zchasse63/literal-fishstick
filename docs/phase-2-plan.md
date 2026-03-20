# Phase 2: Marketing & Engagement — Implementation Plan

**Version:** 2.0
**Date:** March 20, 2026
**Status:** FINAL — Post-scrutiny, all policy decisions resolved

---

## 1. Executive Summary

Phase 2 transforms Meridian's marketing/page.tsx stub (mock data, 3 tabs) into a fully functional marketing engine with campaign execution, automation workflows, lead management, and a content hub. The foundation exists: Resend integration, email templates with merge tags, AI campaign copy generation, smart segments, and SSE-streaming campaign send.

**Build order:** Database schema → API routes → UI pages (campaign builder first, then automations, leads, content hub, dashboard).

**Estimated scope:** 8.5–9 weeks for a single developer, broken into 5 sprints built sequentially.

**Key architectural decisions (post-scrutiny):**
- **Inngest** for automation engine (event-driven steps, native delays, idempotency)
- **Netlify Scheduled Functions** for campaign scheduling (2x daily) and lead scoring (every 4 hours)
- **ReactFlow** for visual automation builder (not custom node graph)
- **@dnd-kit/core** for Kanban lead pipeline drag-and-drop
- **SMS deferred to Phase 4** — provider-agnostic stub only in Phase 2
- **A/B testing: data-collection only** — no auto-winner selection (manual pick)
- **Content moderation UI deferred to Phase 5** — no member posts until then

---

## 2. What Already Exists (Phase 1 Foundation)

| Component | Status | Location |
|---|---|---|
| Resend email client (transactional, campaign, batch) | ✅ Complete | `src/lib/resend.ts` |
| HTML email template engine (Handlebars, branded layout) | ✅ Complete | `src/lib/email-templates.ts` |
| AI campaign copy generator (6 types) | ✅ Complete | `src/lib/anthropic.ts` → `generateCampaignCopy()` |
| Campaign send with SSE progress streaming | ✅ Complete | `api/campaigns/send/route.ts` |
| Test email endpoint | ✅ Complete | `api/campaigns/send-test/route.ts` |
| Email template CRUD API | ✅ Complete | `api/email-templates/route.ts` |
| Smart segments with rule builder | ✅ Complete | `api/segments/route.ts` + segments/page.tsx |
| Resend webhook receiver (open/click/bounce events) | ✅ Complete | `api/webhooks/resend/route.ts` |
| Marketing page UI stub (3 tabs, mock data) | ✅ Stub | `(admin)/marketing/page.tsx` |
| TypeScript types (Campaign, AutomationFlow, Lead, CommunityPost) | ✅ Complete | `packages/types/src/marketing.ts` |
| Member health scores + churn prediction AI | ✅ Complete | `src/lib/anthropic.ts` |

**Gap analysis:** No database migrations, no automation engine, no lead pipeline, no SMS provider, campaign UI uses mock data only.

---

## 3. Database Schema (New Tables & Modifications)

### 3.1 New Tables

```sql
-- ==========================================
-- CAMPAIGNS (extends existing concept)
-- ==========================================
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES studios(id),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled')),
  channels TEXT[] NOT NULL DEFAULT '{email}',

  -- Targeting
  segment_id UUID REFERENCES segments(id),
  recipient_filter JSONB, -- ad-hoc filter if no segment
  estimated_recipients INT DEFAULT 0,

  -- Email content
  subject TEXT,
  preview_text TEXT,
  body_html TEXT,
  body_text TEXT,
  template_id UUID REFERENCES email_templates(id),

  -- SMS content (stubbed — provider deferred to Phase 4)
  sms_body TEXT,
  sms_char_count INT DEFAULT 0,

  -- Scheduling
  scheduled_at TIMESTAMPTZ,
  send_started_at TIMESTAMPTZ,
  send_completed_at TIMESTAMPTZ,

  -- A/B testing (data-collection only — no auto-winner in Phase 2)
  ab_test_enabled BOOLEAN DEFAULT FALSE,
  ab_variants JSONB, -- [{subject, body_html, percentage}]
  ab_winner_metric TEXT CHECK (ab_winner_metric IN ('open_rate', 'click_rate', 'conversion_rate')),
  ab_winner_selected_at TIMESTAMPTZ, -- manual selection timestamp

  -- Metrics (denormalized for fast reads, updated via Resend webhooks)
  recipient_count INT DEFAULT 0,
  sent_count INT DEFAULT 0,
  delivered_count INT DEFAULT 0,
  open_count INT DEFAULT 0,
  click_count INT DEFAULT 0,
  bounce_count INT DEFAULT 0,
  unsubscribe_count INT DEFAULT 0,
  conversion_count INT DEFAULT 0,
  revenue_attributed DECIMAL(10,2) DEFAULT 0,

  -- Metadata
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- CAMPAIGN RECIPIENTS (per-member tracking)
-- ==========================================
CREATE TABLE campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES profiles(id),
  studio_id UUID NOT NULL,

  -- Delivery
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'unsubscribed', 'failed')),
  resend_message_id TEXT,
  channel TEXT NOT NULL DEFAULT 'email',

  -- Engagement
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  click_urls TEXT[], -- which links were clicked

  -- A/B variant
  ab_variant TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(campaign_id, member_id, channel)
);

-- ==========================================
-- AUTOMATION FLOWS
-- ==========================================
CREATE TABLE automation_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,

  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'signup', 'no_show', 'churn_risk', 'credit_expiry', 'birthday',
    'milestone', 'membership_change', 'booking_completed', 'failed_payment',
    'inactivity', 'referral', 'custom'
  )),
  trigger_config JSONB NOT NULL DEFAULT '{}',
  -- e.g. { "inactivity_days": 14 } or { "milestone_type": "visits", "count": 50 }

  steps JSONB NOT NULL DEFAULT '[]',
  -- Array of steps:
  -- { "type": "email", "template_id": "...", "subject": "...", "body_html": "...", "delay_minutes": 0 }
  --   ^ body_html is SNAPSHOTTED at flow save time (not a live FK to templates)
  -- { "type": "wait", "delay_minutes": 2880 }
  -- { "type": "condition", "field": "email_opened", "check_step_index": 0, "true_branch": 3, "false_branch": 5 }
  --   ^ check_step_index: which email step to check (within THIS flow)
  -- { "type": "sms", "body": "...", "delay_minutes": 0 }
  -- { "type": "tag", "action": "add", "tag": "re-engaged" }
  -- { "type": "update_field", "field": "status", "value": "at_risk" }

  -- Exit conditions: auto-exit members when trigger condition resolves
  exit_conditions JSONB DEFAULT '{}',
  -- e.g. { "membership_reactivated": true } for win-back flows
  -- e.g. { "payment_succeeded": true } for failed-payment flows

  -- Versioning: incremented on every edit while flow is active
  version INT NOT NULL DEFAULT 1,

  is_active BOOLEAN DEFAULT FALSE,

  -- Re-enrollment policy
  allow_reenrollment BOOLEAN DEFAULT FALSE, -- TRUE for birthday, milestone
  reenrollment_cooldown_days INT DEFAULT 365, -- min days between enrollments

  -- Metrics
  total_enrolled INT DEFAULT 0,
  total_completed INT DEFAULT 0,
  total_converted INT DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- AUTOMATION ENROLLMENTS (members in flows)
-- ==========================================
CREATE TABLE automation_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL REFERENCES automation_flows(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES profiles(id),
  studio_id UUID NOT NULL,

  current_step INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'exited', 'paused', 'failed')),
  exit_reason TEXT, -- 'condition_resolved', 'flow_deactivated', 'member_deleted', 'manual', 'cooldown', 'error'

  -- Flow version snapshot: enrollments execute against the version they started with
  flow_version INT NOT NULL DEFAULT 1,
  flow_snapshot JSONB, -- steps array at time of enrollment (immutable)

  -- Step execution tracking
  step_history JSONB DEFAULT '[]',
  -- [{ "step": 0, "executed_at": "...", "result": "sent", "inngest_event_id": "..." }, ...]

  -- Inngest correlation
  inngest_function_id TEXT, -- Inngest function run ID for this enrollment

  -- Idempotency: prevents double-processing (Inngest handles this natively,
  -- but kept for observability and manual intervention)
  processing_at TIMESTAMPTZ,
  last_processed_at TIMESTAMPTZ,

  next_step_at TIMESTAMPTZ, -- informational only (Inngest manages actual timing)

  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  exited_at TIMESTAMPTZ,

  UNIQUE(automation_id, member_id)
);

-- ==========================================
-- LEADS
-- ==========================================
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL,

  -- Contact info
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,

  -- Pipeline
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'trial', 'converted', 'lost')),
  source TEXT CHECK (source IN ('instagram', 'google', 'walk_in', 'referral', 'corporate', 'event', 'website', 'facebook', 'other')),
  source_detail TEXT, -- e.g. specific ad campaign, referrer name

  -- Scoring
  score INT DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  score_factors JSONB DEFAULT '{}',

  -- Conversion
  converted_member_id UUID REFERENCES profiles(id),
  converted_at TIMESTAMPTZ,

  -- Assignment
  assigned_to UUID REFERENCES profiles(id), -- staff member

  -- Notes & activity
  notes TEXT,
  last_contacted_at TIMESTAMPTZ,
  next_follow_up_at TIMESTAMPTZ,

  -- Tags for flexible categorization
  tags TEXT[] DEFAULT '{}',

  -- Deduplication
  UNIQUE(studio_id, email),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- LEAD ACTIVITIES (timeline)
-- ==========================================
CREATE TABLE lead_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  studio_id UUID NOT NULL,

  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'created', 'status_change', 'note_added', 'email_sent', 'email_opened',
    'sms_sent', 'call_logged', 'form_submitted', 'trial_booked',
    'trial_completed', 'converted', 'lost', 'score_change', 'assigned'
  )),

  description TEXT,
  metadata JSONB DEFAULT '{}',
  performed_by UUID REFERENCES profiles(id),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- CONTENT POSTS (Community Board + Content Hub)
-- ==========================================
CREATE TABLE content_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL,

  -- Author
  author_id UUID NOT NULL REFERENCES profiles(id),
  author_role TEXT NOT NULL CHECK (author_role IN ('owner', 'manager', 'trainer', 'member')),

  -- Content
  post_type TEXT NOT NULL DEFAULT 'update' CHECK (post_type IN ('update', 'event', 'class_promo', 'tip', 'poll', 'announcement')),
  title TEXT,
  content TEXT NOT NULL,
  image_url TEXT, -- must be Supabase Storage URL (enforced at API layer)

  -- Publishing: immediate or draft only in Phase 2 (no scheduled publishing)
  is_published BOOLEAN DEFAULT FALSE,
  is_pinned BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ,

  -- Moderation (infrastructure ready, UI deferred to Phase 5)
  is_approved BOOLEAN DEFAULT TRUE, -- auto-approved for staff, pending for members
  moderated_by UUID REFERENCES profiles(id),
  moderated_at TIMESTAMPTZ,

  -- Engagement
  like_count INT DEFAULT 0,
  comment_count INT DEFAULT 0,

  -- Targeting
  visible_to TEXT[] DEFAULT '{all}', -- ['all'], ['members'], ['staff'], specific segment IDs

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- CONTENT COMMENTS
-- ==========================================
CREATE TABLE content_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES content_posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id),
  studio_id UUID NOT NULL,

  content TEXT NOT NULL,
  is_approved BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- CONTENT LIKES
-- ==========================================
CREATE TABLE content_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES content_posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id),
  studio_id UUID NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(post_id, author_id)
);

-- ==========================================
-- EMAIL PREFERENCES (unsubscribe management)
-- ==========================================
CREATE TABLE email_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  studio_id UUID NOT NULL,

  marketing_email BOOLEAN DEFAULT TRUE,
  transactional_email BOOLEAN DEFAULT TRUE,
  sms_marketing BOOLEAN DEFAULT TRUE,
  push_notifications BOOLEAN DEFAULT TRUE,

  -- Hard bounce tracking (auto-set via Resend webhook)
  hard_bounced BOOLEAN DEFAULT FALSE,
  hard_bounced_at TIMESTAMPTZ,

  unsubscribed_at TIMESTAMPTZ,
  unsubscribe_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(member_id, studio_id)
);

-- ==========================================
-- AUTOMATION COOLDOWNS (global per-member rate limiting)
-- ==========================================
CREATE TABLE automation_cooldowns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  studio_id UUID NOT NULL,

  last_automation_email_at TIMESTAMPTZ,
  last_automation_sms_at TIMESTAMPTZ,

  -- 24-hour global cooldown: member receives max 1 automation email per 24 hours
  -- Checked by Inngest before executing email/sms steps

  UNIQUE(member_id, studio_id)
);
```

### 3.2 Indexes

```sql
-- Campaigns
CREATE INDEX idx_campaigns_studio_status ON campaigns(studio_id, status);
CREATE INDEX idx_campaigns_scheduled ON campaigns(scheduled_at) WHERE status = 'scheduled';

-- Recipients
CREATE INDEX idx_campaign_recipients_campaign ON campaign_recipients(campaign_id);
CREATE INDEX idx_campaign_recipients_member ON campaign_recipients(member_id);
CREATE INDEX idx_campaign_recipients_status ON campaign_recipients(campaign_id, status);

-- Automations
CREATE INDEX idx_automation_flows_studio ON automation_flows(studio_id);
CREATE INDEX idx_automation_enrollments_member ON automation_enrollments(member_id);
CREATE INDEX idx_automation_enrollments_status ON automation_enrollments(automation_id, status);

-- Leads
CREATE INDEX idx_leads_studio_status ON leads(studio_id, status);
CREATE INDEX idx_leads_source ON leads(studio_id, source);
CREATE INDEX idx_leads_score ON leads(studio_id, score DESC);
CREATE INDEX idx_leads_follow_up ON leads(next_follow_up_at) WHERE status NOT IN ('converted', 'lost');
CREATE INDEX idx_leads_email ON leads(studio_id, email);
CREATE INDEX idx_lead_activities_lead ON lead_activities(lead_id);

-- Content
CREATE INDEX idx_content_posts_studio ON content_posts(studio_id, is_published, created_at DESC);
CREATE INDEX idx_content_comments_post ON content_comments(post_id);

-- Email preferences
CREATE INDEX idx_email_prefs_member ON email_preferences(member_id, studio_id);

-- Automation cooldowns
CREATE INDEX idx_cooldowns_member ON automation_cooldowns(member_id, studio_id);
```

### 3.3 RLS Policies

Every table gets `studio_id`-scoped RLS:

```sql
-- Pattern for all tables:
ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;

CREATE POLICY "{table}_studio_isolation" ON {table}
  FOR ALL USING (studio_id = current_setting('app.studio_id')::uuid);
```

**Cron/Inngest context note:** Automation processing via Inngest uses a service-role Supabase client that bypasses RLS. All Inngest functions must explicitly filter by `studio_id` in their queries. This is documented in the Inngest function boilerplate.

### 3.4 Existing Table Modifications

```sql
-- Add email preference check to email_send_log
ALTER TABLE email_send_log ADD COLUMN IF NOT EXISTS campaign_recipient_id UUID REFERENCES campaign_recipients(id);

-- Add marketing source tracking to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS acquisition_source TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS acquisition_campaign_id UUID;
-- Note: no FK to campaigns to avoid bidirectional dependency. Campaign ID stored as UUID, validated at API layer.

-- Add timezone to profiles (needed for birthday automation trigger)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York';
```

### 3.5 GDPR Data Deletion

When a member profile is deleted, the following Phase 2 data must be cleaned up:

```sql
-- Add to the member deletion function/trigger:
DELETE FROM campaign_recipients WHERE member_id = $1;
DELETE FROM automation_enrollments WHERE member_id = $1;
DELETE FROM automation_cooldowns WHERE member_id = $1;
DELETE FROM email_preferences WHERE member_id = $1;
-- lead_activities: anonymize (set performed_by = NULL) rather than delete
-- content_posts/comments/likes: anonymize author_id or delete based on studio policy
```

The `email_preferences` table already has `ON DELETE CASCADE` from `profiles`. Other tables need explicit cleanup in the member deletion flow.

---

## 4. Automation Engine Architecture (Inngest)

### 4.1 Why Inngest

The automation engine is the core of Phase 2. Instead of polling-based crons, we use **Inngest** — an event-driven orchestration platform that provides:

- **Native `step.sleep()`** — "wait 2 days" is a first-class concept, no DB polling
- **Automatic retries** — failed email sends retry with exponential backoff
- **Built-in idempotency** — duplicate events are deduplicated automatically
- **Event-driven triggers** — member books a class → fires event → triggers relevant flows
- **Observability dashboard** — see all running functions, step progress, failures

### 4.2 Inngest Event Architecture

```typescript
// src/lib/inngest/client.ts
import { Inngest } from 'inngest';

export const inngest = new Inngest({ id: 'meridian' });

// Events that trigger automation enrollment:
type MeridianEvents = {
  'member/signup': { data: { member_id: string; studio_id: string } };
  'member/no_show': { data: { member_id: string; class_id: string; studio_id: string } };
  'member/churn_risk': { data: { member_id: string; risk_score: number; studio_id: string } };
  'member/credit_expiry': { data: { member_id: string; expires_at: string; studio_id: string } };
  'member/birthday': { data: { member_id: string; studio_id: string } };
  'member/milestone': { data: { member_id: string; milestone_type: string; count: number; studio_id: string } };
  'member/membership_change': { data: { member_id: string; from: string; to: string; studio_id: string } };
  'member/booking_completed': { data: { member_id: string; class_id: string; studio_id: string } };
  'payment/failed': { data: { member_id: string; amount: number; studio_id: string } };
  'member/inactive': { data: { member_id: string; days_inactive: number; studio_id: string } };
  'member/referral': { data: { referrer_id: string; referred_id: string; studio_id: string } };

  // Internal events
  'automation/execute_flow': { data: { enrollment_id: string; automation_id: string; studio_id: string } };
  'campaign/send_scheduled': { data: { campaign_id: string; studio_id: string } };
};
```

### 4.3 Inngest Flow Executor

```typescript
// src/lib/inngest/functions/execute-flow.ts
export const executeAutomationFlow = inngest.createFunction(
  {
    id: 'execute-automation-flow',
    retries: 3,
    concurrency: { limit: 10 }, // max 10 concurrent flow executions
  },
  { event: 'automation/execute_flow' },
  async ({ event, step }) => {
    const { enrollment_id, studio_id } = event.data;

    // Load enrollment + flow snapshot
    const enrollment = await step.run('load-enrollment', async () => {
      return supabase.from('automation_enrollments')
        .select('*, automation_flows(*)')
        .eq('id', enrollment_id)
        .single();
    });

    const steps = enrollment.flow_snapshot; // immutable step array

    for (let i = enrollment.current_step; i < steps.length; i++) {
      const flowStep = steps[i];

      // Check exit conditions before each step
      const shouldExit = await step.run(`check-exit-${i}`, async () => {
        return checkExitConditions(enrollment, enrollment.automation_flows.exit_conditions);
      });
      if (shouldExit) {
        await step.run('exit-enrollment', () => exitEnrollment(enrollment_id, 'condition_resolved'));
        return;
      }

      // Check 24-hour global cooldown before email/sms steps
      if (flowStep.type === 'email' || flowStep.type === 'sms') {
        const onCooldown = await step.run(`check-cooldown-${i}`, async () => {
          return checkAutomationCooldown(enrollment.member_id, studio_id, flowStep.type);
        });
        if (onCooldown) {
          // Wait until cooldown expires, then retry this step
          await step.sleep(`cooldown-wait-${i}`, '1 hour');
          i--; // retry this step
          continue;
        }
      }

      switch (flowStep.type) {
        case 'email':
          await step.run(`send-email-${i}`, () => sendAutomationEmail(enrollment, flowStep));
          await step.run(`update-cooldown-${i}`, () => updateCooldown(enrollment.member_id, studio_id, 'email'));
          break;

        case 'wait':
          await step.sleep(`wait-${i}`, `${flowStep.delay_minutes} minutes`);
          break;

        case 'condition':
          const result = await step.run(`evaluate-condition-${i}`, () =>
            evaluateCondition(enrollment, flowStep)
          );
          i = result ? flowStep.true_branch - 1 : flowStep.false_branch - 1;
          // -1 because the for loop will increment
          break;

        case 'sms':
          await step.run(`send-sms-${i}`, () => sendAutomationSMS(enrollment, flowStep));
          await step.run(`update-cooldown-${i}`, () => updateCooldown(enrollment.member_id, studio_id, 'sms'));
          break;

        case 'tag':
          await step.run(`apply-tag-${i}`, () => applyTag(enrollment.member_id, flowStep));
          break;

        case 'update_field':
          await step.run(`update-field-${i}`, () => updateMemberField(enrollment.member_id, flowStep));
          break;
      }

      // Record step in history
      await step.run(`record-step-${i}`, () => recordStepExecution(enrollment_id, i, 'success'));
    }

    // Flow complete
    await step.run('complete-enrollment', () => completeEnrollment(enrollment_id));
  }
);
```

### 4.4 Trigger Evaluator (Inngest Cron)

Instead of a Netlify cron for trigger evaluation, Inngest handles this too:

```typescript
// Inngest cron function — runs every 10 minutes
export const evaluateAutomationTriggers = inngest.createFunction(
  { id: 'evaluate-automation-triggers' },
  { cron: '*/10 * * * *' }, // every 10 minutes
  async ({ step }) => {
    // For each active automation, check if any members qualify
    const flows = await step.run('load-active-flows', () =>
      supabase.from('automation_flows').select('*').eq('is_active', true)
    );

    for (const flow of flows) {
      const qualifying = await step.run(`evaluate-${flow.id}`, () =>
        evaluateTrigger(flow)
      );

      for (const member of qualifying) {
        // Check reenrollment policy
        const canEnroll = await step.run(`check-enroll-${flow.id}-${member.id}`, () =>
          canEnrollMember(flow, member)
        );

        if (canEnroll) {
          // Create enrollment + snapshot flow steps
          const enrollment = await step.run(`enroll-${flow.id}-${member.id}`, () =>
            createEnrollment(flow, member)
          );

          // Fire event to start the flow execution
          await step.sendEvent(`start-${flow.id}-${member.id}`, {
            name: 'automation/execute_flow',
            data: {
              enrollment_id: enrollment.id,
              automation_id: flow.id,
              studio_id: flow.studio_id,
            },
          });
        }
      }
    }
  }
);
```

### 4.5 Automation Policy Decisions (Resolved)

| Policy | Decision | Rationale |
|---|---|---|
| **Flow edit while members enrolled** | Pause all active enrollments. On reactivation, enrollments resume from their current step using the snapshotted flow version. If a NEW version is published, new enrollments get the new version; existing enrollments keep their snapshot. | Prevents mid-sequence corruption. Simple to implement with `flow_snapshot JSONB`. |
| **Auto-exit conditions** | Each flow defines `exit_conditions JSONB`. Checked before every step. Win-back exits when membership reactivates. Failed-payment exits when payment succeeds. Inactivity exits when member books a class. | Prevents sending irrelevant messages. |
| **Multi-flow cooldown** | Global 24-hour cooldown per member per channel. A member receives max 1 automation email and 1 automation SMS per 24 hours across ALL flows. Tracked in `automation_cooldowns` table. If cooldown active, Inngest waits and retries. | Prevents spam feeling. Small studio = noticeable if members get 3 emails in one day. |
| **A/B testing** | Phase 2 is data-collection only. Both variants are sent to their assigned percentages. Admin manually reviews results and picks the winner. Auto-winner selection deferred to Phase 3. | Reduces scope. Manual review is fine for a single studio. |
| **Re-enrollment** | Configurable per flow. `allow_reenrollment` + `reenrollment_cooldown_days`. Birthday = TRUE + 365 days. Win-back = TRUE + 90 days. Welcome = FALSE. | Birthday needs yearly re-enrollment. Win-back may recur. Welcome is one-time. |
| **Step failure handling** | Inngest retries 3x with exponential backoff. After 3 failures, enrollment status set to `failed` with error logged in `step_history`. Admin notified via Command Center activity feed. | Inngest handles retries natively. Failed enrollments surface in the dashboard. |

---

## 5. API Routes

### 5.1 Campaign Management

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/campaigns` | List campaigns (filterable by status, paginated) |
| POST | `/api/campaigns` | Create new campaign |
| GET | `/api/campaigns/[id]` | Get campaign detail with metrics |
| PUT | `/api/campaigns/[id]` | Update campaign (draft/scheduled only) |
| DELETE | `/api/campaigns/[id]` | Delete campaign (soft-delete if sent, hard-delete if draft) |
| POST | `/api/campaigns/[id]/schedule` | Schedule campaign for future send |
| POST | `/api/campaigns/[id]/send` | Execute campaign send (existing SSE endpoint, enhanced) |
| POST | `/api/campaigns/[id]/pause` | Pause active campaign |
| POST | `/api/campaigns/[id]/duplicate` | Clone campaign as new draft |
| GET | `/api/campaigns/[id]/recipients` | List recipients with engagement status |
| POST | `/api/campaigns/[id]/select-winner` | A/B test: manually select winning variant |
| POST | `/api/campaigns/send-test` | Send test email (existing, enhance) |
| POST | `/api/campaigns/process-scheduled` | Netlify Scheduled Function: send due campaigns (2x daily) |

**Campaign send enhancements:**
- Re-check `email_preferences` at each batch (not just at start) to catch mid-send unsubscribes
- Skip members with `hard_bounced = TRUE`
- Snapshot recipients at send-start (write to `campaign_recipients` with `status = 'pending'`)
- On retry: skip members with `status = 'sent'` (resumable send)
- **Send window:** Campaigns more than 2 hours past `scheduled_at` are auto-cancelled (prevents stale cron sends)

### 5.2 Automation Flows

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/automations` | List all automation flows |
| POST | `/api/automations` | Create new automation flow |
| GET | `/api/automations/[id]` | Get flow detail with enrollment stats |
| PUT | `/api/automations/[id]` | Update flow definition (increments version, pauses active enrollments) |
| DELETE | `/api/automations/[id]` | Delete flow (exits all enrollments) |
| POST | `/api/automations/[id]/activate` | Activate automation |
| POST | `/api/automations/[id]/deactivate` | Deactivate (pauses all active enrollments) |
| GET | `/api/automations/[id]/enrollments` | List enrolled members |
| POST | `/api/automations/[id]/enrollments/[eid]/exit` | Manually exit a member from a flow |

**Note:** No cron API routes for automations — Inngest handles all execution and trigger evaluation internally via its own cron and event system.

### 5.3 Lead Pipeline

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/leads` | List leads (filterable by status, source, score) |
| POST | `/api/leads` | Create lead (manual) |
| GET | `/api/leads/[id]` | Get lead detail with activity timeline |
| PUT | `/api/leads/[id]` | Update lead (status, assignment, notes) |
| DELETE | `/api/leads/[id]` | Delete lead |
| POST | `/api/leads/[id]/convert` | Convert lead to member |
| POST | `/api/leads/[id]/activity` | Log activity (call, note, email) |
| POST | `/api/leads/capture` | Public endpoint: lead capture form submission |
| POST | `/api/leads/score` | Netlify Scheduled Function: recalculate lead scores (every 4 hours) |

**Lead capture deduplication:** On `POST /api/leads/capture`, check for existing lead with same email + studio_id. If found, update existing record + add `form_submitted` activity entry. If new, create lead.

**Cross-module auto-convert:** When a new member is created via `POST /api/members`, check `leads` table for matching email. If found, auto-set `status = 'converted'`, `converted_member_id`, `converted_at`.

**Lead capture security:**
- Rate limit: 10 requests/minute per IP (via Netlify Edge Function or middleware)
- Honeypot field (hidden input, reject if filled)
- Validate `studio_id` against an embed token (not the raw UUID) to prevent enumeration
- No auth required (public endpoint)
- Middleware must whitelist `/api/leads/capture` and `/api/unsubscribe/*` from auth checks

### 5.4 Content Hub

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/content` | List posts (filterable by type, status, paginated) |
| POST | `/api/content` | Create post (publish immediately or save as draft) |
| GET | `/api/content/[id]` | Get post with comments |
| PUT | `/api/content/[id]` | Update post |
| DELETE | `/api/content/[id]` | Delete post |
| POST | `/api/content/[id]/like` | Toggle like |
| POST | `/api/content/[id]/comment` | Add comment |

**Deferred to Phase 5:** `POST /api/content/[id]/approve`, `POST /api/content/[id]/reject` (moderation endpoints — no member posts until Phase 5).

**No scheduled publishing cron.** Posts are either published immediately or saved as draft. Scheduled publishing deferred to Phase 5 when member-facing surfaces exist and timing matters.

### 5.5 Email Preferences

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/email-preferences/[memberId]` | Get member preferences |
| PUT | `/api/email-preferences/[memberId]` | Update preferences (admin toggle) |
| GET | `/api/unsubscribe/[token]` | Public: render unsubscribe confirmation page |
| POST | `/api/unsubscribe/[token]` | Public: process unsubscribe |

**Unsubscribe token spec:**
- HMAC-SHA256 signed: `member_id + studio_id + timestamp`
- Secret: `process.env.UNSUBSCRIBE_SECRET`
- Expiry: 30 days
- One-time use: after successful unsubscribe, the `unsubscribed_at` timestamp is set. Replaying the token is a no-op (idempotent, returns success, no side effects).
- Constant-time comparison to prevent timing attacks.
- Re-subscribe: admin can toggle `marketing_email = TRUE` in the member profile. No self-service re-subscribe until Phase 5.

**Hard bounce handling:** Resend webhook receives `bounced` event with `bounce_type: 'hard'`. Handler sets `email_preferences.hard_bounced = TRUE`, `hard_bounced_at = NOW()`. All future campaign sends and automation emails skip this member. Soft bounces are logged but do not suppress future sends.

---

## 6. Compliance

### 6.1 CAN-SPAM Requirements

All campaign and automation emails MUST include:

1. **Physical mailing address** in the footer — pulled from `studios` table `address` field
2. **Unsubscribe link** — already in the email template footer (Phase 1), enhanced with HMAC token
3. **Unsubscribe honored within 10 business days** — token-based system processes immediately (exceeds requirement)
4. **No deceptive subject lines** — AI-generated subjects include a system prompt constraint: "Do not generate misleading, deceptive, or clickbait subject lines"

**Implementation:** Update `src/lib/email-templates.ts` branded footer to include `{{studio_address}}` merge tag, populated from the `studios` table at send time.

### 6.2 GDPR

- Member data deletion cascades to all Phase 2 tables (see Section 3.5)
- `email_preferences.member_id` has `ON DELETE CASCADE`
- `campaign_recipients` and `automation_enrollments` cleaned up explicitly
- Lead data: if a lead converts to a member and later requests deletion, the lead record is anonymized (PII fields nulled, activity preserved for aggregate analytics)

---

## 7. SMS Integration (Stub Only — Phase 2)

### 7.1 Provider-Agnostic Architecture (Built Now)

```typescript
// src/lib/sms/types.ts
interface SMSProvider {
  sendSMS(to: string, body: string, options?: SMSOptions): Promise<SMSResult>;
  sendBatch(messages: SMSMessage[]): Promise<SMSResult[]>;
  handleWebhook(payload: unknown): Promise<SMSWebhookResult>; // delivery receipts
}

// src/lib/sms/index.ts — Factory pattern
export function createSMSProvider(): SMSProvider {
  const provider = process.env.SMS_PROVIDER; // 'twilio' | 'telnyx' | 'stub'
  switch (provider) {
    case 'twilio': return new TwilioProvider(); // Phase 4
    case 'telnyx': return new TelnyxProvider(); // Phase 4
    default: return new StubProvider(); // Phase 2: logs to console + stores in DB
  }
}
```

### 7.2 Phase 2 Scope

- ✅ Build the `SMSProvider` interface and `StubProvider`
- ✅ SMS body field in campaign builder UI (character counter, segment estimation)
- ✅ SMS step type in automation flow builder
- ✅ `sms_marketing` preference in `email_preferences` table
- ❌ Twilio/Telnyx adapter — deferred to Phase 4
- ❌ Delivery status webhooks — deferred to Phase 4
- ❌ Actual SMS sending — stub logs only

**Rationale:** The provider-agnostic architecture is built and tested. When Phase 4 adds Twilio, it's a single adapter implementation — no UI or schema changes needed.

---

## 8. AI Enhancements

### 8.1 New AI Features

| Feature | Input | Output | Method |
|---|---|---|---|
| **Send Time Optimization** | Member engagement history, timezone | Optimal send hour per member | `optimizeSendTime(memberData)` |
| **Lead Scoring** | Lead activity, email engagement, source | Score 0–100 + factors | `scoreLead(leadData)` |
| **Subject Line Suggestions** | Campaign context, audience segment | 5 subject line variants ranked | `suggestSubjectLines(context)` |
| **Automation Recommendations** | Studio metrics, member behavior patterns | Suggested automation flows | `recommendAutomations(studioData)` |
| **Campaign Performance Summary** | Campaign metrics, recipient data | Natural language performance brief | `summarizeCampaign(campaignData)` |

All AI features follow the established pattern: Claude API call with rules-based fallback if no API key.

### 8.2 Enhanced Existing AI

- **Campaign Copy Generator** — Add tone presets (professional, casual, urgent, celebratory), SMS-length copy mode, A/B variant generation mode
- **Churn Prediction** — Now fires `member/churn_risk` Inngest event when risk score exceeds threshold, auto-enrolling in win-back flows
- **Subject line constraint** — System prompt includes: "Never generate deceptive, misleading, or clickbait subject lines" (CAN-SPAM compliance)

---

## 9. UI Pages

### 9.1 Marketing Page Restructure

Replace the current 3-tab marketing/page.tsx with a full module using sub-routes:

```
(admin)/marketing/
├── page.tsx                    # Marketing overview dashboard
├── campaigns/
│   ├── page.tsx               # Campaign list
│   ├── new/page.tsx           # Campaign builder (step wizard)
│   └── [id]/
│       ├── page.tsx           # Campaign detail/edit
│       └── report/page.tsx    # Campaign performance report
├── automations/
│   ├── page.tsx               # Automation list + templates
│   ├── new/page.tsx           # Automation flow builder (ReactFlow)
│   └── [id]/page.tsx          # Automation detail/edit
├── leads/
│   ├── page.tsx               # Lead pipeline (Kanban — @dnd-kit)
│   └── [id]/page.tsx          # Lead detail with timeline
└── content/
    ├── page.tsx               # Content hub (feed view only)
    └── new/page.tsx           # Create/edit post
```

### 9.2 Page Specifications

#### Marketing Dashboard (`marketing/page.tsx`)
- **Top metrics row:** Active Campaigns, Automation Enrollments, Open Leads, Content Posts This Month
- **Recent campaign performance** — last 5 campaigns with spark charts (open rate, click rate)
- **Lead pipeline summary** — funnel visualization (New → Contacted → Trial → Converted)
- **Upcoming scheduled** — next 5 scheduled campaigns
- **AI recommendation cards** — "You have 23 members at churn risk — create a win-back campaign?"

#### Campaign List (`marketing/campaigns/page.tsx`)
- **Filters:** Status (All/Draft/Scheduled/Sending/Sent), Channel, Date range
- **Table:** Name, Status badge, Channel icons, Recipients, Open Rate, Click Rate, Revenue
- **Actions:** Edit, Duplicate, Delete, View Report
- **Quick actions:** "New Campaign" button, "AI Generate" button

#### Campaign Builder (`marketing/campaigns/new/page.tsx`)
- **Step 1: Setup** — Name, channel selection (email/SMS), segment or filter targeting
- **Step 2: Content** — Visual email editor OR AI generate with tone/type presets. Subject line with AI suggestions. SMS body with character counter. Preview pane (desktop/mobile toggle).
- **Step 3: Review & Schedule** — Recipient count estimate, send now vs. schedule, A/B test setup (optional: split percentages, variant subjects/bodies), test send
- **Template library** — Sidebar with saved templates, AI-generated options

#### Campaign Report (`marketing/campaigns/[id]/report/page.tsx`)
- **Header:** Campaign name, sent date, channel, segment
- **Metrics row:** Sent, Delivered, Opened, Clicked, Bounced, Unsubscribed, Converted
- **Funnel chart:** Sent → Delivered → Opened → Clicked → Converted
- **Click map:** Top clicked links with counts
- **AI summary** — Natural language performance brief (Claude-generated)
- **A/B comparison** — If A/B test, side-by-side variant performance + "Select Winner" button
- **Recipient table** — Searchable list with per-member status

#### Automation List (`marketing/automations/page.tsx`)
- **Cards:** Flow name, trigger type, status (Active/Inactive), enrolled count, completed count, conversion rate
- **Pre-built templates (4):** Welcome Sequence, Win-Back, Failed Payment Recovery, Churn Prevention
- **Quick toggle:** Activate/deactivate
- **Template gallery:** Click template → pre-fills the flow builder with recommended steps

#### Automation Builder (`marketing/automations/new/page.tsx`)
- **Trigger selector:** Dropdown with trigger types + config panel (e.g., inactivity: how many days?)
- **Visual flow builder** — ReactFlow vertical node graph
  - **Action nodes:** Send Email, Send SMS (stub), Add Tag, Update Field, Wait
  - **Condition nodes:** Email Opened?, Link Clicked?, Days Since Last Visit?, Membership Type?
  - **Branch paths:** Yes/No from conditions
- **Step config panel:** Right sidebar with step-specific settings
- **Exit conditions panel:** Define when members auto-exit the flow
- **Live preview:** Show email content inline when clicking email nodes

#### Lead Pipeline (`marketing/leads/page.tsx`)
- **Kanban view** — @dnd-kit columns for New, Contacted, Trial, Converted, Lost
- **Lead cards:** Name, source icon, score badge (color-coded), last activity timestamp, assigned staff avatar
- **Drag-and-drop** between columns (fires status change + activity log)
- **Quick add:** Floating "Add Lead" button
- **Filters:** Source, Score range, Assigned to, Date range
- **Bulk actions:** Assign, Tag, Email, Delete
- **Embed code generator:** Generate embeddable lead capture form HTML

#### Lead Detail (`marketing/leads/[id]/page.tsx`)
- **Header:** Name, email, phone, source, score gauge, status badge
- **Activity timeline:** Chronological log of all interactions (with icons per type)
- **Quick actions:** Log Call, Send Email, Add Note, Convert to Member
- **Conversion panel:** When converting, pre-fill member creation form with lead data

#### Content Hub (`marketing/content/page.tsx`)
- **Feed view:** Chronological post list (no calendar view in Phase 2)
- **Post cards:** Author avatar, content preview, type badge (announcement/tip/event/promo), engagement stats, publish status
- **Filters:** Type, Author role
- **Create button** → new post form

---

## 10. Dependencies to Add

```bash
# Sprint 1 (before campaign builder)
npm install isomorphic-dompurify    # HTML sanitization (server-side safe)

# Sprint 2 (before automation builder)
npm install inngest                  # Event-driven automation engine
npm install reactflow                # Visual flow builder UI

# Sprint 3 (before lead pipeline)
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities  # Kanban drag-and-drop
```

**Rate limiting for lead capture:** Use Netlify Edge Functions with a simple IP-based counter (KV store or in-memory for single instance). No additional dependency needed.

---

## 11. Scheduled Jobs (Final)

| Job | Engine | Frequency | Purpose |
|---|---|---|---|
| Automation trigger evaluator | **Inngest cron** | Every 10 min | Check trigger conditions, enroll qualifying members |
| Automation flow executor | **Inngest event** | On enrollment | Execute flow steps with native delays and retries |
| Campaign scheduler | **Netlify Scheduled Function** | 2x daily (9am, 2pm ET) | Check `campaigns WHERE status='scheduled' AND scheduled_at <= NOW()`, fire send. Auto-cancel if >2 hours past scheduled_at. |
| Lead scorer | **Netlify Scheduled Function** | Every 4 hours | Batch AI lead score recalculation |

**Total Netlify scheduled functions: 2.** Well within any plan limits.
**Inngest: 2 function definitions** (trigger evaluator cron + flow executor event handler).

---

## 12. Build Sequence

### Sprint 1 (Week 1–2): Campaign Engine
1. Install `isomorphic-dompurify`
2. Database migration: campaigns, campaign_recipients, email_preferences tables
3. Update `email-templates.ts`: add CAN-SPAM physical address (`{{studio_address}}`) to footer
4. Campaign CRUD API routes (create, read, update, delete, duplicate)
5. Enhanced campaign send: email preference filtering (per-batch re-check), hard bounce skip, recipient snapshot, resumable retry
6. Resend webhook enhancement: update `campaign_recipients` on open/click/bounce events, hard bounce → set `email_preferences.hard_bounced`
7. Unsubscribe flow: HMAC token generation, public landing page, preference update, idempotent replay
8. Campaign list page (replace mock data with real API calls)
9. Campaign builder page (3-step wizard: setup → content → review/schedule)
10. Campaign report page (metrics, funnel, AI summary, recipient list)
11. Netlify Scheduled Function: campaign scheduler (2x daily)

### Sprint 2 (Week 3–4.5): Automation Engine
1. Install `inngest`, `reactflow`
2. Database migration: automation_flows, automation_enrollments, automation_cooldowns tables
3. Inngest client setup + Next.js serve endpoint (`/api/inngest`)
4. Inngest flow executor function (step execution for all 6 step types)
5. Inngest trigger evaluator cron (10-minute evaluation cycle)
6. Exit condition checker (per-trigger-type exit logic)
7. Cooldown enforcement (24-hour global per-member check)
8. 4 pre-built automation templates: Welcome, Win-Back, Failed Payment Recovery, Churn Prevention
9. Automation CRUD API routes
10. Automation list page (cards + template gallery)
11. Automation flow builder page (ReactFlow visual editor + step config panel)

**Mid-point review after Sprint 2** — verify automation engine works end-to-end before building on it.

### Sprint 3 (Week 5–6): Lead Pipeline
1. Install `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
2. Database migration: leads, lead_activities tables
3. Lead CRUD API routes
4. Lead capture public endpoint (deduplication, rate limiting, honeypot, studio token validation)
5. Middleware update: whitelist `/api/leads/capture` and `/api/unsubscribe/*` from auth
6. AI lead scoring function + rules-based fallback
7. Cross-module: auto-convert leads when members created with matching email
8. Netlify Scheduled Function: lead scorer (every 4 hours)
9. Lead pipeline page (Kanban with @dnd-kit)
10. Lead detail page (activity timeline, quick actions, conversion panel)

### Sprint 4 (Week 7–8): Content Hub + SMS Stub + Polish
1. Database migration: content_posts, content_comments, content_likes tables
2. Content CRUD API routes (create, read, update, delete, like, comment)
3. Content hub page (feed view, filters, create button)
4. SMS provider abstraction layer (`SMSProvider` interface + `StubProvider`)
5. SMS fields in campaign builder + automation builder (UI only, stub backend)
6. Marketing overview dashboard page (metrics, funnel, scheduled campaigns, AI recommendations)
7. AI features: send time optimization, subject line suggestions, campaign performance summary, automation recommendations
8. GDPR deletion cascade for all Phase 2 tables
9. Integration testing: full campaign lifecycle, automation flow end-to-end, lead pipeline flow
10. Performance optimization: pagination on all list views, caching for AI-generated content

---

## 13. Observability

| What | How |
|---|---|
| Inngest function health | Inngest dashboard (built-in) — shows running functions, failures, retries |
| Campaign send failures | Per-recipient `status = 'failed'` in `campaign_recipients` + error detail in `email_send_log` |
| Automation failures | Enrollment `status = 'failed'` with error in `step_history` JSONB |
| Bounce rate monitoring | Denormalized `bounce_count` on `campaigns` table, surfaced in campaign report |
| Cron health | Netlify function logs + last-run timestamp stored in `settings` table |
| Failed automations alert | Command Center activity feed shows failed enrollments (high priority) |

---

## 14. Testing Strategy

### Unit Tests (Written alongside implementation)
- Campaign send logic: email preference filtering, batch chunking, retry/resume, hard bounce skip
- Automation step processor: each step type (email, wait, condition, sms, tag, update_field)
- Lead scoring algorithm: rules-based + AI fallback
- Unsubscribe token: generation, verification, expiry, replay idempotency
- SMS stub provider: logs correctly, returns expected results

### Integration Tests (Sprint 4)
- Full campaign lifecycle: create → schedule → cron picks up → send → track opens → report
- Automation flow: trigger fires → enroll → Inngest executes steps → exit condition → complete
- Lead pipeline: public capture → deduplicate → score → nurture → convert → auto-update lead

### E2E Tests (Sprint 4)
- Campaign builder wizard: fill form → AI generate copy → preview → send test → schedule
- Automation builder: select trigger → add steps via ReactFlow → set exit conditions → activate
- Lead Kanban: drag card between columns → verify status change + activity logged
- Unsubscribe flow: click link → confirm → verify preference updated → replay is no-op

---

## 15. Performance Considerations

- **Campaign sends:** Batch in chunks of 100 (Resend limit), 200ms delay between batches, re-check preferences per batch
- **Inngest concurrency:** Max 10 concurrent flow executions (prevents Resend rate limit issues)
- **Lead scoring:** Batch process max 100 leads per scheduled run, cache scores for 4 hours
- **Campaign metrics:** Denormalized on campaigns table, updated via Resend webhook (not computed on read)
- **Content feed:** Cursor-based pagination, 20 posts per page
- **Indexes:** All foreign keys, status + studio_id composites, email dedup index on leads

---

## 16. Security

- **Unsubscribe tokens:** HMAC-SHA256 signed, constant-time comparison, 30-day expiry, one-time use (idempotent replay)
- **Lead capture endpoint:** Rate-limited (10/min per IP via Netlify Edge), honeypot field (CSS-hidden, not display:none for accessibility), studio embed token validation
- **Email content:** Sanitize HTML with `isomorphic-dompurify` before storage, CSP headers on preview
- **SMS:** Validate phone numbers (E.164 format) before storage (validation only — no sending in Phase 2)
- **Campaign deletion:** Soft-delete sent campaigns (preserve metrics), hard-delete drafts only
- **Public endpoint whitelist:** Middleware updated to skip auth for `/api/leads/capture` and `/api/unsubscribe/*` only
- **Inngest webhook verification:** Inngest signing key verified on `/api/inngest` endpoint
- **AI subject lines:** System prompt prohibits deceptive/misleading subject generation (CAN-SPAM)
