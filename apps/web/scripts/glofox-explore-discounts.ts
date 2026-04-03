/**
 * Explore Glofox API for discount/promo endpoints.
 * Tries several possible endpoint paths.
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

async function tryEndpoint(path: string, method: string = 'GET', body?: any) {
  const url = `${BASE_URL}${path}`
  console.log(`\n→ ${method} ${path}`)
  try {
    const opts: RequestInit = { method, headers }
    if (body) opts.body = JSON.stringify(body)
    const res = await fetch(url, opts)
    const text = await res.text()
    console.log(`  Status: ${res.status}`)
    if (res.status < 400) {
      try {
        const json = JSON.parse(text)
        console.log(`  Response: ${JSON.stringify(json, null, 2).substring(0, 3000)}`)
      } catch {
        console.log(`  Response (text): ${text.substring(0, 1000)}`)
      }
    } else {
      console.log(`  Error: ${text.substring(0, 500)}`)
    }
  } catch (err: any) {
    console.log(`  Failed: ${err.message}`)
  }
}

async function main() {
  console.log('═══════════════════════════════════════')
  console.log('  EXPLORING GLOFOX DISCOUNT ENDPOINTS')
  console.log('═══════════════════════════════════════')

  // Try various possible discount endpoint paths
  const paths = [
    // v2.0 patterns
    '2.0/discounts',
    '2.0/discount-codes',
    '2.0/promo-codes',
    '2.0/coupons',
    `2.0/branches/${BRANCH_ID}/discounts`,
    `2.1/branches/${BRANCH_ID}/discounts`,
    `2.2/branches/${BRANCH_ID}/discounts`,
    // v3.0 patterns
    `v3.0/locations/${BRANCH_ID}/discounts`,
    // Other patterns
    'discounts',
    `branches/${BRANCH_ID}/discounts`,
    '2.0/promotions',
    `2.1/branches/${BRANCH_ID}/promotions`,
    `2.2/branches/${BRANCH_ID}/promotions`,
    `2.0/branches/${BRANCH_ID}/promo-codes`,
    // Price-related that might include discounts
    `2.1/branches/${BRANCH_ID}/price-breakdown`,
  ]

  for (const path of paths) {
    await tryEndpoint(path)
  }

  console.log('\n═══════════════════════════════════════')
  console.log('  DONE')
  console.log('═══════════════════════════════════════')
}

main().catch(console.error)
