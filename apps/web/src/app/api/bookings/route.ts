import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { validateBody, bookingCreateSchema } from "@/lib/validation";
import { inngest } from "@/lib/inngest/client";

/**
 * GET /api/bookings
 * List bookings with optional class_id filter.
 * Query params: class_id, status, limit, offset
 */
export async function GET(request: NextRequest) {
  const auth = await requireRole(["owner", "manager"]);
  if (auth.error) return auth.error;
  const { supabase, studioId } = auth;

  const { searchParams } = request.nextUrl;
  const classId = searchParams.get("class_id");
  const status = searchParams.get("status");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);

  let query = supabase
    .from("bookings")
    .select("*, classes(*), profiles!bookings_member_id_fkey(id, full_name, email)", {
      count: "exact",
    })
    .eq("studio_id", studioId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (classId) query = query.eq("class_id", classId);
  if (status) query = query.eq("status", status);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ data, count });
}

/**
 * POST /api/bookings
 * Create a booking with atomic capacity check.
 * Body: { class_id, member_id }
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole(["owner", "manager"]);
  if (auth.error) return auth.error;
  const { user, supabase, studioId } = auth;

  const body = await request.json();
  const { data: validated, error: validationError } = validateBody(bookingCreateSchema, body);
  if (validationError) return validationError;
  const { class_id, member_id } = validated;

  // T29 / B17: atomic capacity check + insert via book_class_atomic RPC.
  // Runs inside a single transaction with FOR UPDATE lock on the class row
  // so concurrent bookings against the same class can never exceed capacity.
  // The RPC raises with SQLSTATE P0001 and a HINT string for each failure:
  //   'not_found' → 404, 'class_full' / 'duplicate' → 409.
  const { data: atomicResult, error: atomicError } = await supabase.rpc(
    "book_class_atomic",
    {
      p_class_id: class_id,
      p_member_id: member_id,
      p_studio_id: studioId,
    }
  );

  if (atomicError) {
    const hint = (atomicError as { hint?: string; message?: string }).hint ?? ""
    const message = atomicError.message ?? "Booking failed"
    if (hint === "not_found" || message.includes("not found")) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }
    if (hint === "class_full" || message.includes("full capacity")) {
      return NextResponse.json({ error: "Class is at full capacity" }, { status: 409 });
    }
    if (hint === "duplicate" || message.includes("already has an active booking")) {
      return NextResponse.json(
        { error: "Member already has an active booking for this class" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const booking = atomicResult as { id: string; class_id: string; member_id: string; studio_id: string; status: string } | null
  if (!booking) {
    return NextResponse.json({ error: "Booking failed" }, { status: 500 });
  }

  // Fetch class info for Glofox write-back + any downstream logic
  const { data: classData } = await supabase
    .from("classes")
    .select("id, glofox_id")
    .eq("id", class_id)
    .eq("studio_id", studioId)
    .single();

  // Log activity
  await supabase.from("activity_log").insert({
    studio_id: studioId,
    actor_id: user.id,
    type: "booking_created",
    subject_type: "booking",
    subject_id: booking.id,
    metadata: { class_id, member_id },
  });

  // Fire async Glofox booking write-back (fire-and-forget).
  // Only attempted if this class originated from Glofox AND member has a Glofox profile.
  if (classData?.glofox_id) {
    const { data: memberProfile } = await supabase
      .from("members")
      .select("glofox_id")
      .eq("id", member_id)
      .single();

    const memberGlofoxId = memberProfile?.glofox_id;
    if (memberGlofoxId) {
      // Mark write-back as pending before firing
      await supabase
        .from("bookings")
        .update({ glofox_write_status: "pending" })
        .eq("id", booking.id);

      void inngest.send({
        name: "glofox/create-booking",
        data: {
          booking_id: booking.id,
          glofox_event_id: classData.glofox_id,
          glofox_user_id: memberGlofoxId,
          studio_id: studioId,
        },
      });
    }
  }

  return NextResponse.json({ data: booking }, { status: 201 });
}
