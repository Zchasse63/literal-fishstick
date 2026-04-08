import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

/**
 * GET /api/promo-codes
 * List all promo codes for the studio, ordered by created_at desc.
 */
export async function GET(request: NextRequest) {
  try {
    // Suppress unused variable warning
    void request;

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

    const { data: promoCodes, error } = await supabase
      .from("promo_codes")
      .select("*")
      .eq("studio_id", studioId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: promoCodes });
  } catch (err) {
    console.error("GET /api/promo-codes error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/promo-codes
 * Create a new promo code for the studio.
 * Body: { code: string, trainer_id?: string, discount_type?: 'percent'|'fixed', discount_value?: number, description?: string }
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

    const body = await request.json();
    const { code, trainer_id, discount_type, discount_value, description } = body as {
      code: string;
      trainer_id?: string;
      discount_type?: "percent" | "fixed";
      discount_value?: number;
      description?: string;
    };

    if (!code || typeof code !== "string" || code.trim().length === 0) {
      return NextResponse.json(
        { error: "code is required" },
        { status: 400 }
      );
    }

    if (discount_type && !["percent", "fixed"].includes(discount_type)) {
      return NextResponse.json(
        { error: "discount_type must be 'percent' or 'fixed'" },
        { status: 400 }
      );
    }

    if (discount_value !== undefined && (typeof discount_value !== "number" || discount_value < 0)) {
      return NextResponse.json(
        { error: "discount_value must be a non-negative number" },
        { status: 400 }
      );
    }

    // Check uniqueness within studio
    const { data: existing } = await supabase
      .from("promo_codes")
      .select("id")
      .eq("studio_id", studioId)
      .eq("code", code.trim().toUpperCase())
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "A promo code with this code already exists for this studio" },
        { status: 409 }
      );
    }

    // Insert promo code
    const { data: created, error: insertError } = await supabase
      .from("promo_codes")
      .insert({
        studio_id: studioId,
        code: code.trim().toUpperCase(),
        trainer_id: trainer_id ?? null,
        discount_type: discount_type ?? null,
        discount_value: discount_value ?? null,
        description: description ?? null,
        active: true,
        created_by: user.id,
      })
      .select()
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
      type: "promo_code_created",
      subject_type: "promo_code",
      subject_id: created.id,
      metadata: {
        code: created.code,
        trainer_id: trainer_id ?? null,
        discount_type: discount_type ?? null,
        discount_value: discount_value ?? null,
      },
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    console.error("POST /api/promo-codes error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
