/**
 * Tier 4.5 — Corporate: Create Account (narrow scope, API-level)
 *
 * Five scenarios covering POST /api/corporate. Tests use page.request
 * directly because the corporate UI hasn't been validated yet (Tier 2.6
 * smoke verified the page mounts but not the create flow).
 *
 * BUG-023 (`'corporate.company_created'` not in activity_log enum + missing
 * description) was fixed inline. The Tier 4.5 migration also added 5 more
 * corporate types for Tier 4.6 use.
 *
 * Note: tests use a unique-name pattern that the cleanup must catch.
 * No global resetStudioTestData hook for company_accounts exists; this
 * spec adds an `afterEach` to delete its own seeded rows.
 */
import { test, expect } from '@playwright/test'
import { testDb } from './fixtures/db'
import { DEFAULT_STUDIO_ID } from './fixtures/test-data'

const TEST_NAME_PREFIX = 'E2ETestCompany_'

function uniqueCompanyName(label: string): string {
  const tag = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
  return `${TEST_NAME_PREFIX}${label}_${tag}`
}

async function cleanupTestCompanies(): Promise<void> {
  const { data: companies } = await testDb
    .from('company_accounts')
    .select('id')
    .eq('studio_id', DEFAULT_STUDIO_ID)
    .like('name', `${TEST_NAME_PREFIX}%`)

  const ids = (companies ?? []).map((c) => c.id)
  if (ids.length > 0) {
    // Activity log first (FK preserved)
    await testDb
      .from('activity_log')
      .delete()
      .eq('subject_type', 'company_account')
      .in('subject_id', ids)
    await testDb.from('company_accounts').delete().in('id', ids)
  }
}

test.describe('Corporate — Create Account (Tier 4.5, API-level)', () => {
  test.beforeEach(async () => {
    await cleanupTestCompanies()
  })

  test.afterAll(async () => {
    await cleanupTestCompanies()
  })

  // ---------------------------------------------------------------------
  // Scenario 1 — P0 happy path: minimal valid payload
  // ---------------------------------------------------------------------

  test('creates a company account with minimal valid fields @p0', async ({
    page,
  }) => {
    const name = uniqueCompanyName('Minimal')
    await page.goto('/corporate')

    const res = await page.request.post('/api/corporate', {
      data: {
        name,
        contact_name: 'Test Contact',
        contact_email: 'test@example.com',
      },
    })

    expect(res.ok()).toBe(true)
    expect(res.status()).toBe(201)
    const body = await res.json()
    expect(body.data.id).toBeTruthy()
    expect(body.data.name).toBe(name)
    expect(body.data.contact_name).toBe('Test Contact')
    expect(body.data.contact_email).toBe('test@example.com')
    // Default status should be 'prospect' per the route's default
    expect(body.data.status).toBe('prospect')

    // DB: row exists
    const { data: company } = await testDb
      .from('company_accounts')
      .select('id, name, status')
      .eq('id', body.data.id)
      .single()
    expect(company?.name).toBe(name)

    // DB: activity_log row landed (BUG-023 fix)
    const { data: logs } = await testDb
      .from('activity_log')
      .select('type, description, metadata')
      .eq('subject_id', body.data.id)
      .eq('type', 'company_created')

    expect(logs?.length).toBeGreaterThanOrEqual(1)
    const log = logs![0]
    expect(log.description).toBeTruthy()
    expect(log.description).toContain('Company account created')
    expect(log.description).toContain(name)
    expect((log.metadata as Record<string, unknown>).company_name).toBe(name)
  })

  // ---------------------------------------------------------------------
  // Scenario 2 — P0 happy path with full payload
  // ---------------------------------------------------------------------

  test('creates a company account with all optional fields @p0', async ({
    page,
  }) => {
    const name = uniqueCompanyName('Full')
    await page.goto('/corporate')

    // Tier 4.6.5 D1 fix: company_size now uses a valid enum value
    // ('51-200' instead of the previous '50-100' which violated the
    // company_accounts_company_size_check CHECK constraint).
    const res = await page.request.post('/api/corporate', {
      data: {
        name,
        legal_name: `${name} Inc`,
        industry: 'Technology',
        company_size: '51-200',
        contact_name: 'Jane Doe',
        contact_email: 'jane@example.com',
        contact_phone: '+15555550123',
        contact_title: 'HR Director',
        billing_email: 'billing@example.com',
        payment_terms: 'net_30',
        monthly_credit_allocation: 100,
        auto_renew: true,
        notes: 'Tier 4.5 test entry',
        tags: ['e2e', 'test'],
      },
    })

    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body.data.legal_name).toBe(`${name} Inc`)
    expect(body.data.industry).toBe('Technology')
    expect(body.data.company_size).toBe('51-200')
    expect(body.data.monthly_credit_allocation).toBe(100)
    // credits_remaining should match the allocation on create
    expect(body.data.credits_remaining).toBe(100)
    expect(body.data.auto_renew).toBe(true)
    expect(body.data.notes).toBe('Tier 4.5 test entry')
  })

  // ---------------------------------------------------------------------
  // Scenario 3 — P1 missing required fields rejected
  // ---------------------------------------------------------------------

  test('rejects request missing required name field @p1', async ({ page }) => {
    await page.goto('/corporate')

    const res = await page.request.post('/api/corporate', {
      data: {
        // missing 'name'
        contact_name: 'Test Contact',
        contact_email: 'test@example.com',
      },
    })

    expect(res.ok()).toBe(false)
    expect(res.status()).toBe(400)
  })

  // ---------------------------------------------------------------------
  // Scenario 4 — P1 invalid email rejected
  // ---------------------------------------------------------------------

  test('rejects request with invalid contact_email format @p1', async ({
    page,
  }) => {
    const name = uniqueCompanyName('BadEmail')
    await page.goto('/corporate')

    const res = await page.request.post('/api/corporate', {
      data: {
        name,
        contact_name: 'Test',
        contact_email: 'not-an-email',
      },
    })

    expect(res.ok()).toBe(false)
    expect(res.status()).toBe(400)

    // DB: no row was inserted
    const { data: companies } = await testDb
      .from('company_accounts')
      .select('id')
      .eq('name', name)
    expect(companies?.length ?? 0).toBe(0)
  })

  // ---------------------------------------------------------------------
  // Scenario 5 — P1 monthly_credit_allocation populates credits_remaining
  // ---------------------------------------------------------------------

  test('credits_remaining initializes to monthly_credit_allocation @p1', async ({
    page,
  }) => {
    const name = uniqueCompanyName('Credits')
    await page.goto('/corporate')

    const res = await page.request.post('/api/corporate', {
      data: {
        name,
        contact_name: 'Credits Test',
        contact_email: 'credits@example.com',
        monthly_credit_allocation: 50,
      },
    })

    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body.data.monthly_credit_allocation).toBe(50)
    expect(body.data.credits_remaining).toBe(50)
  })
})
