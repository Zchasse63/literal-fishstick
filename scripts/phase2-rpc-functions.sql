-- Phase 2 RPC Functions for Meridian
-- These are called by API routes and webhooks
--
-- ══════════════════════════════════════════════════════════════════
-- RLS DOCUMENTATION (LOW-020 / MED-007)
-- ══════════════════════════════════════════════════════════════════
-- Current state: Phase 2 RLS policies reference
--   current_setting('app.studio_id')::uuid
-- to restrict row access by studio. However, ALL server-side route
-- handlers and Inngest functions use a service-role Supabase client
-- that bypasses RLS entirely — they filter by studio_id manually.
--
-- This means the RLS policies are effectively only enforced for
-- direct client-side access (which does not exist yet in Phase 1-4).
--
-- Plan for Phase 5 (member-facing surfaces):
--   1. Rewrite RLS policies to use auth.uid() for member-facing tables.
--   2. For admin routes, either:
--      a. Call set_config('app.studio_id', ...) in middleware before queries, or
--      b. Use auth.uid() -> profiles -> studio_id lookup.
--   3. Add integration tests that verify RLS blocks cross-studio access.
-- ══════════════════════════════════════════════════════════════════

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
-- CONSOLIDATED: This function was previously duplicated as cleanup_phase2_member_data.
-- The canonical version is delete_member_phase2_data in phase2-migration.sql.
-- Drop the old alias if it exists, then delegate to the canonical function.
DROP FUNCTION IF EXISTS cleanup_phase2_member_data(UUID);

CREATE OR REPLACE FUNCTION cleanup_phase2_member_data(p_member_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delegate to the canonical GDPR deletion function
  PERFORM delete_member_phase2_data(p_member_id);
END;
$$;

COMMENT ON FUNCTION cleanup_phase2_member_data(UUID) IS
  'Legacy alias for delete_member_phase2_data. '
  'All GDPR Phase 2 cleanup logic is consolidated in delete_member_phase2_data (phase2-migration.sql).';
-- LOW-017: cleanup_phase2_member_data() is a legacy alias kept for backward
-- compatibility with any callers that reference the old name. It simply
-- delegates to delete_member_phase2_data(). This alias should be removed
-- in Phase 3 once all callers have been migrated to the canonical function.

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

-- ==========================================
-- GDPR: Full member data deletion (LOW-001)
-- Cascades through ALL Phase 1 tables for complete data erasure.
-- Called from admin panel "Delete Member" action.
-- ==========================================
CREATE OR REPLACE FUNCTION delete_member_all_data(p_member_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Phase 1 tables: order matters for FK constraints (children first)
  DELETE FROM member_strikes        WHERE member_id = p_member_id;
  DELETE FROM member_tags           WHERE member_id = p_member_id;
  DELETE FROM credit_packs          WHERE member_id = p_member_id;
  DELETE FROM bookings              WHERE member_id = p_member_id;
  DELETE FROM transactions          WHERE member_id = p_member_id;
  DELETE FROM waitlist_entries       WHERE member_id = p_member_id;
  DELETE FROM gift_cards            WHERE purchased_by_member_id = p_member_id;
  DELETE FROM automation_enrollments WHERE member_id = p_member_id;
  DELETE FROM automation_cooldowns   WHERE member_id = p_member_id;
  DELETE FROM ai_cache              WHERE entity_id = p_member_id::text;
  DELETE FROM ai_briefings          WHERE member_id = p_member_id;

  -- Phase 2 tables (delegate to the existing Phase 2 cleanup)
  PERFORM delete_member_phase2_data(p_member_id);

  -- member_360 enrichment data
  DELETE FROM member_360 WHERE profile_id = (
    SELECT profile_id FROM members WHERE id = p_member_id
  );

  -- Activity log references
  DELETE FROM activity_log WHERE metadata->>'member_id' = p_member_id::text;

  -- Finally, the member record itself
  DELETE FROM members WHERE id = p_member_id;

  -- Note: the `profiles` record is intentionally NOT deleted here because
  -- it may be shared with auth.users and other studio memberships.
  -- Profile cleanup should be handled separately if the user requests
  -- full account deletion across all studios.
END;
$$;

COMMENT ON FUNCTION delete_member_all_data(UUID) IS
  'GDPR right-to-erasure: cascading deletion of all member data across '
  'Phase 1 and Phase 2 tables. Does NOT delete the auth profile.';
