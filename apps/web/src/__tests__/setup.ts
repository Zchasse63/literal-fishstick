import { vi, beforeEach, afterEach } from 'vitest'

// Reset all mocks between tests
beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// Mock environment variables used across tests
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
process.env.STRIPE_SECRET_KEY = 'sk_test_fake'
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_fake'
process.env.RESEND_API_KEY = 'test-resend-key'
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key'
process.env.DEFAULT_STUDIO_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
process.env.FROM_ADDRESS = 'Test Studio <noreply@test.meridian.app>'
