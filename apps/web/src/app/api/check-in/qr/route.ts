import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

/**
 * POST /api/check-in/qr
 * Validate a QR code token and check in the member.
 * Body: { member_id, token, class_id? }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();

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

    const body = await request.json();
    const { member_id, token, class_id } = body;

    if (!member_id || !token) {
      return NextResponse.json(
        { error: "member_id and token are required" },
        { status: 400 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("studio_id, roles")
      .eq("id", user.id)
      .single();

    const studioId =
      profile?.studio_id ?? DEFAULT_STUDIO_ID;

    // Role check
    const roles: string[] = profile?.roles ?? [];
    if (!roles.some((r: string) => ["owner", "manager"].includes(r))) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    // Validate the token
    const { data: tokenRecord, error: tokenError } = await supabase
      .from("check_in_tokens")
      .select("*")
      .eq("token", token)
      .eq("member_id", member_id)
      .eq("studio_id", studioId)
      .single();

    if (tokenError || !tokenRecord) {
      return NextResponse.json(
        { error: "Invalid check-in code" },
        { status: 400 }
      );
    }

    // Check if token is expired
    if (new Date(tokenRecord.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "Check-in code has expired" },
        { status: 400 }
      );
    }

    // Check if token was already used
    if (tokenRecord.used_at) {
      return NextResponse.json(
        { error: "Check-in code has already been used" },
        { status: 400 }
      );
    }

    // Find the member's booking for the current or next class
    const now = new Date().toISOString();
    let bookingQuery = supabase
      .from("bookings")
      .select(
        "*, classes(id, name, start_time, end_time, trainer_id)"
      )
      .eq("member_id", member_id)
      .eq("studio_id", studioId)
      .eq("status", "confirmed");

    if (class_id) {
      // Check in for a specific class
      bookingQuery = bookingQuery.eq("class_id", class_id);
    } else {
      // Find the closest upcoming class (within 2 hours before and after now)
      const twoHoursAgo = new Date(
        Date.now() - 2 * 60 * 60 * 1000
      ).toISOString();
      const twoHoursAhead = new Date(
        Date.now() + 2 * 60 * 60 * 1000
      ).toISOString();

      bookingQuery = bookingQuery
        .gte("classes.start_time", twoHoursAgo)
        .lte("classes.start_time", twoHoursAhead);
    }

    const { data: bookings, error: bookingError } = await bookingQuery
      .order("created_at", { ascending: true })
      .limit(1);

    if (bookingError || !bookings || bookings.length === 0) {
      return NextResponse.json(
        {
          error:
            "No active booking found for this member. Make sure they have a confirmed booking for a current or upcoming class.",
        },
        { status: 404 }
      );
    }

    const booking = bookings[0];

    // Check if already checked in
    if (booking.status === "checked_in") {
      return NextResponse.json(
        { error: "Member is already checked in" },
        { status: 400 }
      );
    }

    // Update booking status to checked_in
    const checkedInAt = new Date().toISOString();
    const { data: updatedBooking, error: updateError } = await supabase
      .from("bookings")
      .update({
        status: "checked_in",
        checked_in_at: checkedInAt,
      })
      .eq("id", booking.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    // Mark token as used
    await supabase
      .from("check_in_tokens")
      .update({ used_at: checkedInAt })
      .eq("id", tokenRecord.id);

    // ── Update member visit stats in real-time ──────────────────
    // After successful check-in, increment total_visits and refresh engagement
    try {
      const { data: currentMember } = await supabase
        .from("members")
        .select("total_visits")
        .eq("id", member_id)
        .single();

      const currentVisits = (currentMember?.total_visits as number) ?? 0;

      await supabase
        .from("members")
        .update({
          total_visits: currentVisits + 1,
          last_visit: checkedInAt,
          engagement_status: "engaged",
          updated_at: checkedInAt,
        })
        .eq("id", member_id);
    } catch (visitErr) {
      // Non-fatal — log but don't fail the check-in
      console.error("Failed to update member visit stats:", visitErr);
    }

    // Get member info
    const { data: memberInfo } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", member_id)
      .single();

    // Log activity
    await supabase.from("activity_log").insert({
      studio_id: studioId,
      actor_id: user.id,
      type: "member_checked_in_qr",
      subject_type: "booking",
      subject_id: booking.id,
      metadata: {
        member_id,
        class_id: booking.class_id,
        method: "qr_code",
      },
    });

    // Evaluate trainer bonus threshold (same logic as regular check-in)
    let bonusTriggered = false;
    let checkInCount = 0;

    if (booking.classes?.trainer_id) {
      const trainerId = booking.classes.trainer_id;

      const { count: classCheckIns } = await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("class_id", booking.class_id)
        .eq("studio_id", studioId)
        .eq("status", "checked_in")
        .neq("member_id", trainerId);

      checkInCount = classCheckIns ?? 0;

      const { data: settings } = await supabase
        .from("studio_settings")
        .select("trainer_bonus_threshold")
        .eq("studio_id", studioId)
        .single();

      const bonusThreshold = settings?.trainer_bonus_threshold ?? 7;

      if (checkInCount >= bonusThreshold) {
        bonusTriggered = true;

        const { data: existingBonus } = await supabase
          .from("trainer_bonuses")
          .select("id")
          .eq("class_id", booking.class_id)
          .eq("trainer_id", trainerId)
          .maybeSingle();

        if (!existingBonus) {
          await supabase.from("trainer_bonuses").insert({
            trainer_id: trainerId,
            class_id: booking.class_id,
            studio_id: studioId,
            check_in_count: checkInCount,
            threshold: bonusThreshold,
            status: "pending",
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        booking: updatedBooking,
        member_name: memberInfo?.full_name ?? "Unknown",
        class_name: booking.classes?.name ?? "Unknown",
        class_time: booking.classes?.start_time ?? null,
        checked_in_at: checkedInAt,
        check_in_count: checkInCount,
        bonus_triggered: bonusTriggered,
      },
    });
  } catch (err) {
    console.error("POST /api/check-in/qr error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
