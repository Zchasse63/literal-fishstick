/**
 * Pull staff, memberships, and member subscription data from Glofox API.
 * Usage: npx tsx scripts/glofox-pull-data.ts
 */
import { GlofoxClient } from '../src/lib/glofox/client'

async function main() {
  const client = new GlofoxClient()

  // ─── 1. Pull Staff (Trainers) ────────────────────────────────
  console.log('\n═══════════════════════════════════════')
  console.log('  GLOFOX STAFF / TRAINERS')
  console.log('═══════════════════════════════════════\n')

  try {
    const staff = await client.getStaff()
    console.log(`Total staff records: ${staff.length}\n`)
    for (const s of staff) {
      console.log(`  ID: ${s._id}`)
      console.log(`  Name: ${s.name ?? `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim()}`)
      console.log(`  Type: ${s.type ?? 'n/a'}`)
      console.log(`  Active: ${s.active ?? 'n/a'}`)
      console.log(`  Bookable: ${s.bookable ?? 'n/a'}`)
      console.log(`  Image: ${s.image_url ?? 'none'}`)
      console.log(`  Full record: ${JSON.stringify(s, null, 2)}`)
      console.log('  ---')
    }
  } catch (err) {
    console.error('Failed to fetch staff:', err)
  }

  // ─── 2. Pull Membership Plans ────────────────────────────────
  console.log('\n═══════════════════════════════════════')
  console.log('  GLOFOX MEMBERSHIP PLANS')
  console.log('═══════════════════════════════════════\n')

  try {
    const memberships = await client.getMemberships()
    console.log(`Total membership plans: ${memberships.length}\n`)
    for (const m of memberships) {
      console.log(`  ID: ${m._id}`)
      console.log(`  Name: ${m.name}`)
      console.log(`  Active: ${m.active}`)
      console.log(`  Buy Just Once: ${m.buy_just_once}`)
      console.log(`  Description: ${m.description ?? 'none'}`)
      if (m.plans && m.plans.length > 0) {
        for (const p of m.plans) {
          console.log(`    Plan Code: ${p.code}`)
          console.log(`    Type: ${p.type}`)
          console.log(`    Price: ${p.price}`)
          console.log(`    Duration: ${p.duration_time_unit_count} ${p.duration_time_unit}`)
          console.log(`    Upfront Fee: ${p.upfront_fee ?? 0}`)
          console.log(`    Starts On: ${p.starts_on ?? 'n/a'}`)
        }
      }
      console.log(`  Full record: ${JSON.stringify(m, null, 2)}`)
      console.log('  ---')
    }
  } catch (err) {
    console.error('Failed to fetch memberships:', err)
  }

  // ─── 3. Pull Members with Subscription Data ─────────────────
  console.log('\n═══════════════════════════════════════')
  console.log('  GLOFOX MEMBERS — SUBSCRIPTION SUMMARY')
  console.log('═══════════════════════════════════════\n')

  try {
    const members = await client.getMembers()
    console.log(`Total members: ${members.length}\n`)

    // Group by membership status
    const statusCounts: Record<string, number> = {}
    const planCounts: Record<string, { count: number; price: number; status: string }> = {}
    const activeSubs: Array<{
      id: string
      name: string
      email: string
      membership_name: string
      plan_code: string
      plan_price: number
      status: string
      start_date: number | undefined
      expiry_date: number | undefined
    }> = []

    for (const m of members) {
      const ms = m.membership
      const status = ms?.status ?? 'NO_MEMBERSHIP'
      statusCounts[status] = (statusCounts[status] ?? 0) + 1

      if (ms?.plan_code) {
        const key = `${ms.plan_code}|${ms.membership_name ?? 'unknown'}`
        if (!planCounts[key]) {
          planCounts[key] = { count: 0, price: ms.plan_price ?? 0, status: ms.status ?? 'unknown' }
        }
        planCounts[key].count++
      }

      if (ms?.status === 'ACTIVE') {
        activeSubs.push({
          id: m._id,
          name: `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim(),
          email: m.email ?? '',
          membership_name: ms.membership_name ?? 'unknown',
          plan_code: ms.plan_code ?? 'unknown',
          plan_price: ms.plan_price ?? 0,
          status: ms.status,
          start_date: ms.start_date,
          expiry_date: ms.expiry_date,
        })
      }
    }

    console.log('  Membership Status Distribution:')
    for (const [status, count] of Object.entries(statusCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${status}: ${count}`)
    }

    console.log('\n  Plan Code Breakdown:')
    for (const [key, info] of Object.entries(planCounts).sort((a, b) => b[1].count - a[1].count)) {
      const [code, name] = key.split('|')
      console.log(`    ${name} (${code}): ${info.count} members — $${info.price} — typical status: ${info.status}`)
    }

    console.log(`\n  Active Subscribers (${activeSubs.length} total):`)
    for (const sub of activeSubs) {
      const startDate = sub.start_date ? new Date(sub.start_date * 1000).toISOString().split('T')[0] : 'n/a'
      const expiryDate = sub.expiry_date ? new Date(sub.expiry_date * 1000).toISOString().split('T')[0] : 'n/a'
      console.log(`    ${sub.name} <${sub.email}> — ${sub.membership_name} ($${sub.plan_price}) — ${startDate} to ${expiryDate}`)
    }
  } catch (err) {
    console.error('Failed to fetch members:', err)
  }

  console.log('\n═══════════════════════════════════════')
  console.log('  DONE')
  console.log('═══════════════════════════════════════\n')
}

main().catch(console.error)
