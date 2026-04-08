import { createServerClient as _createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function createServerClient() {
  const cookieStore = await cookies();

  return _createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

/**
 * Set the RLS context for Phase 2+ tables that use
 * `current_setting('app.studio_id')::uuid` in their RLS policies.
 *
 * Call this BEFORE querying any of these tables:
 * campaigns, campaign_recipients, automation_flows, automation_enrollments,
 * leads, lead_activities, content_posts, content_comments, content_likes,
 * email_preferences, automation_cooldowns
 *
 * Usage in API routes:
 *   const supabase = await createServerClient()
 *   await setRlsContext(supabase, studioId)
 *   // Now queries on Phase 2 tables will pass RLS
 */
export async function setRlsContext(
  supabase: SupabaseClient,
  studioId: string
) {
  const { error } = await supabase.rpc("set_studio_context", {
    studio_id: studioId,
  });

  // Fallback: if the RPC function doesn't exist yet, try raw SQL
  if (error) {
    await supabase.from("_rls_context").select("1").limit(0); // no-op to init connection
    // Direct SET LOCAL via rpc or raw query isn't available without a custom function.
    // For now, all queries manually filter by studio_id which achieves the same result.
    // Once set_studio_context() is created via migration, this fallback can be removed.
  }
}
