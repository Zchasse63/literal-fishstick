/**
 * Playwright auth setup — creates real Supabase sessions for E2E tests.
 *
 * Uses @supabase/ssr cookie-based auth. Signs in via GoTrue REST API,
 * then sets the session cookie directly on the browser context.
 *
 * IMPORTANT — BUG-007 fix: the test admin/employee profiles MUST be in
 * `E2E_STUDIO_ID` (which resolves to `DEFAULT_STUDIO_ID` until BUG-001 is
 * fixed). The admin UI hardcodes `DEFAULT_STUDIO_ID` for all data reads,
 * and RLS policies on `profiles`/`members` use `get_user_studio_id()` —
 * so if the auth user sits in a different studio, every data-bound query
 * from the browser client silently returns empty rows. Earlier smoke tiers
 * didn't exercise data reads, which is why this stayed hidden until
 * Tier 3.1 (Record Payment).
 */
import { test as setup, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import path from 'path'
import { E2E_STUDIO_ID } from './fixtures/test-data'

// Load real env vars
config({ path: path.resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
const projectRef = new URL(supabaseUrl).hostname.split('.')[0]

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const ADMIN_EMAIL = 'meridian-e2e-admin@test.meridian.app'
const ADMIN_PASSWORD = 'e2e-test-admin-password-2026!'
const EMPLOYEE_EMAIL = 'meridian-e2e-employee@test.meridian.app'
const EMPLOYEE_PASSWORD = 'e2e-test-employee-password-2026!'
const TEST_STUDIO_ID = E2E_STUDIO_ID

async function ensureTestUser(
  email: string,
  password: string,
  roles: string[],
  fullName: string
) {
  const { data: existingUsers } = await supabase.auth.admin.listUsers()
  const existing = existingUsers?.users?.find((u) => u.email === email)

  let userId: string

  if (existing) {
    userId = existing.id
    await supabase.auth.admin.updateUserById(userId, { password })
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (error) throw new Error(`Failed to create test user ${email}: ${error.message}`)
    userId = data.user.id
  }

  // Ensure studio exists (FK target). Use ignoreDuplicates so we never
  // overwrite the name/slug of a pre-existing studio — DEFAULT_STUDIO_ID
  // is "The Sauna Guys" in dev data and must not be renamed to "E2E Test
  // Studio" on every auth-setup run. See BUG-007 for why this matters.
  await supabase.from('studios').upsert(
    {
      id: TEST_STUDIO_ID,
      name: 'E2E Test Studio',
      slug: 'e2e-test-studio',
      timezone: 'America/New_York',
      settings: {},
    },
    { onConflict: 'id', ignoreDuplicates: true },
  )

  // Ensure profile exists
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  if (!profile) {
    await supabase.from('profiles').insert({
      id: userId,
      email,
      full_name: fullName,
      roles,
      studio_id: TEST_STUDIO_ID,
    })
  } else {
    await supabase
      .from('profiles')
      .update({ roles, studio_id: TEST_STUDIO_ID, full_name: fullName })
      .eq('id', userId)
  }

  return userId
}

/**
 * Sign in via Supabase GoTrue REST API and get session tokens.
 */
async function signInViaRest(email: string, password: string) {
  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': anonKey,
    },
    body: JSON.stringify({ email, password }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Sign-in failed for ${email}: ${res.status} ${body}`)
  }

  return res.json()
}

/**
 * Set Supabase SSR auth cookies on the browser context.
 * @supabase/ssr stores the session in cookies named `sb-<ref>-auth-token`.
 * Large tokens are chunked into .0, .1, etc.
 */
function setSupabaseCookies(
  page: import('@playwright/test').Page,
  session: Record<string, unknown>
) {
  const cookieName = `sb-${projectRef}-auth-token`
  const sessionJson = JSON.stringify(session)

  // @supabase/ssr may use base64 encoding for cookie value
  // Chunk into 3500-byte cookies if needed (browser cookie size limit)
  const CHUNK_SIZE = 3500
  const cookies: Array<{
    name: string
    value: string
    domain: string
    path: string
    httpOnly: boolean
    secure: boolean
    sameSite: 'Lax' | 'Strict' | 'None'
  }> = []

  if (sessionJson.length <= CHUNK_SIZE) {
    cookies.push({
      name: cookieName,
      value: sessionJson,
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    })
  } else {
    // Chunk the session data
    const chunks = Math.ceil(sessionJson.length / CHUNK_SIZE)
    for (let i = 0; i < chunks; i++) {
      cookies.push({
        name: `${cookieName}.${i}`,
        value: sessionJson.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
        domain: 'localhost',
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      })
    }
  }

  return page.context().addCookies(cookies)
}

setup('create admin session', async ({ page }) => {
  await ensureTestUser(ADMIN_EMAIL, ADMIN_PASSWORD, ['owner'], 'E2E Admin')

  const session = await signInViaRest(ADMIN_EMAIL, ADMIN_PASSWORD)

  // Set the auth cookie before navigating
  await setSupabaseCookies(page, session)

  // Navigate to root — middleware should see the cookie and allow access
  await page.goto('/')
  await page.waitForTimeout(2000)

  // Verify we're authenticated (not redirected to login)
  const url = page.url()
  if (url.includes('/login')) {
    // Fallback: try setting in localStorage too (some apps check both)
    await page.goto('/login')
    const storageKey = `sb-${projectRef}-auth-token`
    await page.evaluate(
      ({ key, value }) => { localStorage.setItem(key, value) },
      { key: storageKey, value: JSON.stringify(session) },
    )
    await page.goto('/')
    await page.waitForTimeout(2000)
  }

  // Save auth state (cookies + localStorage)
  await page.context().storageState({ path: 'e2e/.auth/admin.json' })
})

setup('create employee session', async ({ page }) => {
  await ensureTestUser(EMPLOYEE_EMAIL, EMPLOYEE_PASSWORD, ['trainer'], 'E2E Trainer')

  const session = await signInViaRest(EMPLOYEE_EMAIL, EMPLOYEE_PASSWORD)

  await setSupabaseCookies(page, session)

  await page.goto('/employee')
  await page.waitForTimeout(2000)

  const url = page.url()
  if (url.includes('/login')) {
    await page.goto('/login')
    const storageKey = `sb-${projectRef}-auth-token`
    await page.evaluate(
      ({ key, value }) => { localStorage.setItem(key, value) },
      { key: storageKey, value: JSON.stringify(session) },
    )
    await page.goto('/employee')
    await page.waitForTimeout(2000)
  }

  await page.context().storageState({ path: 'e2e/.auth/employee.json' })
})
