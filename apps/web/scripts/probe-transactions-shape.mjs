#!/usr/bin/env node
/**
 * Probe the real shape of Glofox Analytics/report TransactionsList response
 * and the invoices endpoint. Goal: figure out where the buyer user_id lives
 * so we can backfill transactions.member_id.
 */
import { readFileSync } from 'node:fs'

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
const HEADERS = {
  'x-glofox-api-token': env.GLOFOX_API_TOKEN,
  'x-api-key': env.GLOFOX_API_KEY,
  'x-glofox-branch-id': env.GLOFOX_BRANCH_ID,
  'Content-Type': 'application/json',
  Accept: 'application/json',
}
const BASE = 'https://gf-api.aws.glofox.com/prod/'

function isoToUnix(iso) {
  return Math.floor(new Date(iso).getTime() / 1000)
}

async function probeTransactions() {
  console.log('━━━ Analytics/report TransactionsList probe ━━━')
  // A short range known to have transactions: last 7 days
  const end = new Date().toISOString()
  const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const body = {
    model: 'TransactionsList',
    branch_id: env.GLOFOX_BRANCH_ID,
    namespace: env.GLOFOX_NAMESPACE ?? 'thesaunaguys',
    start: String(isoToUnix(start)),
    end: String(isoToUnix(end)),
    secondStart: isoToUnix(start),
    secondEnd: isoToUnix(end),
    filter: {
      ReportByMembers: false,
      CompareToRanges: false,
    },
  }

  console.log('Request body:', JSON.stringify(body, null, 2))

  const res = await fetch(`${BASE}Analytics/report`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(body),
  })
  console.log(`Status: ${res.status}`)
  const data = await res.json()
  console.log('Response keys:', Object.keys(data).join(', '))

  const details = data.TransactionsList?.details
  if (details && Array.isArray(details) && details.length > 0) {
    console.log(`\nFound ${details.length} transactions. First 3 samples:`)
    for (const t of details.slice(0, 3)) {
      console.log('\n  Keys:', Object.keys(t).sort().join(', '))
      console.log('  Full row:')
      console.log('    ' + JSON.stringify(t, null, 2).split('\n').join('\n    '))
    }

    // Look for anything that looks like a user ID
    console.log('\n─── Hunting for user linkage fields ───')
    for (const t of details.slice(0, 5)) {
      for (const [k, v] of Object.entries(t)) {
        if (k.toLowerCase().includes('user') || k.toLowerCase().includes('member') || k.toLowerCase().includes('client') || k.toLowerCase().includes('customer')) {
          console.log(`  ${k} = ${JSON.stringify(v).slice(0, 80)}`)
        }
      }
    }
  } else {
    console.log('No transactions in this window.')
  }

  // Also probe ReportByMembers=true variant
  console.log('\n━━━ Analytics/report TransactionsList with ReportByMembers=true ━━━')
  const body2 = { ...body, filter: { ReportByMembers: true, CompareToRanges: false } }
  const res2 = await fetch(`${BASE}Analytics/report`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(body2),
  })
  const data2 = await res2.json()
  const details2 = data2.TransactionsList?.details
  if (details2 && Array.isArray(details2) && details2.length > 0) {
    console.log(`Found ${details2.length} rows. First sample:`)
    console.log(JSON.stringify(details2[0], null, 2))
  } else {
    console.log('Response keys:', Object.keys(data2).join(', '))
  }
}

async function probeInvoices() {
  console.log('\n\n━━━ Invoices endpoint probe ━━━')
  const res = await fetch(
    `${BASE}2.2/branches/${env.GLOFOX_BRANCH_ID}/invoices?page=1&limit=5`,
    { headers: HEADERS },
  )
  console.log(`Status: ${res.status}`)
  if (!res.ok) {
    console.log('Body:', (await res.text()).slice(0, 500))
    return
  }
  const data = await res.json()
  console.log('Response keys:', Object.keys(data).join(', '))
  console.log('Full sample:')
  console.log(JSON.stringify(data, null, 2).slice(0, 3000))
}

async function main() {
  await probeTransactions()
  await probeInvoices()
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
