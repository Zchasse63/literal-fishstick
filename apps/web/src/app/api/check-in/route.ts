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

    // Fetch the booking with class + member glofox_id for write-back.
    // BUG-026 sweep: previously selected phantom columns `start_time` and
    // `end_time` on classes — actual columns are `starts_at` and `ends_at`.
    // PostgREST errors on unknown columns and returns null for the entire
    // row, which made the handler return 404 on every check-in attempt.
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("*, classes(id, trainer_id, starts_at, ends_at), members(glofox_id)")
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

    // BUG-019 L1+L2 fix: 'member_checked_in' was not in the activity_log
    // type CHECK enum (canonical is 'check_in'). Description was also
    // omitted (NOT NULL silent swallow). Add capture-and-log per pattern.
    const { error: checkInActivityError } = await supabase.from("activity_log").insert({
      studio_id: studioId,
      actor_id: user.id,
      type: "check_in",
      subject_type: "booking",
      subject_id: booking_id,
      description: `Member checked in to class`,
      metadata: {
        member_id: booking.member_id,
        class_id: booking.class_id,
      },
    });

    if (checkInActivityError) {
      console.error(
        "POST /api/check-in: activity_log insert failed",
        checkInActivityError.message
      );
    }

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

          // BUG-019 L3+L4 fix: 'trainer_bonus_triggered' is now in the
          // activity_log enum (Tier 4.6.5 M2). Add description + capture.
          const { error: bonusActivityError } = await supabase.from("activity_log").insert({
            studio_id: studioId,
            actor_id: user.id,
            type: "trainer_bonus_triggered",
            subject_type: "class",
            subject_id: booking.class_id,
            description: `Trainer bonus triggered: ${checkInCount} check-ins (threshold ${bonusThreshold})`,
            metadata: {
              trainer_id: trainerId,
              check_in_count: checkInCount,
              threshold: bonusThreshold,
            },
          });

          if (bonusActivityError) {
            console.error(
              "POST /api/check-in: trainer bonus activity_log insert failed",
              bonusActivityError.message
            );
          }
        }
      }
    }

    // ── Update member visit stats in real-time ──────────────────
    // After successful check-in, increment total_visits and refresh engagement.
    // Smart status: if member has credits, set 'active'; otherwise 'engaged'.
    // The daily cron will reconcile to the correct 10-category status anyway.
    if (booking.member_id) {
      try {
        const { data: currentMember } = await supabase
          .from("members")
          .select("total_visits, credit_balance")
          .eq("id", booking.member_id)
          .single();

        const currentVisits = (currentMember?.total_visits as number) ?? 0;
        const memberCredits = (currentMember?.credit_balance as number) ?? 0;
        const now = new Date().toISOString();
        const newStatus = memberCredits > 0 ? 'active' : 'engaged';

        await supabase
          .from("members")
          .update({
            total_visits: currentVisits + 1,
            last_visit: now,
            engagement_status: newStatus,
            updated_at: now,
          })
          .eq("id", booking.member_id);
      } catch (visitErr) {
        // Non-fatal — log but don't fail the check-in
        console.error("Failed to update member visit stats:", visitErr);
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
