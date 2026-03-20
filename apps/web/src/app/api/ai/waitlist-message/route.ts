import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { sendTransactionalEmail } from "@/lib/resend";
import {
  generateWaitlistMessage,
  type WaitlistMemberContext,
  type WaitlistMessageType,
} from "@/lib/ai/waitlist-messaging";

const VALID_MESSAGE_TYPES: WaitlistMessageType[] = [
  "promoted",
  "still_waiting",
  "class_full",
];

/**
 * POST /api/ai/waitlist-message
 *
 * Generate (and optionally send) a personalized waitlist notification.
 *
 * Body: { booking_id: string, message_type: WaitlistMessageType, send?: boolean }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();

    // Authenticate
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    let body: { booking_id?: string; message_type?: string; send?: boolean };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    // Validate booking_id
    if (!body.booking_id || typeof body.booking_id !== "string") {
      return NextResponse.json(
        { error: "booking_id is required" },
        { status: 400 }
      );
    }

    // Validate message_type
    if (
      !body.message_type ||
      !VALID_MESSAGE_TYPES.includes(body.message_type as WaitlistMessageType)
    ) {
      return NextResponse.json(
        {
          error: `Invalid message_type. Must be one of: ${VALID_MESSAGE_TYPES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const messageType = body.message_type as WaitlistMessageType;

    // Fetch booking with class and member details
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select(
        `
        id,
        status,
        waitlist_position,
        member_id,
        class_id,
        classes (
          id,
          title,
          starts_at,
          ends_at
        ),
        members (
          id,
          membership_type,
          profile_id,
          profiles (
            id,
            full_name,
            email
          )
        )
      `
      )
      .eq("id", body.booking_id)
      .maybeSingle();

    if (bookingError) {
      console.error("Error fetching booking:", bookingError);
      return NextResponse.json(
        { error: "Failed to fetch booking details" },
        { status: 500 }
      );
    }

    if (!booking) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }

    // Extract nested data with type assertions for Supabase joined queries
    const classData = booking.classes as unknown as {
      id: string;
      title: string;
      starts_at: string;
      ends_at: string;
    } | null;

    const memberData = booking.members as unknown as {
      id: string;
      membership_type: string | null;
      profile_id: string;
      profiles: {
        id: string;
        full_name: string;
        email: string;
      } | null;
    } | null;

    if (!classData || !memberData?.profiles) {
      return NextResponse.json(
        { error: "Incomplete booking data — missing class or member details" },
        { status: 422 }
      );
    }

    const profile = memberData.profiles;

    // Count member visits (check-ins)
    const { count: visitCount } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("member_id", memberData.id)
      .not("checked_in_at", "is", null);

    // Check if member has been waitlisted before (excluding current booking)
    const { count: previousWaitlistCount } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("member_id", memberData.id)
      .eq("status", "waitlisted")
      .neq("id", booking.id);

    // Format date and time from class starts_at
    const startsAt = new Date(classData.starts_at);
    const classDate = startsAt.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const classTime = startsAt.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    // Build context
    const context: WaitlistMemberContext = {
      member_name: profile.full_name,
      member_email: profile.email,
      class_title: classData.title,
      class_date: classDate,
      class_time: classTime,
      position_in_waitlist: booking.waitlist_position ?? 0,
      member_visit_count: visitCount ?? 0,
      membership_type: memberData.membership_type,
      has_been_waitlisted_before: (previousWaitlistCount ?? 0) > 0,
    };

    // Generate the personalized message
    const result = await generateWaitlistMessage(context, messageType);

    // Optionally send the email via Resend
    let sendResult: { id: string | null; error: string | null } | null = null;
    if (body.send) {
      const emailResult = await sendTransactionalEmail(
        profile.email,
        result.subject,
        result.body_html,
        {
          tags: [
            { name: "type", value: "waitlist_notification" },
            { name: "message_type", value: messageType },
            { name: "booking_id", value: booking.id },
          ],
        }
      );

      sendResult = { id: emailResult.id, error: emailResult.error };
    }

    return NextResponse.json({
      ...result,
      sent: body.send ? true : false,
      send_result: sendResult,
      booking_id: booking.id,
      member_email: profile.email,
    });
  } catch (err) {
    console.error("POST /api/ai/waitlist-message error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
