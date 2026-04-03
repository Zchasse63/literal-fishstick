import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const ADMIN_ROLES = ["admin", "owner", "manager"];

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawRedirect = searchParams.get("redirect") || "/";

  // Prevent open redirect — only allow relative paths, block protocol-relative URLs
  const redirect = rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
    ? rawRedirect
    : "/";

  if (code) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Role-based routing: if user only has trainer/staff roles, send to employee portal
      let destination = redirect;

      // Only override if the user didn't request a specific destination
      if (redirect === "/") {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("roles")
            .eq("id", user.id)
            .single();
          const roles: string[] = profile?.roles ?? [];
          const hasAdminRole = roles.some((r: string) => ADMIN_ROLES.includes(r));
          if (!hasAdminRole && roles.length > 0) {
            destination = "/employee";
          }
        }
      }

      return NextResponse.redirect(`${origin}${destination}`);
    }
  }

  // If no code or exchange failed, redirect to login with error
  return NextResponse.redirect(`${origin}/login`);
}
