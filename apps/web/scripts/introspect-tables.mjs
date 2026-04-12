#!/usr/bin/env node
/**
 * Dump column list for transactions + members so we know which linking
 * columns actually exist before running the real query.
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
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function dumpOne(table) {
  const { data, error } = await supabase.from(table).select('*').limit(1)
  if (error) {
    console.log(`\n${table}: ERROR ${error.message}`)
    return
  }
  const row = data?.[0]
  if (!row) {
    console.log(`\n${table}: (empty)`)
    return
  }
  console.log(`\n${table} columns:`)
  for (const k of Object.keys(row).sort()) {
    const v = row[k]
    const type = v === null ? 'null' : typeof v
    console.log(`  ${k.padEnd(30)} ${type}`)
  }
}

async function main() {
  for (const t of ['transactions', 'members', 'member_subscriptions', 'profiles']) {
    await dumpOne(t)
  }
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
