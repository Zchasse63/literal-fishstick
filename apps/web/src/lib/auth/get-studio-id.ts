/**
 * Shared utility for resolving studio_id from a user profile.
 *
 * By default, falls back to DEFAULT_STUDIO_ID for backward compatibility.
 * Pass `{ required: true }` to fail-closed (returns `null` when no studio is
 * resolvable) -- use this in security-sensitive contexts like RLS-dependent
 * queries where a wrong studio_id could leak data. See MED-005.
 *
 * TODO: Migrate all route handlers to use this utility instead of inline
 * fallback logic. See MED-008 for the full list of routes to update.
 */

import { DEFAULT_STUDIO_ID } from '@/lib/constants'

export function getStudioId(
  profile: { studio_id?: string | null },
  opts?: { required?: boolean },
): string | null {
  const studioId =
    profile?.studio_id ||
    process.env.DEFAULT_STUDIO_ID ||
    null;

  if (!studioId) {
    if (opts?.required) return null; // fail-closed: caller must handle null
    return DEFAULT_STUDIO_ID; // backward compat: permissive fallback
  }

  return studioId;
}
