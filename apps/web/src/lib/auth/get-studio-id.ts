/**
 * Shared utility for resolving studio_id from a user profile.
 *
 * TODO: Migrate all route handlers to use this utility instead of inline
 * fallback logic. See MED-008 for the full list of routes to update.
 */

export function getStudioId(profile: { studio_id?: string | null }): string {
  return (
    profile?.studio_id ||
    process.env.DEFAULT_STUDIO_ID ||
    '11111111-1111-1111-1111-111111111111'
  );
}
