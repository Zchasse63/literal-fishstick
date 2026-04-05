-- Migration: Create execute_readonly_sql RPC function
--
-- Used by the AI search feature (POST /api/ai/search) to run LLM-generated
-- SQL queries safely. The function enforces:
--   1. READ ONLY transaction (no INSERT/UPDATE/DELETE/DROP/etc.)
--   2. 5-second statement timeout to prevent runaway queries
--   3. studio_id presence validation to prevent cross-tenant data access
--
-- The function accepts a SQL string and returns the result as JSONB rows.
-- It should be invoked via supabase.rpc('execute_readonly_sql', { query_text: sql })

CREATE OR REPLACE FUNCTION execute_readonly_sql(query_text TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
  lower_query TEXT;
BEGIN
  -- ── 1. Basic input validation ──────────────────────────────
  IF query_text IS NULL OR trim(query_text) = '' THEN
    RAISE EXCEPTION 'query_text must be a non-empty string';
  END IF;

  lower_query := lower(trim(query_text));

  -- ── 2. Reject obviously dangerous statements ───────────────
  -- Belt-and-suspenders: the READ ONLY transaction will also block writes,
  -- but we reject early for clearer error messages.
  IF lower_query ~ '^\s*(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy)' THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;

  -- ── 3. Validate studio_id presence ─────────────────────────
  -- Every query MUST reference studio_id to enforce tenant isolation.
  IF position('studio_id' IN lower_query) = 0 THEN
    RAISE EXCEPTION 'Query must include a studio_id filter for tenant isolation';
  END IF;

  -- ── 4. Set session-level safety guardrails ─────────────────
  -- These are LOCAL so they only apply within this transaction.
  SET LOCAL statement_timeout = '5s';
  SET TRANSACTION READ ONLY;

  -- ── 5. Execute and return as JSONB ─────────────────────────
  EXECUTE 'SELECT jsonb_agg(row_to_json(t)) FROM (' || query_text || ') t'
  INTO result;

  -- Return empty array instead of null when no rows match
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- Also create the rate_limit_entries table and increment_rate_limit RPC
-- referenced by the rate limiter (HIGH-002).

CREATE TABLE IF NOT EXISTS rate_limit_entries (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_expires ON rate_limit_entries (expires_at);

CREATE OR REPLACE FUNCTION increment_rate_limit(
  p_key TEXT,
  p_limit INTEGER,
  p_window_ms INTEGER
)
RETURNS TABLE(current_count INTEGER, is_allowed BOOLEAN)
LANGUAGE plpgsql
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_expires TIMESTAMPTZ := v_now + (p_window_ms || ' milliseconds')::interval;
  v_count INTEGER;
BEGIN
  INSERT INTO rate_limit_entries (key, count, window_start, expires_at)
  VALUES (p_key, 1, v_now, v_expires)
  ON CONFLICT (key) DO UPDATE SET
    count = CASE
      WHEN rate_limit_entries.expires_at < v_now THEN 1
      ELSE rate_limit_entries.count + 1
    END,
    window_start = CASE
      WHEN rate_limit_entries.expires_at < v_now THEN v_now
      ELSE rate_limit_entries.window_start
    END,
    expires_at = CASE
      WHEN rate_limit_entries.expires_at < v_now THEN v_expires
      ELSE rate_limit_entries.expires_at
    END
  RETURNING rate_limit_entries.count INTO v_count;

  current_count := v_count;
  is_allowed := v_count <= p_limit;
  RETURN NEXT;
END;
$$;
