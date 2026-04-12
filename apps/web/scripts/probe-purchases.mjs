#!/usr/bin/env node
/**
 * Probe a Glofox member response to inspect the MEMBERPURCHASE array shape.
 * We know from earlier probes it exists; we just need the field names so we
 * can build a global charge-id → member_id map.
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

const HEADERS = {
  'x-glofox-api-token': env.GLOFOX_API_TOKEN,
  'x-api-key': env.GLOFOX_API_KEY,
  'x-glofox-branch-id': env.GLOFOX_BRANCH_ID,
  Accept: 'application/json',
}

async function getMember(gfid) {
  const res = await fetch(`https://gf-api.aws.glofox.com/prod/2.0/members/${gfid}`, {
    headers: HEADERS,
  })
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`)
  return res.json()
}

async function main() {
  // Pick one active subscriber
  const { data: members } = await supabase
    .from('members')
    .select('id, glofox_id, plan_price, profile:profiles(full_name)')
    .eq('studio_id', STUDIO_ID)
    .eq('membership_status', 'active')
    .not('glofox_id', 'is', null)
    .order('plan_price', { ascending: false, nullsFirst: false })
    .limit(3)

  for (const m of members ?? []) {
    console.log(
      `\n━━━ ${m.profile?.full_name} (gf:${m.glofox_id}, plan ${m.plan_price}) ━━━`
    )
    const full = await getMember(m.glofox_id)

    console.log('Top-level keys:', Object.keys(full).sort().join(', '))

    console.log('\nMEMBERPURCHASE raw type:', typeof full.MEMBERPURCHASE, Array.isArray(full.MEMBERPURCHASE) ? '(array)' : '')
    console.log('MEMBERPURCHASE raw value:')
    console.log(JSON.stringify(full.MEMBERPURCHASE, null, 2).slice(0, 2000))

    console.log('\nPAYGPAYMENT raw type:', typeof full.PAYGPAYMENT, Array.isArray(full.PAYGPAYMENT) ? '(array)' : '')
    console.log('PAYGPAYMENT raw value:')
    console.log(JSON.stringify(full.PAYGPAYMENT, null, 2).slice(0, 2000))

    // rate-limit
    await new Promise((r) => setTimeout(r, 250))
  }
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
