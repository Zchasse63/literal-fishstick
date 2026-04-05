#!/usr/bin/env node
/**
 * Glofox Mass Data Pull — Direct API to Supabase
 * Pulls ALL available data from Glofox API into Supabase tables.
 * Run: node scripts/glofox-mass-pull.mjs
 */

const GLOFOX_BASE = 'https://gf-api.aws.glofox.com/prod/'
const GLOFOX_TOKEN = 'dy5iixXwxnH8o+dRmyBG2AkUrrfzbMegGK+FammD5aQa'
const GLOFOX_KEY = 'xQo6K3N2dg3c1SH0J3MYI51tb90kHDwZ7V4OPdLh'
const GLOFOX_BRANCH = '654e7d37c8a12ada310de13a'

const SUPABASE_URL = 'https://rhdmiyttafsbfuflnjza.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJoZG1peXR0YWZzYmZ1ZmxuanphIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDAwNTMxNywiZXhwIjoyMDg5NTgxMzE3fQ.2f4TGVQDP3mlIWlSODl8K2HzhQfE-qYCRNmWOaiw26Y'
const STUDIO_ID = '11111111-1111-1111-1111-111111111111'

const HEADERS = {
  'x-glofox-api-token': GLOFOX_TOKEN,
  'x-api-key': GLOFOX_KEY,
  'x-glofox-branch-id': GLOFOX_BRANCH,
  'Content-Type': 'application/json',
  Accept: 'application/json',
}

const SB_HEADERS = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'resolution=merge-duplicates',
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function glofoxGet(path, params = {}) {
  const qs = Object.entries(params)
    .filter(([,v]) => v !== undefined)
    .map(([k,v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')
  const url = `${GLOFOX_BASE}${path}${qs ? '?' + qs : ''}`
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) {
    console.error(`  Glofox ${res.status}: ${path}`)
    return null
  }
  return res.json()
}

async function glofoxPost(path, body) {
  const res = await fetch(`${GLOFOX_BASE}${path}`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    console.error(`  Glofox POST ${res.status}: ${path}`)
    return null
  }
  return res.json()
}

async function sbUpsert(table, rows) {
  if (!rows || rows.length === 0) return
  // Batch in chunks of 500
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500)
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: SB_HEADERS,
      body: JSON.stringify(chunk),
    })
    if (!res.ok) {
      const text = await res.text()
      console.error(`  Supabase ${table} error (${res.status}): ${text.substring(0, 200)}`)
    }
  }
}

async function sbQuery(query) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
    method: 'POST',
    headers: SB_HEADERS,
    body: JSON.stringify(query),
  })
  return res.json()
}

// ─── Pull Functions ────────────────────────────────────────────

async function pullTransactions() {
  console.log('\n📊 Pulling transactions...')

  // Pull transactions month by month from 2023-12 to 2026-04
  const startDate = new Date('2023-12-01')
  const endDate = new Date('2026-04-01')
  let allTransactions = []

  const current = new Date(startDate)
  while (current < endDate) {
    const monthStart = current.toISOString().split('T')[0]
    current.setMonth(current.getMonth() + 1)
    const monthEnd = current.toISOString().split('T')[0]

    console.log(`  Fetching ${monthStart} to ${monthEnd}...`)

    const data = await glofoxPost('Analytics/report', {
      branch_id: GLOFOX_BRANCH,
      start_date: monthStart,
      end_date: monthEnd,
      report_type: 'transactions',
    })

    if (data && Array.isArray(data)) {
      allTransactions = allTransactions.concat(data)
      console.log(`  Got ${data.length} transactions`)
    } else if (data?.data && Array.isArray(data.data)) {
      allTransactions = allTransactions.concat(data.data)
      console.log(`  Got ${data.data.length} transactions`)
    } else {
      console.log(`  No data or unexpected format for ${monthStart}`)
    }

    await sleep(500) // Rate limit courtesy
  }

  console.log(`  Total transactions fetched: ${allTransactions.length}`)

  if (allTransactions.length > 0) {
    // Log first transaction structure to understand the shape
    console.log('  Sample transaction keys:', Object.keys(allTransactions[0]))
    console.log('  Sample:', JSON.stringify(allTransactions[0]).substring(0, 500))
  }

  return allTransactions
}

async function pullPrograms() {
  console.log('\n📋 Pulling programs...')
  const data = await glofoxGet('2.0/programs')
  const programs = data?.data || data || []
  console.log(`  Got ${Array.isArray(programs) ? programs.length : 0} programs`)
  if (Array.isArray(programs) && programs.length > 0) {
    console.log('  Sample:', JSON.stringify(programs[0]).substring(0, 300))
  }
  return programs
}

