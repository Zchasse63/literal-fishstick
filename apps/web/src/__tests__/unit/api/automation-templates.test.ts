import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Constants ──────────────────────────────────────────────────────
const TEST_USER_ID = 'aaaaaaaa-1111-2222-3333-444444444444'

function makeRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), init)
}

// ─── Chainable mock ─────────────────────────────────────────────────
import { createChainableMock, type MockReturnValue } from '@/__tests__/helpers/mock-chainable'

function buildSupabaseMock(
  tableResponses: Record<string, MockReturnValue>,
  authResponse?: { user: unknown; error?: unknown },
) {
  const defaultResponse: MockReturnValue = { data: null, error: null, count: 0 }
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: authResponse?.user ?? null },
        error: authResponse?.error ?? null,
      }),
    },
    from: vi.fn((table: string) => {
      const resp = tableResponses[table] ?? defaultResponse
      return createChainableMock(resp)
    }),
  }
}

// ─── Module mocks ───────────────────────────────────────────────────
let mockSupabase: ReturnType<typeof buildSupabaseMock>

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(() => Promise.resolve(mockSupabase)),
}))

// Import after mocks
const { GET } = await import('@/app/api/automations/templates/route')

// Import templates directly for structure tests
import { AUTOMATION_TEMPLATES, type AutomationTemplate } from '@/lib/automation-templates'

// ─── Helpers ────────────────────────────────────────────────────────
function setupAuth(opts: {
  authenticated?: boolean
  roles?: string[]
}) {
  const authenticated = opts.authenticated ?? true
  const roles = opts.roles ?? ['owner']

  if (!authenticated) {
    mockSupabase = buildSupabaseMock(
      {},
      { user: null, error: { message: 'No session' } },
    )
    return
  }

  mockSupabase = buildSupabaseMock(
    {
      profiles: {
        data: { roles },
        error: null,
      },
    },
    { user: { id: TEST_USER_ID } },
  )
}

// ─── Reset ──────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks()
})

// =========================================================================
// GET /api/automations/templates
// =========================================================================

describe('GET /api/automations/templates', () => {
  it('returns all templates with 200', async () => {
    setupAuth({ authenticated: true, roles: ['owner'] })

    const res = await GET(makeRequest('http://localhost:3000/api/automations/templates'))
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.data).toHaveLength(AUTOMATION_TEMPLATES.length)
    expect(json.count).toBe(AUTOMATION_TEMPLATES.length)
  })

  it('filters by category query param', async () => {
    setupAuth({ authenticated: true, roles: ['admin'] })

    const res = await GET(
      makeRequest('http://localhost:3000/api/automations/templates?category=onboarding'),
    )
    expect(res.status).toBe(200)

    const json = await res.json()
    // All returned templates should be in the onboarding category
    for (const t of json.data) {
      expect(t.category).toBe('onboarding')
    }
    // There should be at least one onboarding template
    expect(json.data.length).toBeGreaterThan(0)
  })

  it('filters by trigger_type query param', async () => {
    setupAuth({ authenticated: true, roles: ['manager'] })

    const res = await GET(
      makeRequest('http://localhost:3000/api/automations/templates?trigger_type=classpass_repeat'),
    )
    expect(res.status).toBe(200)

    const json = await res.json()
    for (const t of json.data) {
      expect(t.trigger_type).toBe('classpass_repeat')
    }
    expect(json.data.length).toBeGreaterThan(0)
  })

  it('returns empty array when filters match nothing', async () => {
    setupAuth({ authenticated: true, roles: ['owner'] })

    const res = await GET(
      makeRequest('http://localhost:3000/api/automations/templates?category=nonexistent'),
    )
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.data).toHaveLength(0)
    expect(json.count).toBe(0)
  })

  it('requires authentication', async () => {
    setupAuth({ authenticated: false })

    const res = await GET(makeRequest('http://localhost:3000/api/automations/templates'))
    expect(res.status).toBe(401)

    const json = await res.json()
    expect(json.error).toBeDefined()
  })

  it('requires admin/owner/manager role', async () => {
    setupAuth({ authenticated: true, roles: ['member'] })

    const res = await GET(makeRequest('http://localhost:3000/api/automations/templates'))
    expect(res.status).toBe(403)

    const json = await res.json()
    expect(json.error).toBeDefined()
  })

  it('returns correct template structure', async () => {
    setupAuth({ authenticated: true, roles: ['owner'] })

    const res = await GET(makeRequest('http://localhost:3000/api/automations/templates'))
    const json = await res.json()

    for (const template of json.data) {
      expect(template).toHaveProperty('slug')
      expect(template).toHaveProperty('name')
      expect(template).toHaveProperty('description')
      expect(template).toHaveProperty('trigger_type')
      expect(template).toHaveProperty('trigger_config')
      expect(template).toHaveProperty('steps')
      expect(template).toHaveProperty('exit_conditions')
      expect(template).toHaveProperty('allow_reenrollment')
      expect(template).toHaveProperty('reenrollment_cooldown_days')
      expect(template).toHaveProperty('category')
      expect(Array.isArray(template.steps)).toBe(true)
    }
  })
})

