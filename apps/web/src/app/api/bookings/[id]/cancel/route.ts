import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { inngest } from "@/lib/inngest/client";
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

/**
 * POST /api/bookings/[id]/cancel
 * Cancel a booking. Checks the studio's late-cancellation window
 * and applies strikes per the progressive strike policy.
 *
 * Body (optional): { reason?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient();
    const { id: bookingId } = await params;

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

    const body = await request.json().catch(() => ({}));
    const reason = (body as { reason?: string }).reason ?? null;

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

    // Fetch the booking with its class start time. Schema: classes.starts_at
    // (not start_time). Include glofox_id for write-back.
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("*, classes(starts_at)")
      .eq("id", bookingId)
      .eq("studio_id", studioId)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }

    if (booking.status === "cancelled") {
      return NextResponse.json(
        { error: "Booking is already cancelled" },
        { status: 400 }
      );
    }

    if (booking.status === "checked_in") {
      return NextResponse.json(
        { error: "Cannot cancel a booking after check-in" },
        { status: 400 }
      );
    }

    // Get studio settings for late cancellation window
    const { data: settings } = await supabase
      .from("studio_settings")
      .select("late_cancel_window_hours, strike_system_enabled")
      .eq("studio_id", studioId)
      .single();

    const lateCancelWindowHours = settings?.late_cancel_window_hours ?? 4;
    const strikeSystemEnabled = settings?.strike_system_enabled ?? true;

    // Determine if this is a late cancellation
    const classStartTime = new Date(booking.classes.starts_at);
    const now = new Date();
    const hoursUntilClass =
      (classStartTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    const isLateCancellation = hoursUntilClass < lateCancelWindowHours && hoursUntilClass > 0;

    // Update booking status
    const { data: updatedBooking, error: updateError } = await supabase
      .from("bookings")
      .update({
        status: "cancelled",
        cancelled_at: now.toISOString(),
        cancellation_reason: reason,
        is_late_cancellation: isLateCancellation,
      })
      .eq("id", bookingId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    let strikeApplied = false;
    let strikeCount = 0;
    let penaltyAmount = 0;

    // Apply strike if late cancellation and strike system is on
    if (isLateCancellation && strikeSystemEnabled) {
      // Count strikes in the rolling 30-day window
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { count: recentStrikes } = await supabase
        .from("member_strikes")
        .select("id", { count: "exact", head: true })
        .eq("member_id", booking.member_id)
        .eq("studio_id", studioId)
        .gte("created_at", thirtyDaysAgo.toISOString());

      strikeCount = (recentStrikes ?? 0) + 1; // Including this new one

      // Progressive penalties: 1st = warning, 2nd = $5, 3rd+ = $10
      if (strikeCount === 2) {
        penaltyAmount = 5;
      } else if (strikeCount >= 3) {
        penaltyAmount = 10;
      }

      // Record the strike — schema has `type` (not strike_type); strike ordinal
      // number is computed at read-time from the rolling count.
      await supabase.from("member_strikes").insert({
        member_id: booking.member_id,
        studio_id: studioId,
        booking_id: bookingId,
        type: "late_cancel",
        penalty_amount: penaltyAmount,
      });

      strikeApplied = true;
    }

    // Log activity
    await supabase.from("activity_log").insert({
      studio_id: studioId,
      actor_id: user.id,
      type: isLateCancellation ? "booking_late_cancelled" : "booking_cancelled",
      subject_type: "booking",
      subject_id: bookingId,
      metadata: {
        reason,
        is_late_cancel: isLateCancellation,
        strike_applied: strikeApplied,
        strike_count: strikeCount,
        penalty_amount: penaltyAmount,
      },
    });

    // Fire async Glofox cancel write-back (fire-and-forget).
    // Only attempted if this booking has a Glofox ID (was synced from Glofox).
    if (booking.glofox_id) {
      void inngest.send({
        name: "glofox/cancel-booking",
        data: {
          booking_id: bookingId,
          glofox_booking_id: booking.glofox_id,
          studio_id: studioId,
        },
      });
    }

    return NextResponse.json({
      data: updatedBooking,
      late_cancellation: isLateCancellation,
      strike_applied: strikeApplied,
      strike_count: strikeCount,
      penalty_amount: penaltyAmount,
    });
  } catch (err) {
    console.error("POST /api/bookings/[id]/cancel error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
