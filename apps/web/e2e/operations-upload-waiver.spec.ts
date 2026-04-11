/**
 * Tier 4.7 — Operations: Upload Waiver Doc (narrow scope, API-level)
 *
 * Six scenarios covering POST /api/waivers + GET /api/waivers + PUT
 * /api/waivers/[id]. Tests use page.request directly because no admin
 * UI exists yet for waiver management (the operations/documents page
 * handles employee tax docs, not participant waivers — see
 * specs/legal/waiver-text.md for the canonical waiver content).
 *
 * The `waivers` and `waiver_signatures` tables exist with full CRUD
 * RLS policies. This tier builds the missing API routes and validates
 * versioning + activation semantics.
 */
import { test, expect } from '@playwright/test'
import { testDb } from './fixtures/db'
import { DEFAULT_STUDIO_ID } from './fixtures/test-data'

const PREFIX = 'E2ETestWaiver_'

// A minimal valid waiver body for tests. Not the full text (that's at
// specs/legal/waiver-text.md) — just enough to verify the content field
// is stored and retrievable.
const SAMPLE_WAIVER_CONTENT = `
RELEASE OF LIABILITY TEST WAIVER

This is a test waiver document for the QA pipeline. It is never shown
to real users. The canonical production waiver lives at
specs/legal/waiver-text.md and is uploaded separately.

Test clauses:
1. Participant acknowledges the risks.
2. Participant releases The Sauna Guys.
3. Participant agrees to defend and indemnify.
`.trim()

function uniqueName(label: string): string {
  const tag = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
  return `${PREFIX}${label}_${tag}`
}

async function cleanup(): Promise<void> {
  const { data } = await testDb
    .from('waivers')
    .select('id')
    .eq('studio_id', DEFAULT_STUDIO_ID)
    .like('name', `${PREFIX}%`)
  const ids = (data ?? []).map((w) => w.id)
  if (ids.length > 0) {
    await testDb
      .from('activity_log')
      .delete()
      .eq('subject_type', 'waiver')
      .in('subject_id', ids)
    await testDb.from('waivers').delete().in('id', ids)
  }
}

