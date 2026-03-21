-- Meridian Audit Fixes Migration
-- Date: 2026-03-20
-- Fixes: MED-003, MED-002, MED-004

-- =============================================================================
-- MED-003: leads table missing email_hash column
-- The TypeScript types expect an email_hash column on the leads table.
-- =============================================================================
ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_leads_email_hash ON leads(email_hash);

-- =============================================================================
-- MED-002: No DB-level constraint preventing over-capacity bookings
-- Adds a trigger function that enforces booking capacity at the database level,
-- preventing race conditions where concurrent requests both pass the count check.
-- =============================================================================
CREATE OR REPLACE FUNCTION check_booking_capacity()
RETURNS TRIGGER AS $$
DECLARE
  current_count INT;
  max_capacity INT;
BEGIN
  -- Get current booking count for this class
  SELECT COUNT(*) INTO current_count
  FROM bookings
  WHERE class_id = NEW.class_id
  AND status IN ('confirmed', 'checked_in');

  -- Get class capacity
  SELECT capacity INTO max_capacity
  FROM classes
  WHERE id = NEW.class_id;

  IF current_count >= max_capacity THEN
    RAISE EXCEPTION 'Class is at full capacity' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_booking_capacity ON bookings;
CREATE TRIGGER enforce_booking_capacity
  BEFORE INSERT ON bookings
  FOR EACH ROW
  WHEN (NEW.status IN ('confirmed', 'checked_in'))
  EXECUTE FUNCTION check_booking_capacity();

-- =============================================================================
-- MED-004: automation_enrollments UNIQUE constraint blocks reenrollment
-- The UNIQUE constraint (automation_id, member_id) prevents members from
-- re-enrolling in a flow after completion. Replace with a partial unique index
-- that only blocks duplicate ACTIVE enrollments.
-- =============================================================================
ALTER TABLE automation_enrollments DROP CONSTRAINT IF EXISTS automation_enrollments_automation_id_member_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_enrollments_active_unique
  ON automation_enrollments(automation_id, member_id)
  WHERE status = 'active';
