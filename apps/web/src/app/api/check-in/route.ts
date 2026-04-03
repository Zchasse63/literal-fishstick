import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { inngest } from "@/lib/inngest/client";
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

/**
 * POST /api/check-in
 * Check in a member for a booking.
 * Updates booking status, logs activity, and evaluates trainer bonus threshold.
 *
 * Body: { booking_id }
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
    const { booking_id } = body;

    if (!booking_id) {
      return NextResponse.json(
        { error: "booking_id is required" },
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

    // Fetch the booking with class + member glofox_id for write-back
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("*, classes(id, trainer_id, start_time, end_time), members(glofox_id)")
      .eq("id", booking_id)
      .eq("studio_id", studioId)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }

    if (booking.status === "checked_in") {
      return NextResponse.json(
        { error: "Member is already checked in" },
        { status: 400 }
      );
    }

    if (booking.status === "cancelled") {
      return NextResponse.json(
        { error: "Cannot check in a cancelled booking" },
        { status: 400 }
      );
    }

    // Update booking status to checked_in
    const { data: updatedBooking, error: updateError } = await supabase
      .from("bookings")
      .update({
        status: "checked_in",
        checked_in_at: new Date().toISOString(),
        attended: true,
      })
      .eq("id", booking_id)
      .select()
      .single();

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
      type: "member_checked_in",
      subject_type: "booking",
      subject_id: booking_id,
      metadata: {
        member_id: booking.member_id,
        class_id: booking.class_id,
      },
    });

    // Evaluate trainer bonus threshold if a trainer is assigned
    let bonusTriggered = false;
    let checkInCount = 0;

    if (booking.classes?.trainer_id) {
      const trainerId = booking.classes.trainer_id;

      // Count check-ins for this class, excluding the trainer's own attendance
      const { count: classCheckIns } = await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("class_id", booking.class_id)
        .eq("studio_id", studioId)
        .eq("status", "checked_in")
        .neq("member_id", trainerId);

      checkInCount = classCheckIns ?? 0;

      // Get the studio's bonus threshold setting
      const { data: settings } = await supabase
        .from("studio_settings")
        .select("trainer_bonus_threshold")
        .eq("studio_id", studioId)
        .single();

      const bonusThreshold = settings?.trainer_bonus_threshold ?? 7;

      if (checkInCount >= bonusThreshold) {
        bonusTriggered = true;

        // Check if a bonus record already exists for this class
        const { data: existingBonus } = await supabase
          .from("trainer_bonuses")
          .select("id")
          .eq("class_id", booking.class_id)
          .eq("trainer_id", trainerId)
          .maybeSingle();

        if (!existingBonus) {
          // Create the bonus record
          await supabase.from("trainer_bonuses").insert({
            trainer_id: trainerId,
            class_id: booking.class_id,
            studio_id: studioId,
            check_in_count: checkInCount,
            threshold: bonusThreshold,
            status: "pending",
          });

          // Log bonus activity
          await supabase.from("activity_log").insert({
            studio_id: studioId,
            actor_id: user.id,
            type: "trainer_bonus_triggered",
            subject_type: "class",
            subject_id: booking.class_id,
            metadata: {
              trainer_id: trainerId,
              check_in_count: checkInCount,
              threshold: bonusThreshold,
            },
          });
        }
      }
    }

    // Fire async Glofox attendance write-back (fire-and-forget).
    // Only attempted if this booking originated from Glofox (has a glofox_id).
    // Supabase is already updated — Glofox failure must never block this response.
    const memberGlofoxId = (booking.members as { glofox_id: string | null } | null)?.glofox_id;
    if (booking.glofox_id && memberGlofoxId) {
      void inngest.send({
        name: 'glofox/mark-attendance',
        data: {
          booking_id,
          glofox_booking_id: booking.glofox_id,
          glofox_user_id: memberGlofoxId,
          studio_id: studioId,
        },
      });
    }

    return NextResponse.json({
      data: updatedBooking,
      check_in_count: checkInCount,
      bonus_triggered: bonusTriggered,
    });
  } catch (err) {
    console.error("POST /api/check-in error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
