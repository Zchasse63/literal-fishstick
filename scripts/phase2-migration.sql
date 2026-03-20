-- ============================================================================
-- Meridian Phase 2: Marketing & Engagement — Database Migration
-- ============================================================================
-- Version: 1.0
-- Date: 2026-03-20
-- Description: Creates all Phase 2 tables, indexes, RLS policies, and
--              modifications to existing tables for the Marketing & Engagement
--              module (campaigns, automations, leads, content hub, email prefs).
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. NEW TABLES
-- ============================================================================

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

  steps JSONB NOT NULL DEFAULT '[]',
  -- Array of steps:
  -- { "type": "email", "template_id": "...", "subject": "...", "body_html": "...", "delay_minutes": 0 }
  -- { "type": "wait", "delay_minutes": 2880 }
  -- { "type": "condition", "field": "email_opened", "check_step_index": 0, "true_branch": 3, "false_branch": 5 }
  -- { "type": "sms", "body": "...", "delay_minutes": 0 }
  -- { "type": "tag", "action": "add", "tag": "re-engaged" }
  -- { "type": "update_field", "field": "status", "value": "at_risk" }

  -- Exit conditions: auto-exit members when trigger condition resolves
  exit_conditions JSONB DEFAULT '{}',

  -- Versioning: incremented on every edit while flow is active
  version INT NOT NULL DEFAULT 1,

  is_active BOOLEAN DEFAULT FALSE,

  -- Re-enrollment policy
  allow_reenrollment BOOLEAN DEFAULT FALSE,
  reenrollment_cooldown_days INT DEFAULT 365,

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

  -- Idempotency: prevents double-processing
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
  source_detail TEXT,

  -- Scoring
  score INT DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  score_factors JSONB DEFAULT '{}',

  -- Conversion
  converted_member_id UUID REFERENCES profiles(id),
  converted_at TIMESTAMPTZ,

  -- Assignment
  assigned_to UUID REFERENCES profiles(id),

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
  is_approved BOOLEAN DEFAULT TRUE,
  moderated_by UUID REFERENCES profiles(id),
  moderated_at TIMESTAMPTZ,

  -- Engagement
  like_count INT DEFAULT 0,
  comment_count INT DEFAULT 0,

  -- Targeting
  visible_to TEXT[] DEFAULT '{all}',

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


-- ============================================================================
-- 2. INDEXES
-- ============================================================================

-- Campaigns
CREATE INDEX idx_campaigns_studio_status ON campaigns(studio_id, status);
CREATE INDEX idx_campaigns_scheduled ON campaigns(scheduled_at) WHERE status = 'scheduled';

-- Campaign Recipients
CREATE INDEX idx_campaign_recipients_campaign ON campaign_recipients(campaign_id);
CREATE INDEX idx_campaign_recipients_member ON campaign_recipients(member_id);
CREATE INDEX idx_campaign_recipients_status ON campaign_recipients(campaign_id, status);

-- Automation Flows
CREATE INDEX idx_automation_flows_studio ON automation_flows(studio_id);

-- Automation Enrollments
CREATE INDEX idx_automation_enrollments_member ON automation_enrollments(member_id);
CREATE INDEX idx_automation_enrollments_status ON automation_enrollments(automation_id, status);

-- Leads
CREATE INDEX idx_leads_studio_status ON leads(studio_id, status);
CREATE INDEX idx_leads_source ON leads(studio_id, source);
CREATE INDEX idx_leads_score ON leads(studio_id, score DESC);
CREATE INDEX idx_leads_follow_up ON leads(next_follow_up_at) WHERE status NOT IN ('converted', 'lost');
CREATE INDEX idx_leads_email ON leads(studio_id, email);

-- Lead Activities
CREATE INDEX idx_lead_activities_lead ON lead_activities(lead_id);

-- Content
CREATE INDEX idx_content_posts_studio ON content_posts(studio_id, is_published, created_at DESC);
CREATE INDEX idx_content_comments_post ON content_comments(post_id);

-- Email Preferences
CREATE INDEX idx_email_prefs_member ON email_preferences(member_id, studio_id);

-- Automation Cooldowns
CREATE INDEX idx_cooldowns_member ON automation_cooldowns(member_id, studio_id);


-- ============================================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all Phase 2 tables
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_cooldowns ENABLE ROW LEVEL SECURITY;

-- Studio isolation policies (using app.studio_id setting)
-- Note: Inngest/cron functions use service-role client that bypasses RLS
-- and must explicitly filter by studio_id in their queries.

CREATE POLICY "campaigns_studio_isolation" ON campaigns
  FOR ALL USING (studio_id = current_setting('app.studio_id')::uuid);

