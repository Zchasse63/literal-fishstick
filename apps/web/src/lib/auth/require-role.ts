import { createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export type Role = "owner" | "manager" | "trainer" | "staff" | "member";

/**
 * Verify the current user is authenticated and has one of the allowed roles.
 *
 * Returns either an `error` NextResponse (401/403) that should be returned
 * directly from the route handler, or the authenticated `user`, `profile`,
 * `supabase` client, and resolved `studioId`.
 *
 * Usage:
 *   const auth = await requireRole(["owner", "manager"]);
 *   if (auth.error) return auth.error;
 *   // auth.user, auth.profile, auth.supabase, auth.studioId are available
 */
export async function requireRole(allowedRoles: Role[]) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      user: null,
      profile: null,
      supabase,
      studioId: null as string | null,
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, roles, studio_id, full_name, email")
    .eq("id", user.id)
    .single();

  if (!profile || !allowedRoles.some((r) => profile.roles?.includes(r))) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      user,
      profile,
      supabase,
      studioId: profile?.studio_id ?? null,
    };
  }

  const studioId =
    profile.studio_id || "11111111-1111-1111-1111-111111111111";

  return { error: null, user, profile, supabase, studioId };
}
