#!/usr/bin/env node
/**
 * Find members connected to the $159–175 mystery plan.
 *
 * Strategy:
 *   1. Query member_subscriptions for anything priced $150–175.
 *   2. Query transactions for charges of $150–175.
 *   3. For each $159.50 tx, find the member via the Glofox API using
 *      glofox_provider_id / glofox_id → member lookup.
 *   4. Cross-reference: which members have charges at that amount.
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

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
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function fmt$(cents) {
  if (cents == null) return '—'
  return `$${(cents / 100).toFixed(2)}`
}

async function main() {
  // ── 1) member_subscriptions in the $150–175 band ─────────────
  console.log('\n━━━ member_subscriptions in $150–175 range ━━━')
  const { data: subs, error: subErr } = await supabase
    .from('member_subscriptions')
    .select(
      'member_id, profile_id, plan_code, plan_name, membership_name, plan_price_cents, status, started_at, ended_at, stripe_subscription_id'
    )
    .eq('studio_id', STUDIO_ID)
    .gte('plan_price_cents', 15000)
    .lte('plan_price_cents', 17500)
    .order('plan_price_cents', { ascending: false })
  if (subErr) throw subErr
  console.log(`Found ${subs?.length ?? 0} active/current subscriptions in range`)

  // ── 2) transactions in the $150–175 band ─────────────────────
  console.log('\n━━━ transactions in $150–175 range ━━━')
  const { data: txs, error: txErr } = await supabase
    .from('transactions')
    .select(
      'id, member_id, amount, created_at, type, description, glofox_id, glofox_provider_id, glofox_charge_id, stripe_payment_intent_id, payment_method, status'
    )
    .eq('studio_id', STUDIO_ID)
    .gte('amount', 15000)
    .lte('amount', 17500)
    .order('created_at', { ascending: false })
    .limit(1000)
  if (txErr) throw txErr
  console.log(`Found ${txs?.length ?? 0} transactions in $150–175 range`)

  // Group by amount to see distribution
  const byAmount = {}
  for (const t of txs ?? []) {
    byAmount[t.amount] = (byAmount[t.amount] || 0) + 1
  }
  console.log('\nAmount distribution:')
  const sortedAmounts = Object.entries(byAmount).sort((a, b) => b[1] - a[1])
  for (const [amt, count] of sortedAmounts) {
    console.log(`  ${fmt$(parseInt(amt)).padStart(9)}  × ${count}`)
  }

  // ── 3) For $159.50 specifically, inspect samples ─────────────
  console.log('\n━━━ $159.50 transactions — sample row ━━━')
  const { data: txs159, error: tx159Err } = await supabase
    .from('transactions')
    .select('*')
    .eq('studio_id', STUDIO_ID)
    .eq('amount', 15950)
    .order('created_at', { ascending: false })
  if (tx159Err) throw tx159Err
  console.log(`${txs159?.length ?? 0} total $159.50 transactions`)

  if (txs159 && txs159.length > 0) {
    console.log('\nFirst tx full shape:')
    console.log(JSON.stringify(txs159[0], null, 2))

    // How many have member_id populated?
    const withMember = txs159.filter((t) => t.member_id != null)
    console.log(`\n${withMember.length}/${txs159.length} have member_id set`)

    // Distinct glofox_provider_ids
    const providers = [
      ...new Set(txs159.map((t) => t.glofox_provider_id).filter(Boolean)),
    ]
    console.log(
      `Distinct glofox_provider_id values: ${providers.length} (sample: ${providers.slice(0, 5).join(', ')})`
    )

    // Distinct members via member_id
    const memberIds = [...new Set(withMember.map((t) => t.member_id))]
    if (memberIds.length > 0) {
      const { data: members } = await supabase
        .from('members')
        .select(
          'id, glofox_id, plan_code, plan_price, membership_status, profile:profiles(full_name, email)'
        )
        .in('id', memberIds)
      console.log(`\n${members?.length ?? 0} matched members:`)
      for (const m of members ?? []) {
        const name = m.profile?.full_name ?? '?'
        const email = m.profile?.email ?? '?'
        const txCount = txs159.filter((t) => t.member_id === m.id).length
        console.log(
          `  ${name.padEnd(28)} ${email.padEnd(35)} · ${txCount} txs · now: ${fmt$(m.plan_price)} ${m.membership_status}`
        )
      }
    } else {
      console.log('\n⚠ NO $159.50 transactions have member_id populated.')
    }
  }

  // ── 4) Full price distribution in member_subscriptions
  console.log('\n━━━ All member_subscriptions by price (full distribution) ━━━')
  const { data: allSubs } = await supabase
    .from('member_subscriptions')
    .select('plan_price_cents')
    .eq('studio_id', STUDIO_ID)
    .not('plan_price_cents', 'is', null)

  const priceDist = {}
  for (const s of allSubs ?? []) {
    const key = `${s.plan_price_cents}`
    priceDist[key] = (priceDist[key] || 0) + 1
  }
  const sortedPrices = Object.entries(priceDist)
    .map(([k, v]) => [parseInt(k), v])
    .sort((a, b) => a[0] - b[0])

  for (const [cents, count] of sortedPrices) {
    console.log(`  ${fmt$(cents).padStart(9)}  × ${count}`)
  }
  console.log('')
}

main().catch((err) => {
  console.error('\nFATAL:', err)
  process.exit(1)
})