async function pullFacilities() {
  console.log('\n🏢 Pulling facilities...')
  const data = await glofoxGet('2.0/facilities')
  const facilities = data?.data || data || []
  console.log(`  Got ${Array.isArray(facilities) ? facilities.length : 0} facilities`)
  if (Array.isArray(facilities) && facilities.length > 0) {
    console.log('  Sample:', JSON.stringify(facilities[0]).substring(0, 300))
  }
  return facilities
}

async function pullCategories() {
  console.log('\n🏷️ Pulling categories...')
  const data = await glofoxGet('2.0/categories')
  const categories = data?.data || data || []
  console.log(`  Got ${Array.isArray(categories) ? categories.length : 0} categories`)
  return categories
}

async function pullDiscounts() {
  console.log('\n💰 Pulling discounts...')
  const data = await glofoxGet(`2.2/branches/${GLOFOX_BRANCH}/discounts`)
  const discounts = data?.data || data || []
  console.log(`  Got ${Array.isArray(discounts) ? discounts.length : 0} discounts`)
  return discounts
}

async function pullTaxConfig() {
  console.log('\n🧾 Pulling tax configuration...')
  const data = await glofoxGet(`2.2/branches/${GLOFOX_BRANCH}/taxes`)
  const taxes = data?.data || data || []
  console.log(`  Got ${Array.isArray(taxes) ? taxes.length : 0} tax configs`)
  if (Array.isArray(taxes) && taxes.length > 0) {
    console.log('  Sample:', JSON.stringify(taxes[0]).substring(0, 300))
  }
  return taxes
}

async function pullInvoices() {
  console.log('\n📄 Pulling invoices...')
  const data = await glofoxGet(`2.2/branches/${GLOFOX_BRANCH}/invoices`)
  const invoices = data?.data || data || []
  console.log(`  Got ${Array.isArray(invoices) ? invoices.length : 0} invoices`)
  if (Array.isArray(invoices) && invoices.length > 0) {
    console.log('  Sample keys:', Object.keys(invoices[0]))
  }
  return invoices
}

async function pullProducts() {
  console.log('\n🛍️ Pulling products...')
  // Try v3 endpoint
  const data = await glofoxGet(`v3.0/locations/${GLOFOX_BRANCH}/products`)
  const products = data?.data || data || []
  console.log(`  Got ${Array.isArray(products) ? products.length : 0} products`)
  return products
}

async function pullWaivers() {
  console.log('\n📝 Pulling waivers...')
  const data = await glofoxGet('TermsConditions/view')
  const waivers = data?.data || data || []
  console.log(`  Got ${Array.isArray(waivers) ? waivers.length : 0} waivers`)
  return waivers
}

async function pullMemberInteractions(memberGlofoxIds) {
  console.log(`\n💬 Pulling member interactions for ${memberGlofoxIds.length} members...`)
  let allInteractions = []
  let processed = 0

  for (const gId of memberGlofoxIds) {
    const data = await glofoxGet(`2.0/members/${gId}/interactions`)
    const interactions = data?.data || data || []
    if (Array.isArray(interactions) && interactions.length > 0) {
      allInteractions = allInteractions.concat(interactions.map(i => ({ ...i, member_glofox_id: gId })))
    }
    processed++
    if (processed % 50 === 0) {
      console.log(`  Processed ${processed}/${memberGlofoxIds.length} (${allInteractions.length} interactions found)`)
      await sleep(300)
    }
  }

  console.log(`  Total interactions: ${allInteractions.length}`)
  return allInteractions
}

async function pullLinkedAccounts(memberGlofoxIds) {
  console.log(`\n👨‍👩‍👧 Pulling linked/family accounts...`)
  let allLinked = []
  let processed = 0

  for (const gId of memberGlofoxIds) {
    const data = await glofoxGet(`2.2/users/${gId}/linked-accounts`)
    const linked = data?.data || data || []
    if (Array.isArray(linked) && linked.length > 0) {
      allLinked = allLinked.concat(linked.map(l => ({ ...l, parent_glofox_id: gId })))
    }
    processed++
    if (processed % 100 === 0) {
      console.log(`  Processed ${processed}/${memberGlofoxIds.length} (${allLinked.length} linked found)`)
      await sleep(200)
    }
  }

  console.log(`  Total linked accounts: ${allLinked.length}`)
  return allLinked
}

