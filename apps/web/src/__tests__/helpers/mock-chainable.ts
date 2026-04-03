/**
 * Shared chainable Supabase query builder mock for unit tests.
 *
 * Consolidated from 13+ test files that each duplicated this pattern (MED-21).
 *
 * Usage:
 *   import { createChainableMock, MockReturnValue } from '@/__tests__/helpers/mock-chainable'
 *
 *   const mock = createChainableMock({ data: [...], error: null })
 *   // Use mock as a Supabase query builder in your test setup
 */
import { vi } from "vitest";

export type MockReturnValue = {
  data: unknown;
  error: unknown;
  count?: number | null;
};

/**
 * Creates a chainable mock that mimics the Supabase query builder.
 *
 * Every chainable method (from, select, eq, etc.) returns the chain itself.
 * Terminal methods (single, maybeSingle) resolve with the configured response.
 * The chain is also thenable, so `await supabase.from(...).select(...)` works.
 */
export function createChainableMock(response: MockReturnValue) {
  const chain: Record<string, unknown> = {};
  const methods = [
    "from",
    "select",
    "insert",
    "update",
    "upsert",
    "delete",
    "eq",
    "neq",
    "gte",
    "lte",
    "gt",
    "lt",
    "in",
    "or",
    "not",
    "is",
    "order",
    "limit",
    "range",
    "single",
    "maybeSingle",
    "match",
    "contains",
    "filter",
    "textSearch",
  ];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.then = (resolve: (v: unknown) => void) =>
    resolve({
      data: response.data,
      error: response.error,
      count: response.count ?? null,
    });
  return chain;
}
