import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

/**
 * GET /api/classes
 * List classes with date range filter, joined with class_types.
 * Query params: start_date, end_date, class_type_id, trainer_id, limit, offset
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { searchParams } = request.nextUrl;

    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");
    const classTypeId = searchParams.get("class_type_id");
    const trainerId = searchParams.get("trainer_id");
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);

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

    let query = supabase
      .from("classes")
      .select(
        "*, class_types(id, name, description, color), trainer:profiles!classes_trainer_id_fkey(id, full_name)",
        { count: "exact" }
      )
      .eq("studio_id", studioId)
      .order("starts_at", { ascending: true })
      .range(offset, offset + limit - 1);

    if (startDate) {
      query = query.gte("starts_at", startDate);
    }

    if (endDate) {
      query = query.lte("starts_at", endDate);
    }

    if (classTypeId) {
      query = query.eq("class_type_id", classTypeId);
    }

    if (trainerId) {
      query = query.eq("trainer_id", trainerId);
    }

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data, count });
  } catch (err) {
    console.error("GET /api/classes error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/classes
 * Create a new class. Requires owner or manager role.
 *
 * Body: { class_type_id, start_time, end_time, capacity, trainer_id?, title?, description? }
 *
 * Notes:
 * - The body field `description` maps to the DB column `classes.notes`. The
 *   classes table has no `description` column (BUG-015 Layer 1).
 * - The `title` field defaults to `class_type.name` when blank or omitted,
 *   because `classes.title` is NOT NULL and the modal labels it "optional"
 *   (BUG-015 Layer 2).
 * - Writes an `activity_log` row with type='class_created' and a non-null
 *   description. The activity_log insert is capture-and-log — failures
 *   are observability-only, they do NOT roll back the class insert.
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
    const { class_type_id, start_time, end_time, capacity, trainer_id, title, description } = body;

    if (!class_type_id || !start_time || !end_time || !capacity) {
      return NextResponse.json(
        {
          error:
            "class_type_id, start_time, end_time, and capacity are required",
        },
        { status: 400 }
      );
    }

    if (typeof capacity !== "number" || capacity < 1) {
      return NextResponse.json(
        { error: "capacity must be a positive number" },
        { status: 400 }
      );
    }

    const start = new Date(start_time);
    const end = new Date(end_time);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format for start_time or end_time" },
        { status: 400 }
      );
    }

    if (end <= start) {
      return NextResponse.json(
        { error: "end_time must be after start_time" },
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

    // BUG-015 Layer 5: role check on POST mirrors the GET handler above.
    // Without this, unauthorized requests fall through to RLS which returns
    // a generic 500 "Internal server error" rather than a clean 403.
    const roles: string[] = profile?.roles ?? [];
    if (!roles.some((r: string) => ["owner", "manager"].includes(r))) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    // BUG-015 Layer 2: fetch class_type.name up-front so we can default
    // title when blank. `class_types.name` is NOT NULL per schema, so the
    // fallback always resolves to a string. Select is also the class_type
    // existence check (404 if missing).
    const { data: classType, error: typeError } = await supabase
      .from("class_types")
      .select("id, name")
      .eq("id", class_type_id)
      .eq("studio_id", studioId)
      .single();

    if (typeError || !classType) {
      return NextResponse.json(
        { error: "Class type not found" },
        { status: 404 }
      );
    }

    const { data: newClass, error: insertError } = await supabase
      .from("classes")
      .insert({
        class_type_id,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        capacity,
        trainer_id: trainer_id ?? null,
        // BUG-015 Layer 2: title is NOT NULL in the schema. Default to
        // class_type.name when blank — matches existing data pattern
        // (every prior class in prod has title = class_type name or similar).
        title: title || classType.name,
        // BUG-015 Layer 1: the DB column is `notes`, not `description`.
        // The request body field `description` is intentional — that's what
        // the UI calls it — but it maps to `notes` at the DB layer.
        notes: description ?? null,
        studio_id: studioId,
        status: "scheduled",
      })
      .select("*, class_types(id, name, description, color)")
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    // BUG-015 Layers 3 + 4: activity_log row. The `description` column is
    // NOT NULL; the `type` value must be in the CHECK enum (migration
    // 20260410 added 'class_created'). Capture { error } and console.error
    // on failure — no rollback. Observability pattern, not business-critical
    // (the class itself is created whether or not the log row lands).
    const { error: activityError } = await supabase.from("activity_log").insert({
      studio_id: studioId,
      actor_id: user.id,
      type: "class_created",
      subject_type: "class",
      subject_id: newClass.id,
      description: `Class created: ${classType.name}`,
      metadata: { class_type_id, start_time, trainer_id },
    });

    if (activityError) {
      console.error(
        "POST /api/classes: activity_log insert failed",
        activityError.message
      );
    }

    return NextResponse.json({ data: newClass }, { status: 201 });
  } catch (err) {
    console.error("POST /api/classes error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
