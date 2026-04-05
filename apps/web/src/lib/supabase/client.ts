import { createBrowserClient as _createBrowserClient } from "@supabase/ssr";

let _client: ReturnType<typeof _createBrowserClient> | null = null;

export function createBrowserClient() {
  if (_client) return _client;

  _client = _createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
  );

  return _client;
}

/**
 * Checks a Supabase response for auth errors (PGRST 401, JWT expired, etc.)
 * and redirects to /login if the session has expired.
 * Call this after any Supabase query that might fail due to auth.
 */
export function handleSupabaseAuthError(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  const msg = error.message?.toLowerCase() ?? '';
  const code = error.code ?? '';
  const isAuthError =
    code === 'PGRST301' ||
    code === '401' ||
    msg.includes('jwt expired') ||
    msg.includes('jwt') && msg.includes('invalid') ||
    msg.includes('not authenticated') ||
    msg.includes('no api key');

  if (isAuthError && typeof window !== 'undefined') {
    window.location.href = '/login';
    return true;
  }
  return false;
}
