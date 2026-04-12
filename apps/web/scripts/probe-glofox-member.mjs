#!/usr/bin/env node
/**
 * Probe the Glofox `GET /2.0/members/{userId}` endpoint to see exactly
 * what fields come back for an active member. Used to diagnose why the
 * embedded `membership` field is missing for ~985 active members in
 * our DB despite the list endpoint returning `status: ACTIVE` for them.
 *
 * Usage:
 *   cd apps/web && node scripts/probe-glofox-member.mjs
 *
 * Reads GLOFOX_API_TOKEN, GLOFOX_API_KEY, GLOFOX_BRANCH_ID from .env.local.
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// Load .env.local manually
function loadEnv() {
  const env = {}
  try {
    const raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      env[key] = value
    }
  } catch (err) {
    console.error('Failed to load .env.local:', err.message)
    process.exit(1)
  }
  return env
}

const env = loadEnv()

const apiToken = env.GLOFOX_API_TOKEN
const apiKey = env.GLOFOX_API_KEY
const branchId = env.GLOFOX_BRANCH_ID
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!apiToken || !apiKey || !branchId) {
  console.error('Missing GLOFOX_API_TOKEN/GLOFOX_API_KEY/GLOFOX_BRANCH_ID')
  process.exit(1)
}

const BASE_URL = 'https://gf-api.aws.glofox.com/prod/'

async function glofoxGet(path) {
  const url = `${BASE_URL}${path}`
  const res = await fetch(url, {
    headers: {
      'x-glofox-api-token': apiToken,
      'x-api-key': apiKey,
      'x-glofox-branch-id': branchId,
      Accept: 'application/json',
    },
  })
  const text = await res.text()
  try {
    return { status: res.status, data: JSON.parse(text) }
  } catch {
    return { status: res.status, data: text }
  }
}

// ── Step 1: Pick 3 active members from Supabase ──────────────
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Probe a mix: known-subscriber (plan_code = 10-class), plus one random
// member with a plan_code set, plus the 2024-08-10 upfront signup if we
// can identify them by their joined_at date.
const probeTargets = []

// Known subscriber: Benjamin Bunn on the 10-class plan at $180 in our DB
const { data: knownSub } = await supabase
  .from('members')
  .select('id, profile_id, glofox_id, plan_code, plan_price, membership_status')
  .eq('plan_code', '1713229608307')
  .limit(1)
if (knownSub?.[0]) probeTargets.push({ label: 'Benjamin Bunn (known 10-class)', ...knownSub[0] })

// Any member with a populated plan_code that's NOT the 10-class plan
const { data: otherSub } = await supabase
  .from('members')
  .select('id, profile_id, glofox_id, plan_code, plan_price, membership_status')
  .not('plan_code', 'is', null)
  .neq('plan_code', '1713229608307')
  .limit(1)
if (otherSub?.[0]) probeTargets.push({ label: 'Other subscriber', ...otherSub[0] })

// A random active payg member for comparison
const { data: paygMember } = await supabase
  .from('members')
  .select('id, profile_id, glofox_id, plan_code, plan_price, membership_status')
  .eq('membership_status', 'active')
  .is('plan_code', null)
  .not('glofox_id', 'is', null)
  .order('created_at', { ascending: false })
  .limit(1)
if (paygMember?.[0]) probeTargets.push({ label: 'Active PAYG (comparison)', ...paygMember[0] })

const candidates = probeTargets

if (!candidates || candidates.length === 0) {
  console.error('No candidates found')
  process.exit(1)
}

console.log(`\n=== Probing ${candidates.length} active-but-planless members ===\n`)

for (const member of candidates) {
  const glofoxId = member.glofox_id
  console.log(`\n─── ${member.label}  glofox_id=${glofoxId}  db_plan_code=${member.plan_code}  db_plan_price=${member.plan_price} ───`)

  // Try GET /2.0/members/{userId}
  console.log('\n1. GET /2.0/members/{id}')
  const r1 = await glofoxGet(`2.0/members/${glofoxId}`)
  console.log(`   Status: ${r1.status}`)
  if (r1.status === 200 && typeof r1.data === 'object') {
    console.log(`   active: ${r1.data.active}, type: ${r1.data.type}`)
    console.log(`   membership: ${JSON.stringify(r1.data.membership ?? '[missing]')}`)
    const purchases = r1.data.MEMBERPURCHASE
    const paygPayments = r1.data.PAYGPAYMENT
    if (Array.isArray(purchases)) {
      console.log(`   MEMBERPURCHASE count: ${purchases.length}`)
      if (purchases.length > 0) {
        console.log(`   MEMBERPURCHASE[0] keys: ${JSON.stringify(Object.keys(purchases[0]).sort())}`)
        console.log(`   MEMBERPURCHASE[0]: ${JSON.stringify(purchases[0]).slice(0, 600)}`)
      }
    }
    if (Array.isArray(paygPayments)) {
      console.log(`   PAYGPAYMENT count: ${paygPayments.length}`)
      if (paygPayments.length > 0) {
        console.log(`   PAYGPAYMENT[0] keys: ${JSON.stringify(Object.keys(paygPayments[0]).sort())}`)
        console.log(`   PAYGPAYMENT[0]: ${JSON.stringify(paygPayments[0]).slice(0, 600)}`)
      }
    }
  } else {
    console.log(`   Body: ${JSON.stringify(r1.data).slice(0, 400)}`)
  }

  // Try alternative: GET /2.1/branches/{branchId}/users?filters[email]=...
  // This is the "search members by email" endpoint which might return more
  // populated objects than the plain getMember.
  // Skipping for now — we'd need the email.

  // Try GET /2.0/credits?user_id=X (which returns credit packs AND includes membership_id/membership_name)
  console.log('\n2. GET /2.0/credits?user_id={id}')
  const r2 = await glofoxGet(`2.0/credits?user_id=${glofoxId}`)
  console.log(`   Status: ${r2.status}`)
  if (r2.status === 200 && typeof r2.data === 'object') {
    const arr = Array.isArray(r2.data) ? r2.data : (r2.data.data ?? r2.data.credits ?? [])
    console.log(`   Count: ${arr.length}`)
    if (arr.length > 0) {
      console.log(`   Sample keys: ${JSON.stringify(Object.keys(arr[0]).sort())}`)
      console.log(`   First row: ${JSON.stringify(arr[0]).slice(0, 500)}`)
    }
  } else {
    console.log(`   Body: ${JSON.stringify(r2.data).slice(0, 300)}`)
  }

  // Try: /2.0/members (list, one user only via filter)
  // no-op for now — we already know list returns sparse

  // Wait between calls to respect rate limit
  await new Promise((r) => setTimeout(r, 300))
}

console.log('\n=== Done ===\n')
