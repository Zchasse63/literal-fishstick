/**
 * Integration test setup — loads REAL environment variables.
 * No mocks. No fakes. Tests hit live Supabase and Anthropic.
 */
import { config } from 'dotenv'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

// Load .env.local from the web app root
config({ path: path.resolve(__dirname, '../../../.env.local') })

// Validate required env vars are present
const REQUIRED_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
]

for (const varName of REQUIRED_VARS) {
  if (!process.env[varName]) {
    throw new Error(
      `Integration test setup: Missing required env var ${varName}. ` +
      `Ensure .env.local exists at apps/web/.env.local with real credentials.`
    )
  }
}

// Set test studio ID — all test data is scoped to this studio
export const TEST_STUDIO_ID = '00000000-0000-4000-a000-000000000000'
process.env.DEFAULT_STUDIO_ID = TEST_STUDIO_ID

// Ensure the test studio row exists (FK target for profiles, members, etc.)
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

const { error } = await db.from('studios').upsert(
  {
    id: TEST_STUDIO_ID,
    name: 'Integration Test Studio',
    slug: 'integration-test-studio',
    timezone: 'America/New_York',
    settings: {},
  },
  { onConflict: 'id' },
)

if (error) {
  console.warn(`[setup] Warning: Could not ensure test studio exists: ${error.message}`)
}
