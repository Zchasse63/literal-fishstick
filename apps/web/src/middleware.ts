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

export async function middleware(request: NextRequest) {
  // Refresh the auth session on every request
  //
  // TODO(RLS): Phase 2+ tables use `current_setting('app.studio_id')::uuid` in
  // RLS policies, but server-side route handlers use a service-role client that
  // bypasses RLS entirely. All queries already filter by studio_id manually.
  // When client-side access is added in Phase 5, RLS policies must be rewritten
  // to use `auth.uid()` or `current_setting('app.studio_id')` must be set via
  // a Supabase `set_config` call before each request.
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
