import { vi } from 'vitest'

/**
 * Mock for @/lib/inngest/client.
 * All send() calls become no-op spies — records event name + data
 * so tests can assert the correct Inngest events were fired.
 *
 * Usage:
 *   vi.mock('@/lib/inngest/client', () => ({ inngest: mockInngest }))
 */
export const mockInngest = {
  send: vi.fn().mockResolvedValue(undefined),
}

/**
 * Reset the send mock between tests.
 */
export function resetInngestMock() {
  mockInngest.send.mockClear()
}
