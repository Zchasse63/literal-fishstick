#!/usr/bin/env node
/**
 * Backfill transactions.member_id using the buyer user_id embedded in
 * Analytics/report TransactionsList.StripeCharge.metadata.user_id.
 *
 * Strategy:
 *   1. Figure out the full date range of existing transactions.
 *   2. Walk that range in 30-day chunks, calling Analytics/report for each.
 *   3. For each row, unwrap StripeCharge and extract:
 *        - glofox_id = StripeCharge._id
 *        - buyer_glofox_user_id = StripeCharge.metadata.user_id
 *        - description (for plan name)
 *        - invoice_id
 *   4. Build a Map<glofox_id, { buyerGlofoxId, description, invoiceId }>
 *   5. Resolve buyerGlofoxId → Meridian member_id via members table.
 *   6. Bulk-update transactions.member_id, transactions.description, and
 *      store invoice_id in a new field (if worth it) or in metadata.
 *
 * Flags:
 *   --dry-run    Don't write, just report counts.
 *   --target=$N  Only look at txs at amount $N (e.g. 159.50 → target=159.50)
 *   --days=N     Look at transactions from the last N days. Default: all.
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

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const daysArg = args.find((a) => a.startsWith('--days='))
const DAYS = daysArg ? parseInt(daysArg.split('=')[1], 10) : null

const env = loadEnv()
const STUDIO_ID = '11111111-1111-1111-1111-111111111111'
const BASE = 'https://gf-api.aws.glofox.com/prod/'
const NAMESPACE = 'thesaunaguys'

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const HEADERS = {
  'x-glofox-api-token': env.GLOFOX_API_TOKEN,
  'x-api-key': env.GLOFOX_API_KEY,
  'x-glofox-branch-id': env.GLOFOX_BRANCH_ID,
  'Content-Type': 'application/json',
  Accept: 'application/json',
}

function isoToUnix(iso) {
  return Math.floor(new Date(iso).getTime() / 1000)
}

async function pullRange(startIso, endIso) {
  const body = {
    model: 'TransactionsList',
    branch_id: env.GLOFOX_BRANCH_ID,
    namespace: NAMESPACE,
    start: String(isoToUnix(startIso)),
    end: String(isoToUnix(endIso)),
    secondStart: isoToUnix(startIso),
    secondEnd: isoToUnix(endIso),
    filter: { ReportByMembers: false, CompareToRanges: false },
  }
  const res = await fetch(`${BASE}Analytics/report`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`Analytics/report ${res.status}: ${(await res.text()).slice(0, 200)}`)
  }
  const data = await res.json()
  return data.TransactionsList?.details ?? []
}

async function main() {
  console.log(`\n╔══════════════════════════════════════════════════════════════╗`)
  console.log(`║ Transaction member_id backfill${DRY_RUN ? ' (DRY RUN)' : ''}`.padEnd(63) + '║')
  console.log(`╚══════════════════════════════════════════════════════════════╝\n`)

  // ── 1) Figure out date range ─────────────────────────────
  let startIso, endIso
  if (DAYS) {
    endIso = new Date().toISOString()
    startIso = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString()
  } else {
    const { data: oldest } = await supabase
      .from('transactions')
      .select('created_at')
      .eq('studio_id', STUDIO_ID)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()
    const { data: newest } = await supabase
      .from('transactions')
      .select('created_at')
      .eq('studio_id', STUDIO_ID)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    startIso = oldest?.created_at
    endIso = newest?.created_at
  }
  console.log(`Date range: ${startIso} → ${endIso}`)

  // ── 2) Walk the range in 30-day chunks ───────────────────
  const allRows = []
  const CHUNK_DAYS = 30
  let cursor = new Date(startIso)
  const finalEnd = new Date(endIso)

  while (cursor < finalEnd) {
    const chunkEnd = new Date(Math.min(cursor.getTime() + CHUNK_DAYS * 24 * 60 * 60 * 1000, finalEnd.getTime() + 1000))
    process.stdout.write(`\r  Pulling ${cursor.toISOString().slice(0, 10)} → ${chunkEnd.toISOString().slice(0, 10)}`)
    try {
      const rows = await pullRange(cursor.toISOString(), chunkEnd.toISOString())
      allRows.push(...rows)
    } catch (err) {
      console.log(`\n  ⚠ chunk failed: ${err.message}`)
    }
    cursor = chunkEnd
    await new Promise((r) => setTimeout(r, 150))
  }
  process.stdout.write('\n')
  console.log(`Pulled ${allRows.length} raw transaction rows`)

  // ── 3) Extract buyer info + build map ────────────────────
  const byGlofoxId = new Map()
  const buyerGlofoxIds = new Set()

  for (const row of allRows) {
    const sc = row.StripeCharge
    if (!sc) continue
    const glofoxId = sc._id
    const buyerId = sc.metadata?.user_id ?? null
    const buyerName = sc.metadata?.user_name ?? null
    if (!glofoxId) continue
    byGlofoxId.set(glofoxId, {
      buyerGlofoxId: buyerId,
      buyerName,
      description: sc.description ?? null,
      invoiceId: sc.invoice_id ?? null,
      amount: sc.amount,
    })
    if (buyerId) buyerGlofoxIds.add(buyerId)
  }
  console.log(`Unique glofox_ids from Glofox: ${byGlofoxId.size}`)
  console.log(`Unique buyer glofox user_ids: ${buyerGlofoxIds.size}`)

  // ── 4) Build glofox_user_id → member_id map ──────────────
  const buyerArray = [...buyerGlofoxIds]
  const memberIdByGlofoxId = new Map()
  const CHUNK = 500
  for (let i = 0; i < buyerArray.length; i += CHUNK) {
    const slice = buyerArray.slice(i, i + CHUNK)
    const { data, error } = await supabase
      .from('members')
      .select('id, glofox_id')
      .eq('studio_id', STUDIO_ID)
      .in('glofox_id', slice)
    if (error) throw error
    for (const m of data ?? []) memberIdByGlofoxId.set(m.glofox_id, m.id)
  }
  console.log(`Resolved ${memberIdByGlofoxId.size}/${buyerArray.length} buyer glofox_ids to members table`)

  // ── 5) Pull existing transactions that need backfilling ──
  console.log('\nFetching all Meridian transactions...')
  const existingTxs = []
  const PAGE = 1000
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, glofox_id, member_id, amount, description, glofox_invoice_id')
      .eq('studio_id', STUDIO_ID)
      .not('glofox_id', 'is', null)
      .order('id', { ascending: true })
      .range(offset, offset + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    existingTxs.push(...data)
    if (data.length < PAGE) break
    offset += PAGE
  }
  console.log(`Found ${existingTxs.length} total txs in Meridian`)
  const missingMember = existingTxs.filter((t) => t.member_id == null).length
  console.log(`  ${missingMember} missing member_id`)
  const missingInvoice = existingTxs.filter((t) => t.glofox_invoice_id == null).length
  console.log(`  ${missingInvoice} missing glofox_invoice_id`)

  // ── 6) Match + update ────────────────────────────────────
  // Build updates for anything where we have new data we didn't have before.
  let matched = 0
  let notInGlofox = 0
  let noBuyer = 0
  let noMeridianMember = 0
  const updates = []

  for (const tx of existingTxs) {
    const gfRow = byGlofoxId.get(tx.glofox_id)
    if (!gfRow) {
      notInGlofox++
      continue
    }

    const patch = {}
    // member_id backfill
    if (!tx.member_id && gfRow.buyerGlofoxId) {
      const memberId = memberIdByGlofoxId.get(gfRow.buyerGlofoxId)
      if (memberId) {
        patch.member_id = memberId
      } else {
        noMeridianMember++
      }
    } else if (!tx.member_id && !gfRow.buyerGlofoxId) {
      noBuyer++
    }

    // description backfill (refresh to Glofox version which has plan name)
    if (gfRow.description && gfRow.description !== tx.description) {
      patch.description = gfRow.description
    }

    // glofox_invoice_id backfill
    if (!tx.glofox_invoice_id && gfRow.invoiceId) {
      patch.glofox_invoice_id = gfRow.invoiceId
    }

    if (Object.keys(patch).length > 0) {
      matched++
      updates.push({ id: tx.id, ...patch })
    }
  }

  console.log('\n── Match report ──')
  console.log(`  Rows needing update:       ${matched}`)
  console.log(`  Glofox row not found:      ${notInGlofox}`)
  console.log(`  Glofox had no buyer id:    ${noBuyer}`)
  console.log(`  Buyer id → no Meridian:    ${noMeridianMember}`)

  // ── 7) Do the updates ────────────────────────────────────
  if (DRY_RUN) {
    console.log('\n[DRY RUN] — no writes performed')
    console.log('\nSample of first 5 patches:')
    for (const u of updates.slice(0, 5)) {
      const { id, ...patch } = u
      console.log(`  ${id}`)
      for (const [k, v] of Object.entries(patch)) {
        const displayV = typeof v === 'string' && v.length > 60 ? v.slice(0, 60) + '…' : v
        console.log(`    ${k}: ${displayV}`)
      }
    }
  } else {
    console.log(`\nWriting ${updates.length} updates...`)
    let done = 0
    let errCount = 0
    for (const u of updates) {
      const { id, ...patch } = u
      const { error } = await supabase
        .from('transactions')
        .update(patch)
        .eq('id', id)
        .eq('studio_id', STUDIO_ID)
      if (error) {
        errCount++
        if (errCount <= 5) console.log(`    err ${id}: ${error.message}`)
      }
      done++
      if (done % 100 === 0) {
        process.stdout.write(`\r  Updated ${done}/${updates.length}`)
      }
    }
    process.stdout.write('\n')
    console.log(`Done. Errors: ${errCount}`)
  }

  // ── 8) Report on $159.50 specifically ────────────────────
  console.log('\n━━━ $159.50 matching ━━━')
  const target159 = existingTxs.filter((t) => t.amount === 15950)
  console.log(`${target159.length} existing transactions at $159.50`)
  const matched159 = target159
    .map((t) => {
      const gf = byGlofoxId.get(t.glofox_id)
      const memId = gf?.buyerGlofoxId ? memberIdByGlofoxId.get(gf.buyerGlofoxId) : null
      return { tx: t, gf, memId }
    })
    .filter((x) => x.gf)

  console.log(`${matched159.length} matched to Glofox row`)
  if (matched159.length > 0) {
    // Get member names for display
    const memIds = [...new Set(matched159.map((x) => x.memId).filter(Boolean))]
    const { data: memberRows } = await supabase
      .from('members')
      .select('id, glofox_id, plan_price, membership_status, profile:profiles(full_name, email)')
      .in('id', memIds)
    const nameById = new Map()
    for (const m of memberRows ?? []) {
      nameById.set(m.id, {
        name: m.profile?.full_name,
        email: m.profile?.email,
        current: m.plan_price,
        status: m.membership_status,
      })
    }

    // Unique members on $159.50
    const byMember = new Map()
    for (const x of matched159) {
      if (!x.memId) continue
      const prev = byMember.get(x.memId) ?? { count: 0 }
      prev.count++
      byMember.set(x.memId, prev)
    }
    console.log(`${byMember.size} unique members on $159.50 plan:`)
    for (const [memId, info] of byMember) {
      const m = nameById.get(memId) ?? {}
      console.log(
        `  ${(m.name ?? '?').padEnd(28)} ${(m.email ?? '?').padEnd(35)} · ${info.count} charges · now: $${((m.current ?? 0) / 100).toFixed(2)} ${m.status ?? ''}`
      )
    }

    // Sample descriptions
    const descSet = new Set(matched159.map((x) => x.gf?.description).filter(Boolean))
    console.log(`\nDistinct descriptions (${descSet.size}):`)
    for (const d of [...descSet].slice(0, 10)) {
      console.log(`  ${d}`)
    }
  }
  console.log('')
}

main().catch((err) => {
  console.error('\nFATAL:', err)
  process.exit(1)
})
