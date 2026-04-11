import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

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
      .in("status", ["booked", "checked_in"]);

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
 * Update class details. Requires owner or manager role.
 *
 * Body: { title?, class_type_id?, start_time?, end_time?, capacity?, trainer_id?, description?, status? }
 *
 * Notes:
 * - Body field `description` maps to the DB column `classes.notes`. The
 *   classes table has no `description` column (BUG-017 L1, same root
 *   cause as the BUG-015 L1 fixed in POST by Tier 3.8).
 * - Setting `status='cancelled'` writes an activity_log row with type
 *   `'class_cancelled'` instead of the generic `'class_updated'` so
 *   ops dashboards can separate cancellations from edits.
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
      .select("studio_id, roles")
      .eq("id", user.id)
      .single();

    const studioId =
      profile?.studio_id ?? DEFAULT_STUDIO_ID;

    // BUG-017 L5: role check mirrors the GET handler and Tier 3.8 POST fix.
    const roles: string[] = profile?.roles ?? [];
    if (!roles.some((r: string) => ["owner", "manager"].includes(r))) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const allowedFields = [
      "title",
      "class_type_id",
      "start_time",
      "end_time",
      "capacity",
      "trainer_id",
      "status",
    ];

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    // Remap API field names to DB column names.
    // Clients send start_time/end_time, DB uses starts_at/ends_at.
    if (updates.start_time !== undefined) {
      updates.starts_at = updates.start_time;
      delete updates.start_time;
    }
    if (updates.end_time !== undefined) {
      updates.ends_at = updates.end_time;
      delete updates.end_time;
    }

    // BUG-017 L1: body field `description` maps to DB column `notes`.
    // The classes table has no `description` column. Accept clients
    // still sending `description` for backward compatibility.
    if (body.description !== undefined) {
      updates.notes = body.description ?? null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // Validate time fields if provided
    if (updates.starts_at || updates.ends_at) {
      const startStr = (updates.starts_at as string) || null;
      const endStr = (updates.ends_at as string) || null;

      if (startStr) {
        const start = new Date(startStr);
        if (isNaN(start.getTime())) {
          return NextResponse.json(
            { error: "Invalid date format for start_time" },
            { status: 400 }
          );
        }
        updates.starts_at = start.toISOString();
      }

      if (endStr) {
        const end = new Date(endStr);
        if (isNaN(end.getTime())) {
          return NextResponse.json(
            { error: "Invalid date format for end_time" },
            { status: 400 }
          );
        }
        updates.ends_at = end.toISOString();
      }

      // Tier 3.10: if both times are being updated in the same request,
      // assert end is after start. Mirrors the POST handler's check at
      // route.ts:148-152. If only one side is updated, we cannot compare
      // without re-reading the existing row — skip the check in that case
      // (the DB will accept it; admin must supply both to get the check).
      if (updates.starts_at && updates.ends_at) {
        const startMs = new Date(updates.starts_at as string).getTime();
        const endMs = new Date(updates.ends_at as string).getTime();
        if (endMs <= startMs) {
          return NextResponse.json(
            { error: "end_time must be after start_time" },
            { status: 400 }
          );
        }
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
        { error: "Internal server error" },
        { status: 500 }
      );
    }

    if (!updated) {
      return NextResponse.json(
        { error: "Class not found" },
        { status: 404 }
      );
    }

    // BUG-017 L3 + L4: activity_log description is NOT NULL; type must be
    // in the CHECK enum. Capture-and-log pattern — no rollback on log
    // failure (observability, not business-critical).
    //
    // When the update sets status='cancelled', use the dedicated
    // 'class_cancelled' type (added by Tier 3.8 migration) so ops
    // dashboards can separate cancellations from generic edits.
    const classTitle = updated.title ?? "(untitled)";
    const wasCancelled = updates.status === "cancelled";
    const { error: activityError } = await supabase.from("activity_log").insert({
      studio_id: studioId,
      actor_id: user.id,
      type: wasCancelled ? "class_cancelled" : "class_updated",
      subject_type: "class",
      subject_id: id,
      description: wasCancelled
        ? `Class cancelled: ${classTitle}`
        : `Class updated: ${classTitle}`,
      metadata: updates,
    });

    if (activityError) {
      console.error(
        "PUT /api/classes/[id]: activity_log insert failed",
        activityError.message
      );
    }

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
 * Hard-delete a class. Requires owner or manager role.
 * Returns 409 if active bookings exist (use PUT status='cancelled' instead
 * for the soft-cancel path, which preserves history and works even when
 * bookings exist).
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
      .select("studio_id, roles")
      .eq("id", user.id)
      .single();

    const studioId =
      profile?.studio_id ?? DEFAULT_STUDIO_ID;

    // BUG-017 L5: role check mirrors the GET/PUT handlers.
    const roles: string[] = profile?.roles ?? [];
    if (!roles.some((r: string) => ["owner", "manager"].includes(r))) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    // Fetch existing class for the activity_log description + clean 404.
    const { data: existingClass } = await supabase
      .from("classes")
      .select("title")
      .eq("id", id)
      .eq("studio_id", studioId)
      .single();

    if (!existingClass) {
      return NextResponse.json(
        { error: "Class not found" },
        { status: 404 }
      );
    }

    // Check for existing bookings
    const { count: bookingCount } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("class_id", id)
      .eq("studio_id", studioId)
      .in("status", ["booked", "checked_in"]);

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
        { error: "Internal server error" },
        { status: 500 }
      );
    }

    // BUG-017 L3: activity_log description is NOT NULL. Capture-and-log
    // pattern — no rollback on log failure.
    const classTitle = existingClass.title ?? "(untitled)";
    const { error: activityError } = await supabase.from("activity_log").insert({
      studio_id: studioId,
      actor_id: user.id,
      type: "class_deleted",
      subject_type: "class",
      subject_id: id,
      description: `Class deleted: ${classTitle}`,
      metadata: {},
    });

    if (activityError) {
      console.error(
        "DELETE /api/classes/[id]: activity_log insert failed",
        activityError.message
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/classes/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
