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
        // BUG-026 sweep: phantom columns `name`, `start_time`, `end_time`.
        // Actual columns are `title`, `starts_at`, `ends_at`.
        "*, classes(id, title, starts_at, ends_at, trainer_id)"
      )
      .eq("member_id", member_id)
      .eq("studio_id", studioId)
      .eq("status", "booked");

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
        .gte("classes.starts_at", twoHoursAgo)
        .lte("classes.starts_at", twoHoursAhead);
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
    // After successful check-in, increment total_visits and refresh engagement.
    // Smart status: if member has credits, set 'active'; otherwise 'engaged'.
    // The daily cron will reconcile to the correct 10-category status anyway.
    try {
      const { data: currentMember } = await supabase
        .from("members")
        .select("total_visits, credits_remaining")
        .eq("id", member_id)
        .single();

      const currentVisits = (currentMember?.total_visits as number) ?? 0;
      const memberCredits = (currentMember?.credits_remaining as number) ?? 0;
      const newStatus = memberCredits > 0 ? 'active' : 'engaged';

      await supabase
        .from("members")
        .update({
          total_visits: currentVisits + 1,
          last_visit: checkedInAt,
          engagement_status: newStatus,
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

    // BUG-019 fix: 'member_checked_in_qr' replaced with canonical 'check_in_qr'.
    // Description added (NOT NULL silent swallow). Capture-and-log pattern.
    const memberName = (memberInfo as { full_name?: string } | null)?.full_name ?? 'Member';
    const { error: qrActivityError } = await supabase.from("activity_log").insert({
      studio_id: studioId,
      actor_id: user.id,
      type: "check_in_qr",
      subject_type: "booking",
      subject_id: booking.id,
      description: `${memberName} checked in via QR`,
      metadata: {
        member_id,
        class_id: booking.class_id,
        method: "qr_code",
      },
    });

    if (qrActivityError) {
      console.error(
        "POST /api/check-in/qr: activity_log insert failed",
        qrActivityError.message
      );
    }

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

      // Per-trainer bonus threshold lives on `trainers.bonus_threshold`.
      const { data: trainerRow } = await supabase
        .from("trainers")
        .select("bonus_threshold, bonus_amount")
        .eq("id", trainerId)
        .eq("studio_id", studioId)
        .maybeSingle();

      const bonusThreshold = trainerRow?.bonus_threshold ?? 7;
      const bonusAmount = trainerRow?.bonus_amount ?? 0;

      if (checkInCount >= bonusThreshold) {
        bonusTriggered = true;

        const { data: existingBonus } = await supabase
          .from("trainer_class_log")
          .select("id")
          .eq("class_id", booking.class_id)
          .eq("trainer_id", trainerId)
          .maybeSingle();

        if (!existingBonus) {
          await supabase.from("trainer_class_log").insert({
            trainer_id: trainerId,
            class_id: booking.class_id,
            studio_id: studioId,
            check_in_count: checkInCount,
            bonus_earned: true,
            bonus_amount: bonusAmount,
            base_pay: 0,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        booking: updatedBooking,
        member_name: memberInfo?.full_name ?? "Unknown",
        class_name: booking.classes?.title ?? "Unknown",
        class_time: booking.classes?.starts_at ?? null,
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
