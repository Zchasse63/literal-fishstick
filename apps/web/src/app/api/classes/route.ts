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
 * Create a new class.
 * Body: { class_type_id, start_time, end_time, capacity, trainer_id?, title?, description? }
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

    // Verify the class type exists
    const { data: classType, error: typeError } = await supabase
      .from("class_types")
      .select("id")
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
        title: title ?? null,
        description: description ?? null,
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

    // Log activity
    await supabase.from("activity_log").insert({
      studio_id: studioId,
      actor_id: user.id,
      type: "class_created",
      subject_type: "class",
      subject_id: newClass.id,
      metadata: { class_type_id, start_time, trainer_id },
    });

    return NextResponse.json({ data: newClass }, { status: 201 });
  } catch (err) {
    console.error("POST /api/classes error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
