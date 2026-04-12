#!/usr/bin/env node
/**
 * Standalone Glofox membership hydrate script.
 *
 * For each member in Supabase with a glofox_id, fetches the full member
 * record from Glofox via GET /2.0/members/{id}, extracts the embedded
 * membership.subscription details, and upserts into:
 *   - members (backfills plan_code, plan_price, glofox_subscription_id)
 *   - member_subscriptions (historical plan assignment)
 *
 * Bypasses the Next.js dev server entirely so it doesn't fight with
 * Turbopack's incremental compile.
 *
 * Usage:
 *   cd apps/web && node scripts/hydrate-memberships.mjs [--limit=N] [--all]
 *
 * Flags:
 *   --limit=N     Only process N members (for testing)
 *   --all         Process every member; default is only members not already
 *                 hydrated in the last 24h.
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// ─── CLI args ─────────────────────────────────────────────
const args = process.argv.slice(2)
const limitArg = args.find((a) => a.startsWith('--limit='))
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : null
const mode = args.includes('--all') ? 'all' : 'stale'

// ─── Env ─────────────────────────────────────────────────
function loadEnv() {
  const env = {}
  const raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  for (const line of raw.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const k = t.slice(0, eq).trim()
    let v = t.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    env[k] = v
  }
  return env
}

const env = loadEnv()
const STUDIO_ID = '11111111-1111-1111-1111-111111111111'
const BASE_URL = 'https://gf-api.aws.glofox.com/prod/'
const RATE_LIMIT_MS = 150 // ms between Glofox calls

const apiToken = env.GLOFOX_API_TOKEN
const apiKey = env.GLOFOX_API_KEY
const branchId = env.GLOFOX_BRANCH_ID
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!apiToken || !apiKey || !branchId || !supabaseUrl || !serviceKey) {
  console.error('Missing required env vars')
  process.exit(1)
}

// ─── Clients ─────────────────────────────────────────────
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const GLOFOX_HEADERS = {
  'x-glofox-api-token': apiToken,
  'x-api-key': apiKey,
  'x-glofox-branch-id': branchId,
  Accept: 'application/json',
}

async function getMember(glofoxId) {
  const res = await fetch(`${BASE_URL}2.0/members/${glofoxId}`, {
    headers: GLOFOX_HEADERS,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Glofox ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json()
}

// ─── Status mapping ──────────────────────────────────────
const STATUS_MAP = {
  ACTIVE: 'active',
  INACTIVE: 'none',
  CANCELED: 'cancelled',
  CANCELLED: 'cancelled',
  FROZEN: 'paused',
  EXPIRED: 'cancelled',
  PENDING: 'active',
  PAST_DUE: 'past_due',
}

function mapStatus(raw) {
  if (!raw) return 'none'
  return STATUS_MAP[raw] ?? STATUS_MAP[raw.toUpperCase()] ?? 'none'
}

function unixToISO(unix) {
  if (unix == null || unix === 0) return null
  return new Date(unix * 1000).toISOString()
}

// ─── Fetch candidates (with pagination — Supabase default limit is 1000) ──
async function getCandidates() {
  const PAGE_SIZE = 1000
  const all = []
  let offset = 0

  while (true) {
    const { data, error } = await supabase
      .from('members')
      .select('id, profile_id, glofox_id, plan_code, plan_price, membership_status')
      .eq('studio_id', STUDIO_ID)
      .not('glofox_id', 'is', null)
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break

    all.push(...data)
    if (data.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  console.log(`Fetched ${all.length} total members with glofox_id`)

  if (mode === 'stale') {
    // Filter out members already hydrated in the last 24h
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: fresh } = await supabase
      .from('member_subscriptions')
      .select('member_id')
      .eq('studio_id', STUDIO_ID)
      .gte('glofox_synced_at', cutoff)

    const freshIds = new Set((fresh ?? []).map((r) => r.member_id))
    console.log(`Already-hydrated in last 24h: ${freshIds.size}`)

    const filtered = all.filter((m) => !freshIds.has(m.id))
    if (limit) return filtered.slice(0, limit)
    return filtered
  }

  if (limit) return all.slice(0, limit)
  return all
}

// ─── Main loop ───────────────────────────────────────────
async function main() {
  console.log(`\n╔══════════════════════════════════════════════════════════════╗`)
  console.log(`║ Glofox Membership Hydrate — mode=${mode}${limit ? `, limit=${limit}` : ''}`.padEnd(63) + '║')
  console.log(`╚══════════════════════════════════════════════════════════════╝\n`)

  const candidates = await getCandidates()
  console.log(`Selected ${candidates.length} candidate members\n`)

  if (candidates.length === 0) {
    console.log('Nothing to do.')
    return
  }

  const stats = {
    processed: 0,
    hydrated: 0,
    skipped_payg: 0,
    skipped_no_membership: 0,
    errors: 0,
    by_type: {},
    by_price_cents: {},
  }

  const PROGRESS_EVERY = 25
  const errorSamples = []

  for (const member of candidates) {
    stats.processed++

    try {
      const full = await getMember(member.glofox_id)
      const membership = full.membership

      if (!membership) {
        stats.skipped_no_membership++
        continue
      }

      const type = membership.type
      stats.by_type[type || 'unknown'] = (stats.by_type[type || 'unknown'] || 0) + 1

      // Skip pay-as-you-go — no subscription, no plan
      if (type === 'payg' || !membership.plan_code) {
        stats.skipped_payg++
        continue
      }

      const planCode = String(membership.plan_code)
      const rawPrice = membership.plan_price ?? membership.subscription?.price ?? null
      const planPriceCents = rawPrice != null ? Math.round(Number(rawPrice) * 100) : null
      const upfrontCents =
        membership.plan_upfront_fee != null
          ? Math.round(Number(membership.plan_upfront_fee) * 100)
          : null
      const status = mapStatus(membership.status)
      const startedAt = unixToISO(membership.start_date)
      const endedAt = unixToISO(membership.expiry_date)
      const stripeSubId = membership.subscription?.stripe_id ?? null
      const planName = membership.plan_name ?? null
      const membershipName = membership.membership_name ?? null
      const userMembershipId = membership.user_membership_id ?? null

      // Track price distribution for reporting
      if (planPriceCents != null) {
        const priceKey = String(planPriceCents)
        stats.by_price_cents[priceKey] = (stats.by_price_cents[priceKey] || 0) + 1
      }

      // ── Update members row ──
      const { error: memberUpdateError } = await supabase
        .from('members')
        .update({
          plan_code: planCode,
          plan_price: planPriceCents,
          plan_upfront_fee: upfrontCents,
          membership_status: status,
          glofox_subscription_id: stripeSubId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', member.id)
        .eq('studio_id', STUDIO_ID)

      if (memberUpdateError) {
        stats.errors++
        if (errorSamples.length < 10) errorSamples.push(`member ${member.glofox_id}: ${memberUpdateError.message}`)
        continue
      }

      // ── Upsert member_subscriptions row ──
      const subRow = {
        studio_id: STUDIO_ID,
        member_id: member.id,
        profile_id: member.profile_id,
        plan_code: planCode,
        plan_name: planName,
        membership_name: membershipName,
        plan_price_cents: planPriceCents,
        plan_upfront_fee_cents: upfrontCents,
        billing_interval: membership.subscription?.interval ?? null,
        status,
        started_at: startedAt,
        ended_at: endedAt,
        glofox_user_membership_id: userMembershipId,
        stripe_subscription_id: stripeSubId,
        glofox_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      if (userMembershipId) {
        const { error: subError } = await supabase
          .from('member_subscriptions')
          .upsert(subRow, { onConflict: 'glofox_user_membership_id' })
        if (subError) {
          stats.errors++
          if (errorSamples.length < 10) errorSamples.push(`sub ${member.glofox_id}: ${subError.message}`)
          continue
        }
      } else {
        await supabase
          .from('member_subscriptions')
          .delete()
          .eq('member_id', member.id)
          .eq('plan_code', planCode)
          .is('glofox_user_membership_id', null)
        const { error: subError } = await supabase
          .from('member_subscriptions')
          .insert(subRow)
        if (subError) {
          stats.errors++
          if (errorSamples.length < 10) errorSamples.push(`sub ${member.glofox_id}: ${subError.message}`)
          continue
        }
      }

      stats.hydrated++
    } catch (err) {
      stats.errors++
      if (errorSamples.length < 10) errorSamples.push(`${member.glofox_id}: ${err.message}`)
    }

    if (stats.processed % PROGRESS_EVERY === 0) {
      process.stdout.write(
        `\r  Processed ${stats.processed}/${candidates.length} · hydrated ${stats.hydrated} · payg ${stats.skipped_payg} · err ${stats.errors}     `
      )
    }

    // Rate limit
    await new Promise((r) => setTimeout(r, RATE_LIMIT_MS))
  }

  process.stdout.write('\n\n')
  console.log('─── Results ──────────────────────────────────────────')
  console.log(`Processed:             ${stats.processed}`)
  console.log(`Hydrated:              ${stats.hydrated}`)
  console.log(`Skipped (payg):        ${stats.skipped_payg}`)
  console.log(`Skipped (no mship):    ${stats.skipped_no_membership}`)
  console.log(`Errors:                ${stats.errors}`)
  console.log('')
  console.log('By membership type:')
  for (const [k, v] of Object.entries(stats.by_type).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(20)} ${v}`)
  }
  console.log('')
  console.log('Top plan prices (cents → dollars):')
  const topPrices = Object.entries(stats.by_price_cents)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
  for (const [cents, count] of topPrices) {
    console.log(`  $${(parseInt(cents) / 100).toFixed(2).padStart(8)}  × ${count}`)
  }
  if (errorSamples.length > 0) {
    console.log('\nError samples:')
    for (const e of errorSamples) console.log(`  ${e}`)
  }
  console.log('──────────────────────────────────────────────────────\n')
}

main().catch((err) => {
  console.error('\nFATAL:', err)
  process.exit(1)
})
