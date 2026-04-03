/**
 * Shared utility for resolving studio_id from a user profile.
 *
 * TODO: Migrate all route handlers to use this utility instead of inline
 * fallback logic. See MED-008 for the full list of routes to update.
 */

import { DEFAULT_STUDIO_ID } from '@/lib/constants'

export function getStudioId(profile: { studio_id?: string | null }): string {
  return (
    profile?.studio_id ||
    process.env.DEFAULT_STUDIO_ID ||
    DEFAULT_STUDIO_ID
  );
}
