import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

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
      .select("studio_id")
      .eq("id", user.id)
      .single();

    const studioId =
      profile?.studio_id ?? "11111111-1111-1111-1111-111111111111";

    // Fetch the booking
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("*, classes(id, trainer_id, start_time, end_time)")
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
      action: "member_checked_in",
      entity_type: "booking",
      entity_id: booking_id,
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
            action: "trainer_bonus_triggered",
            entity_type: "class",
            entity_id: booking.class_id,
            metadata: {
              trainer_id: trainerId,
              check_in_count: checkInCount,
              threshold: bonusThreshold,
            },
          });
        }
      }
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
