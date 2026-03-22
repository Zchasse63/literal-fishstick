import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

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
      return NextResponse.redirect(`${origin}${redirect}`);
    }
  }

  // If no code or exchange failed, redirect to login with error
  return NextResponse.redirect(`${origin}/login`);
}