// =========================================================================
// AUTOMATION_TEMPLATES structure validation
// =========================================================================

describe('AUTOMATION_TEMPLATES structure', () => {
  const VALID_TRIGGER_TYPES = [
    'signup', 'no_show', 'churn_risk', 'credit_expiry', 'birthday',
    'milestone', 'membership_change', 'booking_completed', 'failed_payment',
    'inactivity', 'referral',
    // New behavioral triggers
    'never_booked', 'classpass_repeat', 'one_and_done',
    'cooling_off', 'plan_upgrade_candidate', 'class_type_fan',
  ]

  const VALID_STEP_TYPES = ['email', 'wait', 'condition', 'sms', 'tag', 'update_field']

  const VALID_CATEGORIES = ['onboarding', 'retention', 'upsell', 'engagement', 'winback', 'conversion']

  it('every template has required fields', () => {
    for (const template of AUTOMATION_TEMPLATES) {
      expect(typeof template.slug).toBe('string')
      expect(template.slug.length).toBeGreaterThan(0)

      expect(typeof template.name).toBe('string')
      expect(template.name.length).toBeGreaterThan(0)

      expect(typeof template.description).toBe('string')
      expect(template.description.length).toBeGreaterThan(0)

      expect(typeof template.trigger_type).toBe('string')
      expect(template.trigger_type.length).toBeGreaterThan(0)

      expect(template.trigger_config).toBeDefined()
      expect(typeof template.trigger_config).toBe('object')

      expect(Array.isArray(template.steps)).toBe(true)
      expect(template.steps.length).toBeGreaterThan(0)

      expect(template.exit_conditions).toBeDefined()
      expect(typeof template.exit_conditions).toBe('object')

      expect(typeof template.allow_reenrollment).toBe('boolean')
      expect(typeof template.reenrollment_cooldown_days).toBe('number')
      expect(template.reenrollment_cooldown_days).toBeGreaterThanOrEqual(0)

      expect(typeof template.category).toBe('string')
    }
  })

  it('trigger_types are valid', () => {
    for (const template of AUTOMATION_TEMPLATES) {
      expect(VALID_TRIGGER_TYPES).toContain(template.trigger_type)
    }
  })

  it('step types are valid (email, wait, condition, tag, update_field)', () => {
    for (const template of AUTOMATION_TEMPLATES) {
      for (const step of template.steps) {
        expect(VALID_STEP_TYPES).toContain(step.type)
      }
    }
  })

  it('email steps have subject and body', () => {
    for (const template of AUTOMATION_TEMPLATES) {
      for (const step of template.steps) {
        if (step.type === 'email') {
          expect(typeof step.subject).toBe('string')
          expect(step.subject!.length).toBeGreaterThan(0)
          expect(typeof step.body).toBe('string')
          expect(step.body!.length).toBeGreaterThan(0)
        }
      }
    }
  })

  it('wait steps have delay_minutes', () => {
    for (const template of AUTOMATION_TEMPLATES) {
      for (const step of template.steps) {
        if (step.type === 'wait') {
          expect(typeof step.delay_minutes).toBe('number')
          expect(step.delay_minutes!).toBeGreaterThan(0)
        }
      }
    }
  })

  it('condition steps have condition_type and branch indices', () => {
    for (const template of AUTOMATION_TEMPLATES) {
      for (const step of template.steps) {
        if (step.type === 'condition') {
          expect(typeof step.condition_type).toBe('string')
          expect(typeof step.true_branch).toBe('number')
          expect(typeof step.false_branch).toBe('number')
        }
      }
    }
  })

  it('tag steps have tag_name and action', () => {
    for (const template of AUTOMATION_TEMPLATES) {
      for (const step of template.steps) {
        if (step.type === 'tag') {
          expect(typeof step.tag_name).toBe('string')
          expect(step.tag_name!.length).toBeGreaterThan(0)
          expect(['add', 'remove']).toContain(step.action)
        }
      }
    }
  })

  it('update_field steps have field and value', () => {
    for (const template of AUTOMATION_TEMPLATES) {
      for (const step of template.steps) {
        if (step.type === 'update_field') {
          expect(typeof step.field).toBe('string')
          expect(step.field!.length).toBeGreaterThan(0)
          expect(step.value).toBeDefined()
        }
      }
    }
  })

  it('exit_conditions are properly structured', () => {
    for (const template of AUTOMATION_TEMPLATES) {
      const ec = template.exit_conditions as Record<string, unknown>
      // exit_conditions should be an object (can be empty for class_type_fan)
      expect(typeof ec).toBe('object')
      expect(ec).not.toBeNull()

      // If conditions array exists, each condition should have a type
      if (ec.conditions && Array.isArray(ec.conditions)) {
        for (const cond of ec.conditions as { type: string }[]) {
          expect(typeof cond.type).toBe('string')
          expect(cond.type.length).toBeGreaterThan(0)
        }
      }
    }
  })

  it('no duplicate slugs', () => {
    const slugs = AUTOMATION_TEMPLATES.map((t) => t.slug)
    const uniqueSlugs = new Set(slugs)
    expect(uniqueSlugs.size).toBe(slugs.length)
  })

  it('all 6 templates are present', () => {
    expect(AUTOMATION_TEMPLATES).toHaveLength(6)

    const expectedSlugs = [
      'welcome-never-booked-nudge',
      'classpass-conversion-offer',
      'winback-one-and-done',
      'retention-cooling-off',
      'upsell-plan-upgrade',
      'engagement-class-type-fan',
    ]

    const actualSlugs = AUTOMATION_TEMPLATES.map((t) => t.slug)
    for (const slug of expectedSlugs) {
      expect(actualSlugs).toContain(slug)
    }
  })

  it('categories are valid', () => {
    for (const template of AUTOMATION_TEMPLATES) {
      expect(VALID_CATEGORIES).toContain(template.category)
    }
  })

  it('slugs are kebab-case', () => {
    const kebabRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/
    for (const template of AUTOMATION_TEMPLATES) {
      expect(template.slug).toMatch(kebabRegex)
    }
  })

  it('each template has at least one email step', () => {
    for (const template of AUTOMATION_TEMPLATES) {
      const emailSteps = template.steps.filter((s) => s.type === 'email')
      expect(emailSteps.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('condition branch indices reference valid step indices', () => {
    for (const template of AUTOMATION_TEMPLATES) {
      const maxIndex = template.steps.length - 1
      for (const step of template.steps) {
        if (step.type === 'condition') {
          expect(step.true_branch).toBeLessThanOrEqual(maxIndex)
          expect(step.true_branch).toBeGreaterThanOrEqual(0)
          expect(step.false_branch).toBeLessThanOrEqual(maxIndex)
          expect(step.false_branch).toBeGreaterThanOrEqual(0)
        }
      }
    }
  })
})
