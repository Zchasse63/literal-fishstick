import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

const STUDIO_ID = DEFAULT_STUDIO_ID;
const MAX_LEADS_PER_RUN = 100;

/**
 * Lead scoring weights (rules-based)
 */
const SOURCE_WEIGHTS: Record<string, number> = {
  referral: 20,
  corporate: 15,
  event: 15,
  walk_in: 10,
  website: 5,
  instagram: 5,
  google: 5,
  facebook: 5,
  other: 0,
};

const STATUS_BONUS: Record<string, number> = {
  contacted: 10,
  trial: 20,
};

/**
 * POST /api/leads/score
 * Batch recalculate lead scores using rules-based scoring.
 * Designed to be called as a scheduled/cron function.
 * Processes max 100 leads per run (oldest scored first).
 *
 * In production, trigger this via Netlify scheduled functions or cron.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();

    // Auth check — only allow admin/manager or cron calls
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // Allow cron secret bypass for scheduled functions
    const isCronCall = cronSecret && authHeader === `Bearer ${cronSecret}`;

    if (!isCronCall) {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("roles")
        .eq("id", user.id)
        .single();

      const roles: string[] = profile?.roles ?? [];
      if (!roles.some((r: string) => ["admin", "manager"].includes(r))) {
        return NextResponse.json(
          { error: "Insufficient permissions. Admin or manager role required." },
          { status: 403 }
        );
      }
    }

    // Fetch leads to score — oldest scored_at first, then by created_at
    const { data: leads, error: leadsError } = await supabase
      .from("leads")
      .select("id, source, phone, email, status")
      .eq("studio_id", STUDIO_ID)
      .neq("status", "converted")
      .neq("status", "lost")
      .order("scored_at", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: true })
      .limit(MAX_LEADS_PER_RUN);

    if (leadsError) {
      return NextResponse.json(
        { error: leadsError.message },
        { status: 500 }
      );
    }

    if (!leads || leads.length === 0) {
      return NextResponse.json({ data: { scored: 0, message: "No leads to score" } });
    }

    const leadIds = leads.map((l: { id: string }) => l.id);

    // Fetch recent activities for all leads in batch (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: recentActivities } = await supabase
      .from("lead_activities")
      .select("lead_id")
      .in("lead_id", leadIds)
      .gte("created_at", sevenDaysAgo.toISOString());

    // Count activities per lead
    const activityCounts: Record<string, number> = {};
    for (const activity of recentActivities ?? []) {
      activityCounts[activity.lead_id] = (activityCounts[activity.lead_id] ?? 0) + 1;
    }

    // Calculate scores and batch update
    let scored = 0;
    const now = new Date().toISOString();

    for (const lead of leads) {
      let score = 0;

      // Source weight
      score += SOURCE_WEIGHTS[lead.source] ?? 0;

      // Has phone: +10
      if (lead.phone) {
        score += 10;
      }

      // Has email: +10 (should always be true)
      if (lead.email) {
        score += 10;
      }

      // Recent activity: +5 per activity in last 7 days (max +20)
      const activityCount = activityCounts[lead.id] ?? 0;
      score += Math.min(activityCount * 5, 20);

      // Status bonus
      score += STATUS_BONUS[lead.status] ?? 0;

      // Clamp score to 0-100
      score = Math.max(0, Math.min(100, score));

      const { error: updateError } = await supabase
        .from("leads")
        .update({
          score,
          scored_at: now,
          updated_at: now,
        })
        .eq("id", lead.id)
        .eq("studio_id", STUDIO_ID);

      if (!updateError) {
        scored++;
      }
    }

    return NextResponse.json({
      data: {
        scored,
        total_processed: leads.length,
        timestamp: now,
      },
    });
  } catch (err) {
    console.error("POST /api/leads/score error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
