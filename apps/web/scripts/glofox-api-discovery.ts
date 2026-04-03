/**
 * Glofox API Endpoint Discovery
 *
 * Brute-force discovery of all available Glofox REST API endpoints.
 * Tries every combination of API version prefix + resource noun.
 * Logs any endpoint that returns non-404.
 *
 * Usage: npx tsx scripts/glofox-api-discovery.ts
 */

const BASE_URL = 'https://gf-api.aws.glofox.com/prod/'
const API_TOKEN = process.env.GLOFOX_API_TOKEN!
const API_KEY = process.env.GLOFOX_API_KEY!
const BRANCH_ID = process.env.GLOFOX_BRANCH_ID!

const headers: Record<string, string> = {
  'x-glofox-api-token': API_TOKEN,
  'x-api-key': API_KEY,
  'x-glofox-branch-id': BRANCH_ID,
  'Content-Type': 'application/json',
  Accept: 'application/json',
}

// Rate limiting
let requestCount = 0
async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function probe(method: string, path: string): Promise<{
  path: string
  method: string
  status: number
  found: boolean
  preview: string
}> {
  const url = `${BASE_URL}${path}`
  requestCount++

  // Pace ourselves — 5 requests per second max
  if (requestCount % 5 === 0) await sleep(250)

  try {
    const res = await fetch(url, { method, headers })
    const text = await res.text()

    // Consider it "found" if it's not a 404 and not a generic "Route not found"
    const is404 = res.status === 404
    const isRouteNotFound = text.includes('"Route not found"') || text.includes('could not be found')
    const found = !is404 && !isRouteNotFound

    let preview = ''
    if (found) {
      try {
        const json = JSON.parse(text)
        preview = JSON.stringify(json, null, 2).substring(0, 2000)
      } catch {
        preview = text.substring(0, 500)
      }
    }

    return { path, method, status: res.status, found, preview }
  } catch (err: any) {
    return { path, method, status: 0, found: false, preview: `Error: ${err.message}` }
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('  GLOFOX API ENDPOINT DISCOVERY')
  console.log(`  Branch ID: ${BRANCH_ID}`)
  console.log(`  Started: ${new Date().toISOString()}`)
  console.log('═══════════════════════════════════════════════════════════\n')

  // ─── Resource nouns to try ──────────────────────────────────
  const resources = [
    // Core entities
    'members', 'staff', 'events', 'bookings', 'transactions',
    'memberships', 'credits', 'leads', 'products', 'waivers',
    'agreements', 'linked-accounts',
    // Scheduling / Classes
    'classes', 'courses', 'appointments', 'schedules', 'schedule',
    'programs', 'sessions', 'timetable', 'timetables',
    'facilities', 'rooms', 'resources',
    // Financial
    'payments', 'payment-methods', 'invoices', 'refunds',
    'subscriptions', 'plans', 'pricing', 'price-breakdown',
    'billing', 'charges', 'receipts', 'taxes',
    // Discounts / Promos (we know discounts works on 2.2)
    'discounts', 'discount-codes', 'promo-codes', 'promotions',
    'coupons', 'vouchers', 'offers', 'deals',
    // Members / CRM
    'users', 'contacts', 'families', 'dependents',
    'segments', 'tags', 'notes', 'communications',
    'notifications', 'messages', 'emails',
    // Attendance / Check-in
    'attendance', 'check-ins', 'checkins', 'check-in',
    'visits', 'access', 'access-logs', 'access-log',
    'kiosk', 'barcode', 'qr',
    // Analytics / Reports
    'analytics', 'reports', 'metrics', 'dashboard',
    'statistics', 'stats', 'insights', 'summary',
    'revenue', 'sales', 'performance',
    'trainer-performance', 'staff-performance',
    // Settings / Config
    'settings', 'config', 'configuration', 'preferences',
    'branches', 'locations', 'studios',
    'branding', 'theme', 'customization',
    // Integrations
    'integrations', 'webhooks', 'api-keys', 'tokens',
    'stripe', 'payment-gateway', 'gateways',
    // Content / Media
    'images', 'media', 'files', 'documents', 'uploads',
    // Waitlist
    'waitlist', 'waitlists', 'waiting-list', 'waiting-lists',
    // Inventory / Merch
    'inventory', 'merchandise', 'merch', 'shop', 'store',
    'orders', 'cart', 'checkout',
    // Misc
    'categories', 'types', 'statuses', 'roles',
    'permissions', 'audit-log', 'activity', 'activity-log',
    'features', 'capabilities', 'version', 'health', 'ping',
    'countries', 'currencies', 'timezones', 'languages',
    // Terms / Legal
    'terms', 'terms-conditions', 'privacy', 'consent',
    // Gift cards
    'gift-cards', 'giftcards', 'gift-certificates', 'vouchers',
    // Automation / Marketing
    'automations', 'campaigns', 'templates', 'triggers',
    'workflows', 'rules', 'actions',
    // Reviews / Feedback
    'reviews', 'feedback', 'ratings', 'surveys',
    // Goals / Challenges
    'goals', 'challenges', 'achievements', 'rewards', 'loyalty',
    'points', 'badges',
  ]

  // ─── URL patterns to try for each resource ──────────────────
  const patterns = [
    // No branch prefix
    (r: string) => `2.0/${r}`,
    (r: string) => `2.1/${r}`,
    (r: string) => `2.2/${r}`,
    (r: string) => `3.0/${r}`,
    (r: string) => `v3.0/${r}`,
    (r: string) => `${r}`,
    // Branch-scoped
    (r: string) => `2.0/branches/${BRANCH_ID}/${r}`,
    (r: string) => `2.1/branches/${BRANCH_ID}/${r}`,
    (r: string) => `2.2/branches/${BRANCH_ID}/${r}`,
    (r: string) => `3.0/branches/${BRANCH_ID}/${r}`,
    // Location-scoped (v3 pattern)
    (r: string) => `v3.0/locations/${BRANCH_ID}/${r}`,
    (r: string) => `3.0/locations/${BRANCH_ID}/${r}`,
  ]

  // ─── Also try known standalone paths ──────────────────────
  const standalonePaths = [
    'TermsConditions/view',
    'Analytics/report',
    'Analytics/members',
    'Analytics/revenue',
    'Analytics/bookings',
    'Analytics/attendance',
    'Analytics/retention',
    'Analytics/churn',
    'Analytics/growth',
    'Analytics/classes',
    'Analytics/trainers',
    'Analytics/products',
    'Analytics/subscriptions',
    'Analytics/payments',
    'Analytics/discounts',
    `2.0/analytics/trainer-performance`,
    `2.0/analytics/member-retention`,
    `2.0/analytics/revenue`,
    `2.0/analytics/attendance`,
    `2.0/analytics/bookings`,
    `2.0/analytics/classes`,
    `2.0/analytics/overview`,
    `2.0/analytics/summary`,
    `2.0/analytics/dashboard`,
    `2.0/register`,
    `2.0/login`,
    `2.0/auth`,
    `2.0/me`,
    `2.2/users/${BRANCH_ID}/linked-accounts`,
  ]

  const found: Array<{ path: string; method: string; status: number; preview: string }> = []
  const alreadyKnown = new Set<string>()

  // Track what we already have in our client
  const knownEndpoints = [
    '2.0/members', '2.0/staff', '2.0/events', '2.0/memberships',
    '2.0/credits', `2.2/branches/${BRANCH_ID}/bookings`,
    'Analytics/report', 'TermsConditions/view',
    `2.1/branches/${BRANCH_ID}/leads/filter`,
    `2.2/branches/${BRANCH_ID}/discounts`,
    `2.0/analytics/trainer-performance`,
    `2.2/branches/${BRANCH_ID}/users`,
  ]
  knownEndpoints.forEach(e => alreadyKnown.add(e))

  let total = 0
  const totalToProbe = resources.length * patterns.length + standalonePaths.length

  // Probe all resource + pattern combos
  for (const resource of resources) {
    for (const pattern of patterns) {
      const path = pattern(resource)
      total++
      if (total % 50 === 0) {
        console.log(`  Progress: ${total}/${totalToProbe} probed, ${found.length} found so far...`)
      }

      const result = await probe('GET', path)
      if (result.found) {
        const isKnown = alreadyKnown.has(path)
        const tag = isKnown ? ' [ALREADY KNOWN]' : ' [NEW!]'
        console.log(`\n  ✅ FOUND: GET ${path} → ${result.status}${tag}`)
        if (!isKnown) {
          console.log(`  Preview:\n${result.preview}\n`)
        }
        found.push({ path, method: 'GET', status: result.status, preview: result.preview })
      }
    }
  }

  // Probe standalone paths
  for (const path of standalonePaths) {
    total++
    const result = await probe('GET', path)
    if (result.found) {
      const isKnown = alreadyKnown.has(path)
      const tag = isKnown ? ' [ALREADY KNOWN]' : ' [NEW!]'
      console.log(`\n  ✅ FOUND: GET ${path} → ${result.status}${tag}`)
      if (!isKnown) {
        console.log(`  Preview:\n${result.preview}\n`)
      }
      found.push({ path, method: 'GET', status: result.status, preview: result.preview })
    }
  }

  // Also try POST on analytics paths (Glofox uses POST for some analytics)
  const postPaths = [
    'Analytics/report',
    'Analytics/members',
    'Analytics/revenue',
    'Analytics/bookings',
    'Analytics/attendance',
    'Analytics/retention',
    'Analytics/churn',
    'Analytics/overview',
    `2.1/branches/${BRANCH_ID}/leads/filter`,
    `2.2/branches/${BRANCH_ID}/leads/filter`,
    `2.0/branches/${BRANCH_ID}/leads/filter`,
    `2.1/branches/${BRANCH_ID}/price-breakdown`,
    `2.2/branches/${BRANCH_ID}/price-breakdown`,
  ]

  for (const path of postPaths) {
    const result = await probe('POST', path)
    if (result.found) {
      const isKnown = alreadyKnown.has(path)
      const tag = isKnown ? ' [ALREADY KNOWN]' : ' [NEW!]'
      console.log(`\n  ✅ FOUND: POST ${path} → ${result.status}${tag}`)
      if (!isKnown) {
        console.log(`  Preview:\n${result.preview}\n`)
      }
      found.push({ path, method: 'POST', status: result.status, preview: result.preview })
    }
  }

  // ─── Summary ────────────────────────────────────────────────
  console.log('\n\n═══════════════════════════════════════════════════════════')
  console.log('  DISCOVERY COMPLETE')
  console.log(`  Total probed: ${total + postPaths.length}`)
  console.log(`  Total found: ${found.length}`)
  console.log('═══════════════════════════════════════════════════════════\n')

  console.log('  ALL DISCOVERED ENDPOINTS:\n')
  const newEndpoints = found.filter(f => !alreadyKnown.has(f.path))
  const knownFound = found.filter(f => alreadyKnown.has(f.path))

  if (knownFound.length > 0) {
    console.log('  ── Already in our client ──')
    for (const ep of knownFound) {
      console.log(`    ${ep.method} ${ep.path} → ${ep.status}`)
    }
  }

  if (newEndpoints.length > 0) {
    console.log('\n  ── NEW / MISSING FROM OUR CLIENT ──')
    for (const ep of newEndpoints) {
      console.log(`    ${ep.method} ${ep.path} → ${ep.status}`)
    }
  } else {
    console.log('\n  No new endpoints discovered beyond what we already have.')
  }

  console.log(`\n  Finished: ${new Date().toISOString()}`)
}

main().catch(console.error)
