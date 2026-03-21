/**
 * Simple in-memory rate limiter.
 *
 * Suitable for single-instance deployments. For multi-instance / serverless,
 * replace with a Redis-backed implementation.
 *
 * Usage:
 *   const { success, remaining } = rateLimit(`ai:${userId}`, 20, 60_000);
 *   if (!success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
 */

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// Periodic cleanup to prevent unbounded memory growth
const CLEANUP_INTERVAL = 60_000; // 1 minute
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(key);
    }
  }
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { success: boolean; remaining: number } {
  cleanup();

  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1 };
  }

  if (entry.count >= limit) {
    return { success: false, remaining: 0 };
  }

  entry.count++;
  return { success: true, remaining: limit - entry.count };
}