test.describe('Operations — Upload Waiver Doc (Tier 4.7, API-level)', () => {
  test.beforeEach(async () => {
    await cleanup()
  })

  test.afterAll(async () => {
    await cleanup()
  })

  // ---------------------------------------------------------------------
  // Scenario 1 — P0 happy path: upload a new waiver
  // ---------------------------------------------------------------------

  test('uploads a new waiver + creates activity_log entry @p0', async ({
    page,
  }) => {
    const name = uniqueName('Happy')
    await page.goto('/operations')

    const res = await page.request.post('/api/waivers', {
      data: {
        name,
        content: SAMPLE_WAIVER_CONTENT,
      },
    })

    expect(res.ok()).toBe(true)
    expect(res.status()).toBe(201)
    const body = await res.json()
    expect(body.data.id).toBeTruthy()
    expect(body.data.name).toBe(name)
    expect(body.data.version).toBeGreaterThanOrEqual(1)
    expect(body.data.is_active).toBe(true)

    // DB: row exists with content
    const { data: waiver } = await testDb
      .from('waivers')
      .select('id, name, content, version, is_active')
      .eq('id', body.data.id)
      .single()

    expect(waiver).not.toBeNull()
    expect(waiver!.content).toBe(SAMPLE_WAIVER_CONTENT)

    // Activity log
    const { data: logs } = await testDb
      .from('activity_log')
      .select('type, description, metadata')
      .eq('subject_id', body.data.id)
      .eq('type', 'settings_updated')

    expect(logs?.length).toBeGreaterThanOrEqual(1)
    expect(logs![0].description).toBeTruthy()
    expect(logs![0].description).toContain('uploaded')
    expect(logs![0].description).toContain(name)
  })

  // ---------------------------------------------------------------------
  // Scenario 2 — P0 version auto-increment on second upload
  // ---------------------------------------------------------------------

  test('uploading a second waiver increments version and deactivates the first @p0', async ({
    page,
  }) => {
    const nameV1 = uniqueName('V1')
    const nameV2 = uniqueName('V2')
    await page.goto('/operations')

    // Upload v1
    const v1Res = await page.request.post('/api/waivers', {
      data: { name: nameV1, content: SAMPLE_WAIVER_CONTENT },
    })
    expect(v1Res.ok()).toBe(true)
    const v1 = (await v1Res.json()).data

    // Upload v2
    const v2Res = await page.request.post('/api/waivers', {
      data: { name: nameV2, content: SAMPLE_WAIVER_CONTENT + '\nVersion 2 clause.' },
    })
    expect(v2Res.ok()).toBe(true)
    const v2 = (await v2Res.json()).data

    // v2.version is v1.version + 1
    expect(v2.version).toBe(v1.version + 1)
    expect(v2.is_active).toBe(true)

    // DB: v1 is now inactive
    const { data: v1Row } = await testDb
      .from('waivers')
      .select('is_active')
      .eq('id', v1.id)
      .single()
    expect(v1Row?.is_active).toBe(false)

    // DB: v2 is active
    const { data: v2Row } = await testDb
      .from('waivers')
      .select('is_active')
      .eq('id', v2.id)
      .single()
    expect(v2Row?.is_active).toBe(true)
  })

  // ---------------------------------------------------------------------
  // Scenario 3 — P0 list waivers (excludes content field for list view)
  // ---------------------------------------------------------------------

  test('GET /api/waivers returns all waivers for the studio @p0', async ({
    page,
  }) => {
    const n1 = uniqueName('ListOne')
    const n2 = uniqueName('ListTwo')
    await page.goto('/operations')

    await page.request.post('/api/waivers', {
      data: { name: n1, content: SAMPLE_WAIVER_CONTENT },
    })
    await page.request.post('/api/waivers', {
      data: { name: n2, content: SAMPLE_WAIVER_CONTENT },
    })

    const listRes = await page.request.get('/api/waivers')
    expect(listRes.ok()).toBe(true)
    const body = await listRes.json()

    // The list should contain both seeded waivers
    const names = ((body.data ?? []) as { name: string }[]).map((w) => w.name)
    expect(names).toContain(n1)
    expect(names).toContain(n2)

    // Content should NOT be in the list response (too large for list view)
    const first = (body.data ?? []).find((w: { name: string }) => w.name === n2)
    expect(first).toBeTruthy()
    expect((first as Record<string, unknown>).content).toBeUndefined()
  })

  // ---------------------------------------------------------------------
  // Scenario 4 — P0 GET single waiver returns full content
  // ---------------------------------------------------------------------

  test('GET /api/waivers/[id] returns the waiver with content @p0', async ({
    page,
  }) => {
    const name = uniqueName('Detail')
    await page.goto('/operations')

    const uploadRes = await page.request.post('/api/waivers', {
      data: { name, content: SAMPLE_WAIVER_CONTENT },
    })
    const uploaded = (await uploadRes.json()).data

    const getRes = await page.request.get(`/api/waivers/${uploaded.id}`)
    expect(getRes.ok()).toBe(true)
    const body = await getRes.json()

    expect(body.data.id).toBe(uploaded.id)
    expect(body.data.name).toBe(name)
    expect(body.data.content).toBe(SAMPLE_WAIVER_CONTENT)
  })

  // ---------------------------------------------------------------------
  // Scenario 5 — P1 blank content rejected
  // ---------------------------------------------------------------------

  test('rejects upload with blank content @p1', async ({ page }) => {
    await page.goto('/operations')

    const res = await page.request.post('/api/waivers', {
      data: { name: uniqueName('Blank'), content: '   ' },
    })

    expect(res.ok()).toBe(false)
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('content')
  })

  // ---------------------------------------------------------------------
  // Scenario 6 — P1 PUT updates name + is_active
  // ---------------------------------------------------------------------

  test('PUT /api/waivers/[id] updates name and deactivates @p1', async ({
    page,
  }) => {
    const originalName = uniqueName('Original')
    const renamedName = uniqueName('Renamed')
    await page.goto('/operations')

    const uploadRes = await page.request.post('/api/waivers', {
      data: { name: originalName, content: SAMPLE_WAIVER_CONTENT },
    })
    const uploaded = (await uploadRes.json()).data

    const updateRes = await page.request.put(`/api/waivers/${uploaded.id}`, {
      data: { name: renamedName, is_active: false },
    })
    expect(updateRes.ok()).toBe(true)
    const updated = (await updateRes.json()).data

    expect(updated.name).toBe(renamedName)
    expect(updated.is_active).toBe(false)

    // Content unchanged (immutable via PUT)
    const { data: row } = await testDb
      .from('waivers')
      .select('content')
      .eq('id', uploaded.id)
      .single()
    expect(row?.content).toBe(SAMPLE_WAIVER_CONTENT)
  })
})
