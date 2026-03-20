import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * GET /api/classes/[id]
 * Fetch a single class with booking count.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient();
    const { id } = await params;

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

    const { data: profile } = await supabase
      .from("profiles")
      .select("studio_id")
      .eq("id", user.id)
      .single();

    const studioId =
      profile?.studio_id ?? "11111111-1111-1111-1111-111111111111";

    const { data: classData, error } = await supabase
      .from("classes")
      .select(
        "*, class_types(id, name, description, color), trainer:profiles!classes_trainer_id_fkey(id, full_name, email)"
      )
      .eq("id", id)
      .eq("studio_id", studioId)
      .single();

    if (error || !classData) {
      return NextResponse.json(
        { error: "Class not found" },
        { status: 404 }
      );
    }

    // Get booking count
    const { count: bookingCount } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("class_id", id)
      .eq("studio_id", studioId)
      .in("status", ["confirmed", "checked_in"]);

    return NextResponse.json({
      data: { ...classData, booking_count: bookingCount ?? 0 },
    });
  } catch (err) {
    console.error("GET /api/classes/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/classes/[id]
 * Update class details.
 * Body: { title?, class_type_id?, start_time?, end_time?, capacity?, trainer_id?, description?, status? }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient();
    const { id } = await params;

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

    const { data: profile } = await supabase
      .from("profiles")
      .select("studio_id")
      .eq("id", user.id)
      .single();

    const studioId =
      profile?.studio_id ?? "11111111-1111-1111-1111-111111111111";

    const body = await request.json();
    const allowedFields = [
      "title",
      "class_type_id",
      "start_time",
      "end_time",
      "capacity",
      "trainer_id",
      "description",
      "status",
    ];

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // Validate time fields if provided
    if (updates.start_time || updates.end_time) {
      const startStr = (updates.start_time as string) || null;
      const endStr = (updates.end_time as string) || null;

      if (startStr) {
        const start = new Date(startStr);
        if (isNaN(start.getTime())) {
          return NextResponse.json(
            { error: "Invalid date format for start_time" },
            { status: 400 }
          );
        }
        updates.start_time = start.toISOString();
      }

      if (endStr) {
        const end = new Date(endStr);
        if (isNaN(end.getTime())) {
          return NextResponse.json(
            { error: "Invalid date format for end_time" },
            { status: 400 }
          );
        }
        updates.end_time = end.toISOString();
      }
    }

    if (updates.capacity !== undefined) {
      if (typeof updates.capacity !== "number" || (updates.capacity as number) < 1) {
        return NextResponse.json(
          { error: "capacity must be a positive number" },
          { status: 400 }
        );
      }
    }

    updates.updated_at = new Date().toISOString();

    const { data: updated, error } = await supabase
      .from("classes")
      .update(updates)
      .eq("id", id)
      .eq("studio_id", studioId)
      .select("*, class_types(id, name, description, color), trainer:profiles!classes_trainer_id_fkey(id, full_name)")
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    if (!updated) {
      return NextResponse.json(
        { error: "Class not found" },
        { status: 404 }
      );
    }

    // Log activity
    await supabase.from("activity_log").insert({
      studio_id: studioId,
      actor_id: user.id,
      action: "class_updated",
      entity_type: "class",
      entity_id: id,
      metadata: updates,
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("PUT /api/classes/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/classes/[id]
 * Delete a class. Returns 409 if bookings exist.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient();
    const { id } = await params;

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

    const { data: profile } = await supabase
      .from("profiles")
      .select("studio_id")
      .eq("id", user.id)
      .single();

    const studioId =
      profile?.studio_id ?? "11111111-1111-1111-1111-111111111111";

    // Check for existing bookings
    const { count: bookingCount } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("class_id", id)
      .eq("studio_id", studioId)
      .in("status", ["confirmed", "checked_in"]);

    if ((bookingCount ?? 0) > 0) {
      return NextResponse.json(
        { error: "Cannot delete a class with active bookings" },
        { status: 409 }
      );
    }

    const { error } = await supabase
      .from("classes")
      .delete()
      .eq("id", id)
      .eq("studio_id", studioId);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Log activity
    await supabase.from("activity_log").insert({
      studio_id: studioId,
      actor_id: user.id,
      action: "class_deleted",
      entity_type: "class",
      entity_id: id,
      metadata: {},
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/classes/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
