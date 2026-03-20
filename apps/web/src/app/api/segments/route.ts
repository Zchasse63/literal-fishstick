import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * GET /api/segments
 * List all smart segments with computed member counts.
 * Query params: system_only (boolean)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { searchParams } = request.nextUrl;

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

    let query = supabase
      .from("smart_segments")
      .select("*")
      .eq("studio_id", studioId)
      .order("name");

    const systemOnly = searchParams.get("system_only");
    if (systemOnly === "true") {
      query = query.eq("is_system", true);
    }

    const { data: segments, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(segments);
  } catch (err) {
    console.error("GET /api/segments error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/segments
 * Create a new custom smart segment.
 * Body: { name, description?, rules, color?, icon? }
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("studio_id")
      .eq("id", user.id)
      .single();

    const studioId =
      profile?.studio_id ?? "11111111-1111-1111-1111-111111111111";

    const body = await request.json();

    if (!body.name || !body.rules) {
      return NextResponse.json(
        { error: "name and rules are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("smart_segments")
      .insert({
        studio_id: studioId,
        name: body.name,
        description: body.description ?? null,
        rules: body.rules,
        color: body.color || "#4F46E5",
        icon: body.icon || "users",
        is_system: false,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("POST /api/segments error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