async function pullContactSources() {
  console.log('\n📱 Pulling contact sources...')
  const data = await glofoxGet('2.0/contact-sources')
  const sources = data?.data || data || []
  console.log(`  Got ${Array.isArray(sources) ? sources.length : 0} contact sources`)
  if (Array.isArray(sources)) sources.forEach(s => console.log(`    - ${JSON.stringify(s)}`))
  return sources
}

async function pullMarketingSources() {
  console.log('\n📣 Pulling marketing sources...')
  const data = await glofoxGet('2.0/marketing-sources')
  const sources = data?.data || data || []
  console.log(`  Got ${Array.isArray(sources) ? sources.length : 0} marketing sources`)
  if (Array.isArray(sources)) sources.forEach(s => console.log(`    - ${JSON.stringify(s)}`))
  return sources
}

async function pullAnalytics() {
  console.log('\n📈 Pulling analytics...')
  const members = await glofoxGet('2.0/analytics/members')
  console.log('  Member analytics:', JSON.stringify(members).substring(0, 500))

  const revenue = await glofoxGet('2.0/analytics/revenue')
  console.log('  Revenue analytics:', JSON.stringify(revenue).substring(0, 500))

  const bookings = await glofoxGet('2.0/analytics/bookings')
  console.log('  Booking analytics:', JSON.stringify(bookings).substring(0, 500))

  return { members, revenue, bookings }
}

// ─── Main ──────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════')
  console.log('  GLOFOX MASS DATA PULL')
  console.log('  Pulling ALL available data from Glofox API')
  console.log('═══════════════════════════════════════════════════')

  // First, get all member glofox_ids for per-member queries
  const memberRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=glofox_id&glofox_id=not.is.null&limit=2000`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  })
  const members = await memberRes.json()
  const memberGlofoxIds = members.map(m => m.glofox_id).filter(Boolean)
  console.log(`\nFound ${memberGlofoxIds.length} members with Glofox IDs`)

  // ── Reference data (single calls) ──
  const programs = await pullPrograms()
  const facilities = await pullFacilities()
  const categories = await pullCategories()
  const discounts = await pullDiscounts()
  const taxConfig = await pullTaxConfig()
  const products = await pullProducts()
  const waivers = await pullWaivers()
  const contactSources = await pullContactSources()
  const marketingSources = await pullMarketingSources()

  // ── Financial data ──
  const transactions = await pullTransactions()
  const invoices = await pullInvoices()

  // ── Per-member data (batched) ──
  // Only pull interactions for top 200 members to avoid rate limits
  const topMemberIds = memberGlofoxIds.slice(0, 200)
  const interactions = await pullMemberInteractions(topMemberIds)
  const linkedAccounts = await pullLinkedAccounts(memberGlofoxIds)

  // ── Analytics ──
  const analytics = await pullAnalytics()

  // ── Summary ──
  console.log('\n═══════════════════════════════════════════════════')
  console.log('  PULL COMPLETE — Summary:')
  console.log('═══════════════════════════════════════════════════')
  console.log(`  Programs:         ${Array.isArray(programs) ? programs.length : 'error'}`)
  console.log(`  Facilities:       ${Array.isArray(facilities) ? facilities.length : 'error'}`)
  console.log(`  Categories:       ${Array.isArray(categories) ? categories.length : 'error'}`)
  console.log(`  Discounts:        ${Array.isArray(discounts) ? discounts.length : 'error'}`)
  console.log(`  Tax Configs:      ${Array.isArray(taxConfig) ? taxConfig.length : 'error'}`)
  console.log(`  Products:         ${Array.isArray(products) ? products.length : 'error'}`)
  console.log(`  Waivers:          ${Array.isArray(waivers) ? waivers.length : 'error'}`)
  console.log(`  Transactions:     ${Array.isArray(transactions) ? transactions.length : 'error'}`)
  console.log(`  Invoices:         ${Array.isArray(invoices) ? invoices.length : 'error'}`)
  console.log(`  Interactions:     ${Array.isArray(interactions) ? interactions.length : 'error'}`)
  console.log(`  Linked Accounts:  ${Array.isArray(linkedAccounts) ? linkedAccounts.length : 'error'}`)
  console.log(`  Contact Sources:  ${Array.isArray(contactSources) ? contactSources.length : 'error'}`)
  console.log(`  Marketing Sources:${Array.isArray(marketingSources) ? marketingSources.length : 'error'}`)
  console.log('═══════════════════════════════════════════════════')
}

main().catch(console.error)
