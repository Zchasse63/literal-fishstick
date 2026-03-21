/**
 * Service-role Supabase client for integration tests.
 * Bypasses RLS — used for test data setup and teardown.
 */
import { createClient } from '@supabase/supabase-js'

let _adminClient: ReturnType<typeof createClient> | null = null

export function getAdminClient() {
  if (!_adminClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
    _adminClient = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }
  return _adminClient
}

/**
 * Nuclear cleanup — deletes ALL data for a given studio_id.
 * Call this in afterAll to ensure no test data persists.
 */
export async function cleanupStudioData(studioId: string) {
  const db = getAdminClient()

  // Delete in dependency order (children first)
  const tables = [
    'automation_cooldowns',
    'automation_enrollments',
    'automation_flows',
    'ai_cache',
    'ai_briefings',
    'ai_insights',
    'activity_log',
    'transactions',
    'bookings',
    'waitlist_entries',
    'classes',
    'credit_packs',
    'gift_cards',
    'campaigns',
    'campaign_recipients',
    'leads',
    'content_posts',
    'email_preferences',
    'members',
    'profiles',
  ]

  for (const table of tables) {
    try {
      await db.from(table).delete().eq('studio_id', studioId)
    } catch {
      // Table might not exist or have different schema — skip silently
    }
  }
}
