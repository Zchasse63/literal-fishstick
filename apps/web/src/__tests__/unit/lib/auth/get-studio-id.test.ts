import { describe, it, expect, beforeEach } from 'vitest'
import { getStudioId } from '@/lib/auth/get-studio-id'

describe('getStudioId', () => {
  const HARDCODED_FALLBACK = '11111111-1111-1111-1111-111111111111'
  let originalEnv: string | undefined

  beforeEach(() => {
    originalEnv = process.env.DEFAULT_STUDIO_ID
  })

  afterEach(() => {
    // Restore the env var set in setup.ts
    process.env.DEFAULT_STUDIO_ID = originalEnv
  })

  it('returns profile studio_id when present', () => {
    const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    expect(getStudioId({ studio_id: id })).toBe(id)
  })

  it('falls back to env when profile studio_id is null', () => {
    process.env.DEFAULT_STUDIO_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    expect(getStudioId({ studio_id: null })).toBe('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
  })

  it('falls back to hardcoded UUID when profile studio_id is undefined and env is unset', () => {
    delete process.env.DEFAULT_STUDIO_ID
    expect(getStudioId({ studio_id: undefined })).toBe(HARDCODED_FALLBACK)
  })

  it('handles null-ish profile gracefully via optional chaining', () => {
    // The function signature requires an object, but the implementation uses ?.
    // so passing null (cast) should not throw
    delete process.env.DEFAULT_STUDIO_ID
    expect(getStudioId(null as unknown as { studio_id?: string | null })).toBe(HARDCODED_FALLBACK)
  })

  it('falls through when studio_id is empty string (falsy)', () => {
    process.env.DEFAULT_STUDIO_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
    expect(getStudioId({ studio_id: '' })).toBe('cccccccc-cccc-cccc-cccc-cccccccccccc')
  })
})
