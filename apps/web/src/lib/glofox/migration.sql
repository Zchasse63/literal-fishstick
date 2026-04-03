-- ============================================================================
-- Glofox Data Sync — Schema Migration
-- ============================================================================
-- Run against Supabase Postgres to add Glofox sync support.
-- All statements are idempotent (IF NOT EXISTS / IF NOT EXISTS).
-- ============================================================================

-- ─── glofox_id columns on existing tables ─────────────────────────────────

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS glofox_id TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS glofox_id TEXT;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS glofox_id TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS glofox_id TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS glofox_id TEXT;
ALTER TABLE credit_packs ADD COLUMN IF NOT EXISTS glofox_id TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS glofox_id TEXT;
ALTER TABLE membership_plans ADD COLUMN IF NOT EXISTS glofox_id TEXT;

-- ─── glofox_synced_at timestamps ──────────────────────────────────────────

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS glofox_synced_at TIMESTAMPTZ;
ALTER TABLE members ADD COLUMN IF NOT EXISTS glofox_synced_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS glofox_synced_at TIMESTAMPTZ;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS glofox_synced_at TIMESTAMPTZ;

-- ─── Unique indexes for upsert operations ─────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_glofox_id
  ON profiles(glofox_id, studio_id) WHERE glofox_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_members_glofox_id
  ON members(glofox_id, studio_id) WHERE glofox_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_classes_glofox_id
  ON classes(glofox_id, studio_id) WHERE glofox_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_glofox_id
  ON bookings(glofox_id, studio_id) WHERE glofox_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_glofox_id
  ON transactions(glofox_id, studio_id) WHERE glofox_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_packs_glofox_id
  ON credit_packs(glofox_id, studio_id) WHERE glofox_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_glofox_id
  ON leads(glofox_id, studio_id) WHERE glofox_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_membership_plans_glofox_id
  ON membership_plans(glofox_id, studio_id) WHERE glofox_id IS NOT NULL;

-- ─── Enrichment columns from Glofox API (not available via CSV) ───────────

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address_street TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address_city TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address_state TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address_postal_code TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address_country TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_opt_in BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sms_opt_in BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_opt_in BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS access_barcode TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS parent_profile_id UUID REFERENCES profiles(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lead_source TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS marketing_source TEXT;

ALTER TABLE members ADD COLUMN IF NOT EXISTS plan_code TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS plan_price INTEGER;
ALTER TABLE members ADD COLUMN IF NOT EXISTS plan_upfront_fee INTEGER;
ALTER TABLE members ADD COLUMN IF NOT EXISTS glofox_subscription_id TEXT;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS attended BOOLEAN DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_late_cancellation BOOLEAN DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_from_waitlist BOOLEAN DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS glofox_event_name TEXT;

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS sold_by_profile_id UUID REFERENCES profiles(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS glofox_provider_id TEXT;

-- ─── Sync state tracking table ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS glofox_sync_state (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  studio_id UUID NOT NULL REFERENCES studios(id),
  entity_type TEXT NOT NULL,
  last_synced_at TIMESTAMPTZ,
  last_full_sync_at TIMESTAMPTZ,
  records_synced INTEGER DEFAULT 0,
  status TEXT DEFAULT 'idle' CHECK (status IN ('idle', 'syncing', 'error', 'completed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(studio_id, entity_type)
);

-- RLS policy: studio members can read, owners/managers can write
ALTER TABLE glofox_sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "glofox_sync_state_select"
  ON glofox_sync_state FOR SELECT
  USING (studio_id IN (
    SELECT studio_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY IF NOT EXISTS "glofox_sync_state_all"
  ON glofox_sync_state FOR ALL
  USING (studio_id IN (
    SELECT studio_id FROM profiles
    WHERE id = auth.uid()
    AND (roles @> ARRAY['owner'] OR roles @> ARRAY['admin'] OR roles @> ARRAY['manager'])
  ));

-- ─── Sync conflict log ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS glofox_sync_conflicts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  studio_id UUID NOT NULL REFERENCES studios(id),
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  glofox_id TEXT,
  conflict_type TEXT NOT NULL,
  glofox_data JSONB,
  meridian_data JSONB,
  resolution TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE glofox_sync_conflicts ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "glofox_sync_conflicts_select"
  ON glofox_sync_conflicts FOR SELECT
  USING (studio_id IN (
    SELECT studio_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY IF NOT EXISTS "glofox_sync_conflicts_all"
  ON glofox_sync_conflicts FOR ALL
  USING (studio_id IN (
    SELECT studio_id FROM profiles
    WHERE id = auth.uid()
    AND (roles @> ARRAY['owner'] OR roles @> ARRAY['admin'] OR roles @> ARRAY['manager'])
  ));