CREATE POLICY "campaign_recipients_studio_isolation" ON campaign_recipients
  FOR ALL USING (studio_id = current_setting('app.studio_id')::uuid);

CREATE POLICY "automation_flows_studio_isolation" ON automation_flows
  FOR ALL USING (studio_id = current_setting('app.studio_id')::uuid);

CREATE POLICY "automation_enrollments_studio_isolation" ON automation_enrollments
  FOR ALL USING (studio_id = current_setting('app.studio_id')::uuid);

CREATE POLICY "leads_studio_isolation" ON leads
  FOR ALL USING (studio_id = current_setting('app.studio_id')::uuid);

CREATE POLICY "lead_activities_studio_isolation" ON lead_activities
  FOR ALL USING (studio_id = current_setting('app.studio_id')::uuid);

CREATE POLICY "content_posts_studio_isolation" ON content_posts
  FOR ALL USING (studio_id = current_setting('app.studio_id')::uuid);

CREATE POLICY "content_comments_studio_isolation" ON content_comments
  FOR ALL USING (studio_id = current_setting('app.studio_id')::uuid);

CREATE POLICY "content_likes_studio_isolation" ON content_likes
  FOR ALL USING (studio_id = current_setting('app.studio_id')::uuid);

CREATE POLICY "email_preferences_studio_isolation" ON email_preferences
  FOR ALL USING (studio_id = current_setting('app.studio_id')::uuid);

CREATE POLICY "automation_cooldowns_studio_isolation" ON automation_cooldowns
  FOR ALL USING (studio_id = current_setting('app.studio_id')::uuid);


-- ============================================================================
-- 4. EXISTING TABLE MODIFICATIONS
-- ============================================================================

-- Add campaign_recipient_id FK to email_send_log for linking sends to campaigns
ALTER TABLE email_send_log ADD COLUMN IF NOT EXISTS campaign_recipient_id UUID REFERENCES campaign_recipients(id);

-- Add marketing source tracking to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS acquisition_source TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS acquisition_campaign_id UUID;
-- Note: no FK to campaigns to avoid bidirectional dependency.
-- Campaign ID stored as UUID, validated at API layer.

-- Add timezone to profiles (needed for birthday automation trigger)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York';


-- ============================================================================
-- 5. GDPR DATA DELETION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION delete_member_phase2_data(p_member_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete campaign recipient records
  DELETE FROM campaign_recipients WHERE member_id = p_member_id;

  -- Delete automation enrollments
  DELETE FROM automation_enrollments WHERE member_id = p_member_id;

  -- Delete automation cooldowns (also covered by ON DELETE CASCADE, but explicit for clarity)
  DELETE FROM automation_cooldowns WHERE member_id = p_member_id;

  -- Delete email preferences (also covered by ON DELETE CASCADE, but explicit for clarity)
  DELETE FROM email_preferences WHERE member_id = p_member_id;

  -- Anonymize lead activities performed by this member (preserve timeline, remove PII link)
  UPDATE lead_activities SET performed_by = NULL WHERE performed_by = p_member_id;

  -- Anonymize content posts (preserve content for community, remove author link)
  -- Studio policy may choose to delete instead — this default preserves content
  UPDATE content_posts SET author_id = NULL WHERE author_id = p_member_id;

  -- Delete content comments by this member
  DELETE FROM content_comments WHERE author_id = p_member_id;

  -- Delete content likes by this member
  DELETE FROM content_likes WHERE author_id = p_member_id;

  -- Update leads that converted to this member (preserve lead record, clear member link)
  UPDATE leads SET converted_member_id = NULL WHERE converted_member_id = p_member_id;

  -- Update leads assigned to this member (if they were staff)
  UPDATE leads SET assigned_to = NULL WHERE assigned_to = p_member_id;
END;
$$;

COMMENT ON FUNCTION delete_member_phase2_data(UUID) IS
  'GDPR cleanup: removes or anonymizes all Phase 2 data for a deleted member. '
  'Called as part of the member deletion flow. Tables with ON DELETE CASCADE '
  '(email_preferences, automation_cooldowns) are handled automatically but '
  'included here for explicitness. Content posts are anonymized by default; '
  'studios may override to delete.';


-- ============================================================================
-- 6. UPDATED_AT TRIGGERS
-- ============================================================================

-- Reusable trigger function (may already exist from Phase 1)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_automation_flows_updated_at
  BEFORE UPDATE ON automation_flows
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_content_posts_updated_at
  BEFORE UPDATE ON content_posts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_email_preferences_updated_at
  BEFORE UPDATE ON email_preferences
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


COMMIT;
