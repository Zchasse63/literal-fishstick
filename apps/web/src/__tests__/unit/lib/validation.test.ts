import { describe, it, expect } from 'vitest'
import {
  validateBody,
  bookingCreateSchema,
  corporateCreateSchema,
  eventCreateSchema,
  normalizePhone,
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

// ─── normalizePhone ─────────────────────────────────────────

describe('normalizePhone', () => {
  it('normalizes (813) 555-1234 to E.164', () => {
    expect(normalizePhone('(813) 555-1234')).toBe('+18135551234')
  })

  it('normalizes 813-555-1234 to E.164', () => {
    expect(normalizePhone('813-555-1234')).toBe('+18135551234')
  })

  it('normalizes 813.555.1234 to E.164', () => {
    expect(normalizePhone('813.555.1234')).toBe('+18135551234')
  })

  it('normalizes 10-digit 8135551234 to E.164', () => {
    expect(normalizePhone('8135551234')).toBe('+18135551234')
  })

  it('normalizes 11-digit 18135551234 to E.164', () => {
    expect(normalizePhone('18135551234')).toBe('+18135551234')
  })

  it('passes through already-valid E.164', () => {
    expect(normalizePhone('+18135551234')).toBe('+18135551234')
  })

  it('returns null for UK number', () => {
    expect(normalizePhone('+447911123456')).toBeNull()
  })

  it('returns null for 7-digit number', () => {
    expect(normalizePhone('555-1234')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(normalizePhone('')).toBeNull()
  })

  it('returns null for null', () => {
    expect(normalizePhone(null)).toBeNull()
  })

  it('returns null for undefined', () => {
    expect(normalizePhone(undefined)).toBeNull()
  })

  it('trims whitespace before normalizing', () => {
    expect(normalizePhone('  (813) 555-1234  ')).toBe('+18135551234')
  })

  // ── Stress test: unusual but valid US formats ─────────────────────

  it('handles +1 (813) 555-1234 with country code and parens', () => {
    expect(normalizePhone('+1 (813) 555-1234')).toBe('+18135551234')
  })

  it('handles 1-813-555-1234 with dashes and country code', () => {
    expect(normalizePhone('1-813-555-1234')).toBe('+18135551234')
  })

  it('handles 1.813.555.1234 with dots and country code', () => {
    expect(normalizePhone('1.813.555.1234')).toBe('+18135551234')
  })

  it('handles +1-813-555-1234', () => {
    expect(normalizePhone('+1-813-555-1234')).toBe('+18135551234')
  })

  // ── Edge cases that should return null ────────────────────────────

  it('returns null for partial number 813-555', () => {
    expect(normalizePhone('813-555')).toBeNull()
  })

  it('returns null for too-long number 81355512345 (11 digits without leading 1)', () => {
    // 11 digits where first digit is 8, not 1 — cannot be US
    expect(normalizePhone('81355512345')).toBeNull()
  })

  it('returns null for letters mixed in 813-ABC-1234', () => {
    // After stripping non-digits, only 8131234 remains (7 digits) — not valid
    expect(normalizePhone('813-ABC-1234')).toBeNull()
  })

  it('returns null for international +44 7911 123456 (UK)', () => {
    expect(normalizePhone('+44 7911 123456')).toBeNull()
  })

  it('returns null for international +61 412 345 678 (AU)', () => {
    expect(normalizePhone('+61 412 345 678')).toBeNull()
  })

  it('returns null for extension formats 813-555-1234 x123', () => {
    // After stripping non-digits, becomes 813555123412​3 (13 digits) — not valid
    expect(normalizePhone('813-555-1234 x123')).toBeNull()
  })

  it('returns null for just country code +1', () => {
    expect(normalizePhone('+1')).toBeNull()
  })

  // ── Idempotency ──────────────────────────────────────────────────

  it('is idempotent — normalizing already-normalized number returns same', () => {
    const normalized = normalizePhone('+18135551234')
    expect(normalizePhone(normalized)).toBe('+18135551234')
  })

  it('handles multiple normalizations in sequence', () => {
    const first = normalizePhone('(813) 555-1234')
    const second = normalizePhone(first)
    const third = normalizePhone(second)
    expect(first).toBe('+18135551234')
    expect(second).toBe('+18135551234')
    expect(third).toBe('+18135551234')
  })

  // ── Boundary conditions ──────────────────────────────────────────

  it('handles string of only spaces', () => {
    expect(normalizePhone('   ')).toBeNull()
  })

  it('handles string of only special chars (---)', () => {
    expect(normalizePhone('---')).toBeNull()
  })

  it('handles zero 0000000000', () => {
    // 10 digits but not a real phone number — normalizePhone only
    // validates digit count, not semantic validity, so it adds +1 prefix
    expect(normalizePhone('0000000000')).toBe('+10000000000')
  })
})
