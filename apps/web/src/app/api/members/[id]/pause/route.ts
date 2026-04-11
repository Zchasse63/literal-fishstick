import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

/**
 * POST /api/members/[id]/pause
 * Pause a member's membership with an optional resume date and reason.
 * Body: { resume_date?: string, reason?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient();
    const { id: memberId } = await params;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: authProfile } = await supabase
      .from("profiles")
      .select("studio_id, roles")
      .eq("id", user.id)
      .single();

    const studioId =
      authProfile?.studio_id ?? DEFAULT_STUDIO_ID;

    // Role check
    const roles: string[] = authProfile?.roles ?? [];
    if (!roles.some((r: string) => ["owner", "manager"].includes(r))) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { resume_date, reason } = body as {
      resume_date?: string;
      reason?: string;
    };

    // Validate resume_date if provided
    if (resume_date) {
      const parsed = new Date(resume_date);
      if (isNaN(parsed.getTime())) {
        return NextResponse.json(
          { error: "Invalid date format for resume_date" },
          { status: 400 }
        );
      }
    }

    // Fetch current member record
    const { data: member, error: memberError } = await supabase
      .from("members")
      .select("id, profile_id, membership_status, membership_tier")
      .eq("profile_id", memberId)
      .eq("studio_id", studioId)
      .maybeSingle();

    if (memberError || !member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // If already paused, return 409
    if (member.membership_status === "paused") {
      return NextResponse.json(
        { error: "Membership is already paused" },
        { status: 409 }
      );
    }

    // Update membership to paused. Schema has no `paused_at`/`pause_resume_date`
    // — those details are captured in the activity_log metadata below so that
    // the `unpause` endpoint can recover them from the latest audit entry.
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("members")
      .update({
        membership_status: "paused",
        updated_at: now,
      })
      .eq("id", member.id)
      .eq("studio_id", studioId);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    // Log activity
    await supabase.from("activity_log").insert({
      studio_id: studioId,
      actor_id: user.id,
      type: "membership_paused",
      subject_type: "profile",
      subject_id: memberId,
      metadata: {
        membership_tier: member.membership_tier,
        paused_at: now,
        resume_date: resume_date ?? null,
        reason: reason ?? null,
      },
    });

    return NextResponse.json({
      data: {
        member_id: memberId,
        membership_status: "paused",
        paused_at: now,
        resume_date: resume_date ?? null,
        reason: reason ?? null,
      },
    });
  } catch (err) {
    console.error("POST /api/members/[id]/pause error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
