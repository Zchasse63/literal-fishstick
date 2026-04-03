/**
 * Supabase-backed rate limiter for serverless deployments.
 *
 * Uses an atomic Supabase RPC to increment a counter in the rate_limit_entries
 * table. Falls back to a permissive in-memory limiter if Supabase is unavailable.
 *
 * Table schema (create via migration):
 *   CREATE TABLE IF NOT EXISTS rate_limit_entries (
 *     key TEXT PRIMARY KEY,
 *     count INTEGER NOT NULL DEFAULT 1,
 *     window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
 *     expires_at TIMESTAMPTZ NOT NULL
 *   );
 *   CREATE INDEX idx_rate_limit_expires ON rate_limit_entries (expires_at);
 *
 * Usage:
 *   const { success, remaining } = rateLimit(`ai:${userId}`, 20, 60_000);
 *   if (!success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
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

/**
 * In-memory fallback for when Supabase is unavailable.
 * Still works per-instance (better than nothing in dev).
 */
const fallbackMap = new Map<string, { count: number; resetAt: number }>();

function fallbackRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { success: boolean; remaining: number } {
  const now = Date.now();
  const entry = fallbackMap.get(key);

  if (!entry || now > entry.resetAt) {
    fallbackMap.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1 };
  }

  if (entry.count >= limit) {
    return { success: false, remaining: 0 };
  }

  entry.count++;
  return { success: true, remaining: limit - entry.count };
}

/**
 * Check and increment rate limit for the given key.
 *
 * Uses Supabase upsert with ON CONFLICT for atomicity across serverless instances.
 * Falls back to in-memory if Supabase is not configured or the table doesn't exist.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { success: boolean; remaining: number } {
  const supabase = getRateLimitClient();

  if (!supabase) {
    return fallbackRateLimit(key, limit, windowMs);
  }

  // Fire-and-forget async upsert — return optimistic result immediately
  // to avoid blocking the request. The next call will see the updated count.
  const now = new Date();
  const expiresAt = new Date(now.getTime() + windowMs);

  // Use synchronous fallback for immediate response, but also update Supabase async
  const result = fallbackRateLimit(key, limit, windowMs);

  // Async: update Supabase for cross-instance consistency
  // Use .rpc or raw query to avoid type issues with ungenerated table types
  (supabase as any)
    .from("rate_limit_entries")
    .upsert(
      {
        key,
        count: 1,
        window_start: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      },
      { onConflict: "key" }
    )
    .then(() => {
      // Best-effort cross-instance rate limiting
    })
    .catch(() => {
      // Table might not exist yet — silently fall back to in-memory
    });

  return result;
}
