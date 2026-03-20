import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * POST /api/auth/profile
 * Creates a profile for the authenticated user if one does not already exist.
 * Called after sign-up or first sign-in to ensure a profile row exists.
 *
 * Returns the existing or newly created profile.
 */
export async function POST() {
  try {
    const supabase = await createServerClient();

    // 1. Get authenticated user
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

    // 2. Check if profile already exists
    const { data: existingProfile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Profile lookup error:", profileError);
      return NextResponse.json(
        { error: "Failed to look up profile" },
        { status: 500 }
      );
    }

    // 3. If profile exists, return it
    if (existingProfile) {
      return NextResponse.json({ data: existingProfile, created: false });
    }

    // 4. Create new profile with default role
    // Default studio_id — in production this would come from the sign-up flow
    // or an invitation link. For single-tenant Phase 1, we use the default.
    const defaultStudioId = process.env.DEFAULT_STUDIO_ID ?? "11111111-1111-1111-1111-111111111111";

    const { data: newProfile, error: insertError } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
        avatar_url: user.user_metadata?.avatar_url ?? null,
        roles: ["member"],
        studio_id: defaultStudioId,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Profile creation error:", insertError);
      return NextResponse.json(
        { error: "Failed to create profile" },
        { status: 500 }
      );
    }

    // 5. Log the profile creation
    await supabase.from("activity_log").insert({
      studio_id: defaultStudioId,
      actor_id: user.id,
      action: "profile_created",
      entity_type: "profile",
      entity_id: newProfile.id,
      metadata: {
        email: user.email,
        roles: ["member"],
        source: "auth_callback",
      },
    });

    return NextResponse.json({ data: newProfile, created: true }, { status: 201 });
  } catch (err) {
    console.error("POST /api/auth/profile error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
