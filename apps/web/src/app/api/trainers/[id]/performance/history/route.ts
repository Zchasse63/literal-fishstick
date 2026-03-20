import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const ALLOWED_ROLES = ["owner", "manager", "trainer"];

/**
 * GET /api/trainers/[id]/performance/history
 *
 * Trainer metric snapshots over time for charting trends.
 * Params: id is the profile_id.
 * Query params: months_back (default 6)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient();
    const { id: profileId } = await params;

    // ─── Auth ──────────────────────────────────────────────────
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("studio_id, roles")
      .eq("id", user.id)
      .single();

    const studioId =
      profile?.studio_id ?? "11111111-1111-1111-1111-111111111111";
    const roles: string[] = profile?.roles ?? [];
    if (!roles.some((r: string) => ALLOWED_ROLES.includes(r))) {
      return NextResponse.json(
        { error: "Insufficient permissions." },
        { status: 403 }
      );
    }

    // ─── Query Params ──────────────────────────────────────────
    const { searchParams } = request.nextUrl;
    const monthsBack = parseInt(searchParams.get("months_back") ?? "6", 10);

    // ─── Resolve trainer.id from profile_id ──────────────────
    const { data: trainer, error: trainerError } = await supabase
      .from("trainers")
      .select("id")
      .eq("profile_id", profileId)
      .eq("studio_id", studioId)
      .single();

    if (trainerError || !trainer) {
      return NextResponse.json(
        { error: "Trainer not found" },
        { status: 404 }
      );
    }

    // ─── Fetch Snapshots ─────────────────────────────────────
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - monthsBack);
    const cutoffStr = cutoff.toISOString().split("T")[0];

    const { data: snapshots, error: snapshotsError } = await supabase
      .from("trainer_metric_snapshots")
      .select("*")
      .eq("trainer_id", trainer.id)
      .eq("studio_id", studioId)
      .gte("snapshot_date", cutoffStr)
      .order("snapshot_date", { ascending: true });

    if (snapshotsError) {
      console.error("Failed to fetch snapshots:", snapshotsError);
      return NextResponse.json(
        { error: snapshotsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: snapshots ?? [],
      trainer_id: profileId,
      months_back: monthsBack,
    });
  } catch (err) {
    console.error("GET /api/trainers/[id]/performance/history error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
