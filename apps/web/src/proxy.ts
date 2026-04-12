import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_ROUTES = ["/login", "/auth/callback"];

// Public API endpoints that don't require authentication
const PUBLIC_API_ROUTES = [
  "/api/leads/capture",        // Lead capture form submission (public embed)
  "/api/unsubscribe",          // Email unsubscribe (token-based)
  "/api/inngest",              // Inngest webhook endpoint (verified via signing key)
  "/api/webhooks/stripe",      // Stripe webhook (verified via signature)
  "/api/webhooks/resend",      // Resend webhook (verified via signature)
  "/api/webhooks/easypost",    // EasyPost webhook
  "/api/webhooks/twilio",      // Twilio webhook
  "/api/openapi",              // API docs (public read)
  "/api/health",               // Health check (uptime monitoring)
  "/api/glofox/sync",          // Glofox sync (secured by CRON_SECRET header, not user auth)
  "/api/glofox/backfill",      // Glofox backfill (secured by CRON_SECRET header)
  "/api/glofox/hydrate-memberships", // Glofox per-member hydrate (CRON_SECRET)
];

// Cron endpoints are secured by x-cron-secret header, not user auth
const CRON_API_PREFIX = "/api/cron/";

function isPublicRoute(pathname: string): boolean {
  return (
    PUBLIC_ROUTES.some((route) => pathname.startsWith(route)) ||
    PUBLIC_API_ROUTES.some((route) => pathname.startsWith(route)) ||
    pathname.startsWith(CRON_API_PREFIX) ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  );
}

export async function proxy(request: NextRequest) {
  // Refresh the auth session on every request
  //
  // RLS STATUS: 11 Phase 2 tables (campaigns, leads, content_posts, etc.) use
  // `current_setting('app.studio_id')::uuid` in RLS policies. Server-side
  // route handlers use the anon key (not service-role), so RLS IS enforced.
  // All queries already filter by studio_id manually as a defense-in-depth
  // measure. A `setRlsContext()` helper is available in @/lib/supabase/server
  // for routes that need to set the context explicitly. Phase 5 requires
  // creating a `set_studio_context(uuid)` Postgres function via migration:
  //
  //   CREATE OR REPLACE FUNCTION set_studio_context(studio_id uuid)
  //   RETURNS void LANGUAGE plpgsql AS $$
  //   BEGIN SET LOCAL app.studio_id = studio_id::text; END; $$;
  //
  const response = await updateSession(request);

  const { pathname } = request.nextUrl;

  // Allow public routes through without auth check
  if (isPublicRoute(pathname)) {
    return response;
  }

  // For protected routes, check if user is authenticated
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          // No-op: cookies already handled by updateSession
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Unauthenticated API requests get a JSON 401 (not a redirect)
  if (!user && pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Redirect unauthenticated users to login for protected page routes
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files and images.
     * This includes all routes under /(admin) and /(employee).
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
