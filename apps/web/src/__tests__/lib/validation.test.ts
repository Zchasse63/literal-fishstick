import { describe, it, expect } from 'vitest'
import {
  validateBody,
  bookingCreateSchema,
  corporateCreateSchema,
  eventCreateSchema,
} from '@/lib/validation'

// ─── validateBody ────────────────────────────────────────────

describe('validateBody', () => {
  const testSchema = bookingCreateSchema

  it('returns data when input is valid', () => {
    const body = {
      class_id: '11111111-1111-1111-1111-111111111111',
      member_id: '22222222-2222-2222-2222-222222222222',
    }
    const result = validateBody(testSchema, body)
    expect(result.error).toBeNull()
    expect(result.data).toEqual(body)
  })

  it('returns 400 with flatten details for missing required field', async () => {
    const body = { class_id: '11111111-1111-1111-1111-111111111111' }
    const result = validateBody(testSchema, body)
    expect(result.data).toBeNull()
    expect(result.error).not.toBeNull()

    const json = await result.error!.json()
    expect(json.error).toBe('Validation failed')
    expect(json.details).toBeDefined()
    expect(json.details.fieldErrors).toBeDefined()
    expect(result.error!.status).toBe(400)
  })

  it('returns 400 for invalid UUID format', async () => {
    const body = { class_id: 'not-a-uuid', member_id: 'also-bad' }
    const result = validateBody(testSchema, body)
    expect(result.data).toBeNull()
    expect(result.error!.status).toBe(400)
  })

  it('strips extra fields from valid input', () => {
    const body = {
      class_id: '11111111-1111-1111-1111-111111111111',
      member_id: '22222222-2222-2222-2222-222222222222',
      sneaky_extra: 'should not appear',
    }
    const result = validateBody(testSchema, body)
    expect(result.error).toBeNull()
    expect((result.data as Record<string, unknown>)).not.toHaveProperty('sneaky_extra')
  })

  it('returns 400 for null body', async () => {
    const result = validateBody(testSchema, null)
    expect(result.data).toBeNull()
    expect(result.error!.status).toBe(400)
  })

  it('returns 400 for undefined body', async () => {
    const result = validateBody(testSchema, undefined)
    expect(result.data).toBeNull()
    expect(result.error!.status).toBe(400)
  })
})

// ─── bookingCreateSchema ─────────────────────────────────────

describe('bookingCreateSchema', () => {
  it('parses valid booking input', () => {
    const result = bookingCreateSchema.safeParse({
      class_id: '11111111-1111-1111-1111-111111111111',
      member_id: '22222222-2222-2222-2222-222222222222',
    })
    expect(result.success).toBe(true)
  })

  it('fails when class_id is missing', () => {
    const result = bookingCreateSchema.safeParse({
      member_id: '22222222-2222-2222-2222-222222222222',
    })
    expect(result.success).toBe(false)
  })

  it('fails for non-UUID string', () => {
    const result = bookingCreateSchema.safeParse({
      class_id: 'hello',
      member_id: '22222222-2222-2222-2222-222222222222',
    })
    expect(result.success).toBe(false)
  })
})

// ─── corporateCreateSchema ───────────────────────────────────

describe('corporateCreateSchema', () => {
  const validMinimal = {
    name: 'Acme Corp',
    contact_name: 'Jane Doe',
    contact_email: 'jane@acme.com',
  }

  it('parses valid minimal corporate input', () => {
    const result = corporateCreateSchema.safeParse(validMinimal)
    expect(result.success).toBe(true)
  })

  it('fails for invalid email', () => {
    const result = corporateCreateSchema.safeParse({
      ...validMinimal,
      contact_email: 'not-an-email',
    })
    expect(result.success).toBe(false)
  })

  it('accepts optional fields', () => {
    const result = corporateCreateSchema.safeParse({
      ...validMinimal,
      legal_name: 'Acme Corporation LLC',
      tax_id: '12-3456789',
      contract_value: 50000,
      tags: ['premium', 'local'],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.legal_name).toBe('Acme Corporation LLC')
      expect(result.data.tags).toEqual(['premium', 'local'])
    }
  })

  it('fails for negative contract_value', () => {
    const result = corporateCreateSchema.safeParse({
      ...validMinimal,
      contract_value: -100,
    })
    expect(result.success).toBe(false)
  })
})

// ─── eventCreateSchema ───────────────────────────────────────

describe('eventCreateSchema', () => {
  const validMinimal = {
    name: 'Corporate Wellness Day',
    event_type: 'corporate',
    start_time: '2026-04-01T09:00:00Z',
    end_time: '2026-04-01T17:00:00Z',
  }

  it('parses valid minimal event input', () => {
    const result = eventCreateSchema.safeParse(validMinimal)
    expect(result.success).toBe(true)
  })

  it('fails when required fields are missing', () => {
    const result = eventCreateSchema.safeParse({
      name: 'Party',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const fields = result.error.flatten().fieldErrors
      expect(fields).toHaveProperty('event_type')
      expect(fields).toHaveProperty('start_time')
      expect(fields).toHaveProperty('end_time')
    }
  })

  it('fails for invalid contact_email', () => {
    const result = eventCreateSchema.safeParse({
      ...validMinimal,
      contact_email: 'bad-email',
    })
    expect(result.success).toBe(false)
  })

  it('fails for negative numeric fields', () => {
    const result = eventCreateSchema.safeParse({
      ...validMinimal,
      base_price: -50,
    })
    expect(result.success).toBe(false)
  })

  it('accepts all optional numeric and string fields', () => {
    const result = eventCreateSchema.safeParse({
      ...validMinimal,
      description: 'A great event',
      setup_time_minutes: 30,
      cleanup_time_minutes: 15,
      min_guests: 5,
      max_guests: 50,
      base_price: 500,
      contact_name: 'Bob',
      contact_email: 'bob@corp.com',
    })
    expect(result.success).toBe(true)
  })
})
