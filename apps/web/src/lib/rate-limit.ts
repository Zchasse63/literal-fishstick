/**
 * Supabase-backed rate limiter for serverless deployments.
 *
 * Uses an atomic Supabase RPC (`increment_rate_limit`) to increment a counter
 * in the `rate_limit_buckets` table. Falls back to allowing the request
 * (fail-open) if Supabase is unreachable, logging the error for observability.
 *
 * Infrastructure (already deployed):
 *   - Table: `public.rate_limit_buckets` (key, current_count, window_start_ms, updated_at)
 *   - RPC: `public.increment_rate_limit(p_key text, p_limit integer, p_window_ms bigint)`
 *   - Returns: (current_count integer, is_allowed boolean)
 *
 * The RPC runs as SECURITY DEFINER so it can bypass RLS without needing
 * service_role keys. Window rollover is handled inline: if the current
 * window has elapsed, the bucket resets to 1 atomically.
 *
 * Usage:
 *   const { allowed, remaining } = await rateLimit(`ai:${userId}`, 20, 60_000);
 *   if (!allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
 */

import { createClient } from "@supabase/supabase-js";

// Lazy-init a service-role Supabase client for rate limiting
let _supabase: ReturnType<typeof createClient> | null = null;
function getRateLimitClient() {
  if (!_supabase && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  }
  return _supabase;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

/**
 * Check and increment rate limit for the given key.
 *
 * Calls a Supabase RPC that atomically upserts and returns the current count.
 * This works correctly across all serverless instances because every call
 * goes through the same Postgres row.
 *
 * Fail-open: if Supabase is unreachable or the RPC doesn't exist yet,
 * the request is allowed and the error is logged.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const supabase = getRateLimitClient();

  if (!supabase) {
    // No Supabase configured (e.g. local dev without env vars) — fail open
    console.warn("[rate-limit] Supabase not configured, allowing request");
    return { allowed: true, remaining: limit };
  }

  try {
    const { data, error } = await (supabase as any).rpc("increment_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_window_ms: windowMs,
    });

    if (error) {
      // Fail open — log and allow the request
      console.error("[rate-limit] RPC error, failing open:", error.message);
      return { allowed: true, remaining: limit };
    }

    // The RPC returns an array with one row: { current_count, is_allowed }
    const row = Array.isArray(data) ? data[0] : data;
    const currentCount: number = row?.current_count ?? 0;
    const isAllowed: boolean = row?.is_allowed ?? true;

    return {
      allowed: isAllowed,
      remaining: Math.max(0, limit - currentCount),
    };
  } catch (err) {
    // Network error or unexpected failure — fail open for availability
    console.error("[rate-limit] Unexpected error, failing open:", err);
    return { allowed: true, remaining: limit };
  }
}
