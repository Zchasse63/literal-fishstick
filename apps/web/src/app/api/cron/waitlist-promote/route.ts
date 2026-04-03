import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * GET /api/cron/waitlist-promote
 *
 * Legacy alias — some cron providers only support GET.
 * Delegates to the POST handler which does the actual work.
 */
export async function GET(request: Request) {
  return POST(request);
}

/**
 * POST /api/cron/waitlist-promote
 *
 * Automatic waitlist promotion job.
 * Designed to be called by Vercel/Netlify cron (e.g., every 5 minutes)
 * or triggered manually from the admin dashboard.
 *
 * Logic:
 * 1. Find all classes in the next 24 hours that have open spots
 * 2. For each class with open spots, find the oldest pending waitlist entry
 * 3. Create a booking for the promoted member
 * 4. Update the waitlist entry status to 'promoted'
 * 5. Log the promotion to activity_log
 *
 * Authorization: Accepts a CRON_SECRET header for cron jobs,
 * or falls back to authenticated admin user.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();

    // Auth: check for cron secret or authenticated admin
    const cronSecret = request.headers.get("x-cron-secret");
    const expectedSecret = process.env.CRON_SECRET;

    let actorId = "system";

    if (cronSecret && expectedSecret && cronSecret === expectedSecret) {
      // Authorized via cron secret
      actorId = "system-cron";
    } else {
      // Fall back to authenticated user check
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return NextResponse.json(
          { error: "Unauthorized. Provide x-cron-secret header or authenticate." },
          { status: 401 }
        );
      }

      // Verify the user has admin/owner role
      const { data: profile } = await supabase
        .from("profiles")
        .select("roles")
        .eq("id", user.id)
        .single();

      const roles: string[] = profile?.roles ?? [];
      if (!roles.includes("admin") && !roles.includes("owner")) {
        return NextResponse.json(
          { error: "Forbidden. Admin access required." },
          { status: 403 }
        );
      }

      actorId = user.id;
    }

    // Calculate time window: now to 24 hours from now
    const now = new Date();
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // 1. Get all classes in the next 24 hours
    const { data: upcomingClasses, error: classError } = await supabase
      .from("classes")
      .select("id, capacity, studio_id, start_time, title")
      .gte("start_time", now.toISOString())
      .lte("start_time", in24Hours.toISOString())
      .order("start_time", { ascending: true });

    if (classError) {
      console.error("Failed to fetch upcoming classes:", classError);
      return NextResponse.json(
        { error: "Failed to fetch upcoming classes" },
        { status: 500 }
      );
    }

    if (!upcomingClasses || upcomingClasses.length === 0) {
      return NextResponse.json({
        message: "No upcoming classes in the next 24 hours",
        promoted: 0,
      });
    }

    let totalPromoted = 0;
    const promotionResults: Array<{
      classId: string
      classTitle: string
      memberId: string
      status: "promoted" | "failed"
      reason?: string
    }> = [];

    for (const cls of upcomingClasses) {
      // 2. Count current active bookings for this class
      const { count: currentBookings, error: countError } = await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("class_id", cls.id)
        .eq("studio_id", cls.studio_id)
        .in("status", ["confirmed", "checked_in"]);

      if (countError) {
        console.error(`Failed to count bookings for class ${cls.id}:`, countError);
        continue;
      }

      const bookedCount = currentBookings ?? 0;
      const openSpots = cls.capacity - bookedCount;

      if (openSpots <= 0) {
        // Class is full, no promotion possible
        continue;
      }

      // 3. Get pending waitlist entries for this class, oldest first
      // Promote up to the number of open spots
      const { data: waitlistEntries, error: waitlistError } = await supabase
        .from("waitlist_entries")
        .select("id, member_id, class_id")
        .eq("class_id", cls.id)
        .eq("studio_id", cls.studio_id)
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(openSpots);

      if (waitlistError) {
        console.error(`Failed to fetch waitlist for class ${cls.id}:`, waitlistError);
        continue;
      }

      if (!waitlistEntries || waitlistEntries.length === 0) {
        continue;
      }

      for (const entry of waitlistEntries) {
        // 4. Check for duplicate booking (member may have booked while on waitlist)
        const { data: existingBooking } = await supabase
          .from("bookings")
          .select("id")
          .eq("class_id", cls.id)
          .eq("member_id", entry.member_id)
          .eq("studio_id", cls.studio_id)
          .in("status", ["confirmed", "checked_in"])
          .maybeSingle();

        if (existingBooking) {
          // Member already has a booking — mark waitlist entry as superseded
          await supabase
            .from("waitlist_entries")
            .update({ status: "cancelled" })
            .eq("id", entry.id);

          promotionResults.push({
            classId: cls.id,
            classTitle: cls.title,
            memberId: entry.member_id,
            status: "failed",
            reason: "Member already has an active booking",
          });
          continue;
        }

        // 5. Create the booking
        const { data: booking, error: bookingError } = await supabase
          .from("bookings")
          .insert({
            class_id: cls.id,
            member_id: entry.member_id,
            studio_id: cls.studio_id,
            status: "confirmed",
            booked_at: new Date().toISOString(),
            source: "waitlist_promotion",
          })
          .select("id")
          .single();

        if (bookingError) {
          console.error(`Failed to create booking for waitlist entry ${entry.id}:`, bookingError);
          promotionResults.push({
            classId: cls.id,
            classTitle: cls.title,
            memberId: entry.member_id,
            status: "failed",
            reason: bookingError.message,
          });
          continue;
        }

        // 6. Update waitlist entry status to 'promoted'
        const { error: updateError } = await supabase
          .from("waitlist_entries")
          .update({
            status: "promoted",
            promoted_at: new Date().toISOString(),
            booking_id: booking.id,
          })
          .eq("id", entry.id);

        if (updateError) {
          console.error(`Failed to update waitlist entry ${entry.id}:`, updateError);
        }

        // 7. Log to activity_log
        await supabase.from("activity_log").insert({
          studio_id: cls.studio_id,
          actor_id: actorId,
          type: "waitlist_promoted",
          subject_type: "waitlist_entry",
          subject_id: entry.id,
          metadata: {
            class_id: cls.id,
            class_title: cls.title,
            member_id: entry.member_id,
            booking_id: booking.id,
            source: "cron_auto_promote",
          },
        });

        totalPromoted++;
        promotionResults.push({
          classId: cls.id,
          classTitle: cls.title,
          memberId: entry.member_id,
          status: "promoted",
        });
      }
    }

    return NextResponse.json({
      message: `Waitlist promotion complete`,
      promoted: totalPromoted,
      classesChecked: upcomingClasses.length,
      results: promotionResults,
    });
  } catch (err) {
    console.error("POST /api/cron/waitlist-promote error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
