-- Phase 2 RPC Functions for Meridian
-- These are called by API routes and webhooks

-- ==========================================
-- Increment campaign metric (called by Resend webhook)
-- ==========================================
CREATE OR REPLACE FUNCTION increment_campaign_metric(
  p_campaign_id UUID,
  p_metric TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE format(
    'UPDATE campaigns SET %I = %I + 1, updated_at = NOW() WHERE id = $1',
    p_metric, p_metric
  ) USING p_campaign_id;
END;
$$;

-- ==========================================
-- GDPR: Clean up Phase 2 member data on deletion
-- ==========================================
CREATE OR REPLACE FUNCTION cleanup_phase2_member_data(p_member_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete campaign recipient records
  DELETE FROM campaign_recipients WHERE member_id = p_member_id;

  -- Exit and delete automation enrollments
  UPDATE automation_enrollments
  SET status = 'exited', exit_reason = 'member_deleted', exited_at = NOW()
  WHERE member_id = p_member_id AND status IN ('active', 'paused');

  DELETE FROM automation_enrollments WHERE member_id = p_member_id;

  -- Delete automation cooldowns
  DELETE FROM automation_cooldowns WHERE member_id = p_member_id;

  -- Email preferences cascade via ON DELETE CASCADE

  -- Anonymize lead activities performed by this member
  UPDATE lead_activities SET performed_by = NULL WHERE performed_by = p_member_id;

  -- Anonymize content (reassign to deleted-user placeholder or delete)
  DELETE FROM content_likes WHERE author_id = p_member_id;
  DELETE FROM content_comments WHERE author_id = p_member_id;
  UPDATE content_posts SET author_id = '00000000-0000-0000-0000-000000000000'
  WHERE author_id = p_member_id; -- Reassign to "Deleted User" placeholder

  -- If member was a lead, anonymize
  UPDATE leads SET
    first_name = '[Deleted]',
    last_name = '',
    email = NULL,
    phone = NULL,
    notes = NULL
  WHERE converted_member_id = p_member_id;
END;
$$;

-- ==========================================
-- Calculate lead score (rules-based, called by scheduled function)
-- ==========================================
CREATE OR REPLACE FUNCTION calculate_lead_score(p_lead_id UUID)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  v_score INT := 0;
  v_lead RECORD;
  v_activity_count_7d INT;
  v_activity_count_30d INT;
BEGIN
  SELECT * INTO v_lead FROM leads WHERE id = p_lead_id;

  IF NOT FOUND THEN RETURN 0; END IF;

  -- Source weight
  v_score := v_score + CASE v_lead.source
    WHEN 'referral' THEN 20
    WHEN 'corporate' THEN 15
    WHEN 'event' THEN 15
    WHEN 'walk_in' THEN 10
    WHEN 'website' THEN 5
    WHEN 'instagram' THEN 5
    WHEN 'google' THEN 5
    WHEN 'facebook' THEN 5
    ELSE 0
  END;

  -- Contact info completeness
  IF v_lead.email IS NOT NULL THEN v_score := v_score + 10; END IF;
  IF v_lead.phone IS NOT NULL THEN v_score := v_score + 10; END IF;

  -- Activity count (last 7 days)
  SELECT COUNT(*) INTO v_activity_count_7d
  FROM lead_activities
  WHERE lead_id = p_lead_id AND created_at >= NOW() - INTERVAL '7 days';

  v_score := v_score + LEAST(v_activity_count_7d * 5, 20);

  -- Activity count (last 30 days)
  SELECT COUNT(*) INTO v_activity_count_30d
  FROM lead_activities
  WHERE lead_id = p_lead_id AND created_at >= NOW() - INTERVAL '30 days';

  v_score := v_score + LEAST(v_activity_count_30d * 2, 10);

  -- Status bonus
  v_score := v_score + CASE v_lead.status
    WHEN 'contacted' THEN 10
    WHEN 'trial' THEN 20
    ELSE 0
  END;

  -- Clamp to 0-100
  v_score := GREATEST(0, LEAST(100, v_score));

  -- Update the lead
  UPDATE leads SET score = v_score, updated_at = NOW() WHERE id = p_lead_id;

  RETURN v_score;
END;
$$;
