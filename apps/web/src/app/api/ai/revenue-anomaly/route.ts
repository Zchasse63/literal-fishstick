import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
  detectRevenueAnomalies,
  RevenueAnomalyInput,
  RevenueAnomalyResult,
  RevenueWeek,
} from "@/lib/ai/revenue-anomaly";
import { requireRole } from "@/lib/auth/require-role";
import { rateLimit } from "@/lib/rate-limit";
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

const STUDIO_ID = DEFAULT_STUDIO_ID;
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours — shorter since revenue changes frequently

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Return the Monday (start of ISO week) for a given date as YYYY-MM-DD.
 */
function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getUTCDay();
  // Shift Sunday (0) to 7 so Monday is always the start
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

interface TransactionRow {
  amount: number;
  type: string;
  created_at: string;
}

interface MembershipEventRow {
  event_type: string;
  created_at: string;
}

/**
 * Aggregate transactions into weekly RevenueWeek buckets.
 */
function buildWeeklyBuckets(
  transactions: TransactionRow[],
  membershipEvents: MembershipEventRow[],
  weekStarts: string[]
): Map<string, RevenueWeek> {
  // Initialize buckets
  const buckets = new Map<string, RevenueWeek>();
  for (const ws of weekStarts) {
    buckets.set(ws, {
      week_start: ws,
      total_revenue: 0,
      transaction_count: 0,
      new_memberships: 0,
      cancellations: 0,
      drop_in_revenue: 0,
      membership_revenue: 0,
      credit_pack_revenue: 0,
    });
  }

  // Populate transaction data
  for (const tx of transactions) {
    const ws = getWeekStart(new Date(tx.created_at));
    const bucket = buckets.get(ws);
    if (!bucket) continue;

    bucket.total_revenue += tx.amount;
    bucket.transaction_count += 1;

    switch (tx.type) {
      case "drop_in":
      case "day_pass":
        bucket.drop_in_revenue += tx.amount;
        break;
      case "membership":
      case "membership_renewal":
        bucket.membership_revenue += tx.amount;
        break;
      case "credit_pack":
        bucket.credit_pack_revenue += tx.amount;
        break;
      default:
        // Other types (merch, gift card, etc.) count toward total but not a sub-category
        break;
    }
  }

  // Populate membership events
  for (const evt of membershipEvents) {
    const ws = getWeekStart(new Date(evt.created_at));
    const bucket = buckets.get(ws);
    if (!bucket) continue;

    if (evt.event_type === "created" || evt.event_type === "activated") {
      bucket.new_memberships += 1;
    } else if (
      evt.event_type === "cancelled" ||
      evt.event_type === "expired"
    ) {
      bucket.cancellations += 1;
    }
  }

  return buckets;
}

// ---------------------------------------------------------------------------
// GET — Detect revenue anomalies for the studio
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const auth = await requireRole(["owner", "manager"]);
    if (auth.error) return auth.error;
    const { user, supabase } = auth;

    // Rate limit: 20 requests per minute per user
    const rl = rateLimit(`ai:${user.id}`, 20, 60_000);
    if (!rl.success) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    // -----------------------------------------------------------------------
    // Check cache first
    // -----------------------------------------------------------------------

    const { data: cached } = await supabase
      .from("ai_cache")
      .select("data, generated_at, expires_at")
      .eq("studio_id", STUDIO_ID)
      .eq("cache_type", "revenue_anomaly")
      .gt("expires_at", new Date().toISOString())
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached?.data) {
      return NextResponse.json({
        ...(cached.data as RevenueAnomalyResult),
        cached: true,
        generated_at: cached.generated_at,
      });
    }

    // -----------------------------------------------------------------------
    // Calculate date ranges: current week + trailing 8 weeks (9 weeks total)
    // -----------------------------------------------------------------------

    const now = new Date();
    const currentWeekStart = getWeekStart(now);

    // Generate the 9 week-start dates (current + 8 trailing)
    const weekStarts: string[] = [];
    for (let i = 0; i < 9; i++) {
      const d = new Date(currentWeekStart);
      d.setUTCDate(d.getUTCDate() - i * 7);
      weekStarts.push(d.toISOString().slice(0, 10));
    }

    // Earliest date to query (start of the oldest week)
    const earliestDate = weekStarts[weekStarts.length - 1];

    // -----------------------------------------------------------------------
    // Query transactions for the 9-week window
    // -----------------------------------------------------------------------

    const { data: transactionsRaw, error: txError } = await supabase
      .from("transactions")
      .select("amount, type, created_at")
      .eq("studio_id", STUDIO_ID)
      .eq("status", "completed")
      .gte("created_at", earliestDate);

    if (txError) {
      console.error("Failed to fetch transactions:", txError);
      return NextResponse.json(
        { error: "Failed to fetch transaction data" },
        { status: 500 }
      );
    }

    // -----------------------------------------------------------------------
    // Query membership events (new signups / cancellations) for the window
    // -----------------------------------------------------------------------

    const { data: membershipEventsRaw, error: membershipError } = await supabase
      .from("membership_events")
      .select("event_type, created_at")
      .eq("studio_id", STUDIO_ID)
      .gte("created_at", earliestDate);

    if (membershipError) {
      // Non-fatal: membership_events table may not exist yet, proceed with empty
      console.warn(
        "Could not fetch membership events (table may not exist):",
        membershipError.message
      );
    }

    // -----------------------------------------------------------------------
    // Build weekly buckets
    // -----------------------------------------------------------------------

    const buckets = buildWeeklyBuckets(
      (transactionsRaw ?? []) as TransactionRow[],
      (membershipEventsRaw ?? []) as MembershipEventRow[],
      weekStarts
    );

    const currentWeek = buckets.get(currentWeekStart);
    if (!currentWeek) {
      return NextResponse.json(
        { error: "No data available for the current week" },
        { status: 404 }
      );
    }

    // Trailing 8 weeks ordered oldest to newest
    const trailing8Weeks: RevenueWeek[] = weekStarts
      .slice(1)
      .reverse()
      .map((ws) => buckets.get(ws)!)
      .filter(Boolean);

    if (trailing8Weeks.length === 0) {
      return NextResponse.json(
        { error: "Insufficient trailing data for anomaly detection" },
        { status: 404 }
      );
    }

    // -----------------------------------------------------------------------
    // Build input and analyze
    // -----------------------------------------------------------------------

    const input: RevenueAnomalyInput = {
      studio_id: STUDIO_ID,
      current_week: currentWeek,
      trailing_8_weeks: trailing8Weeks,
    };

    const result = await detectRevenueAnomalies(input);

    // -----------------------------------------------------------------------
    // Cache result (best-effort)
    // -----------------------------------------------------------------------

    const generatedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString();

    await supabase
      .from("ai_cache")
      .upsert(
        {
          studio_id: STUDIO_ID,
          cache_type: "revenue_anomaly",
          entity_id: STUDIO_ID, // studio-level analysis
          data: result as unknown as Record<string, unknown>,
          generated_at: generatedAt,
          expires_at: expiresAt,
        },
        { onConflict: "studio_id,cache_type,entity_id" }
      )
      .then(
        () => {
          /* success */
        },
        (err) => {
          console.error("Failed to cache revenue anomaly result:", err);
        }
      );

    return NextResponse.json({
      ...result,
      cached: false,
      generated_at: generatedAt,
    });
  } catch (err) {
    console.error("GET /api/ai/revenue-anomaly error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
