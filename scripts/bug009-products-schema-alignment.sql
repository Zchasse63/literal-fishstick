-- BUG-009: Products CRUD schema alignment
-- Date: 2026-04-09
-- Related: specs/bugs/products-crud-schema-divergence.md
-- Tier: QA pipeline Tier 3.4 (Revenue: Products CRUD)
--
-- The products feature was built against an imagined schema that was never
-- migrated. The UI and the API each assumed different sets of columns that
-- did not exist. Zero products have ever been successfully created.
--
-- This migration adds the 3 intended-but-missing product columns and extends
-- the activity_log type enum to accept product events. After this migration,
-- combined with the code fix in the same tier, Products CRUD becomes usable.

-- =============================================================================
-- Part A: Add missing product columns
-- =============================================================================
-- compare_at_price: original price before sale, used for "was $X now $Y" display
-- barcode:          UPC/EAN identifier for in-store scanning
-- low_stock_threshold: alert threshold used by the "Low Stock" KPI card on
--                   /revenue/products (default 5 matches UI placeholder)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS compare_at_price INTEGER,
  ADD COLUMN IF NOT EXISTS barcode TEXT,
  ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER NOT NULL DEFAULT 5;

-- =============================================================================
-- Part B: Extend activity_log.type enum with product events
-- =============================================================================
-- /api/products POST/PUT/DELETE insert activity_log rows with
-- type='product_created'/'product_updated'/'product_deleted'. The current
-- check constraint does not include these, so every product-related log
-- insert fails. This unblocks the API routes without requiring a rename.
ALTER TABLE activity_log DROP CONSTRAINT activity_log_type_check;
ALTER TABLE activity_log ADD CONSTRAINT activity_log_type_check CHECK (type = ANY (ARRAY[
  'check_in'::text,
  'booking'::text,
  'cancellation'::text,
  'payment'::text,
  'failed_payment'::text,
  'membership_change'::text,
  'walk_in'::text,
  'new_member'::text,
  'refund'::text,
  'strike'::text,
  'clock_in'::text,
  'clock_out'::text,
  'product_created'::text,
  'product_updated'::text,
  'product_deleted'::text
]));
