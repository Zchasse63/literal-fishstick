import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Constants ──────────────────────────────────────────────────────
const TEST_USER_ID = "aaaaaaaa-1111-2222-3333-444444444444";
const TEST_STUDIO_ID = "bbbbbbbb-1111-2222-3333-444444444444";

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(new URL("http://localhost:3000/api/ai/search"), {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

// ─── Mocks ──────────────────────────────────────────────────────────
import { createChainableMock } from "@/__tests__/helpers/mock-chainable";

const mockTranslateToSQL = vi.fn();
const mockRateLimit = vi.fn();

let supabaseMock: Record<string, unknown>;

function buildSupabaseMock(opts: {
  authenticated?: boolean;
  roles?: string[];
  rpcData?: unknown;
  rpcError?: { message: string } | null;
}) {
  const o = {
    authenticated: true,
    roles: ["owner"],
    rpcData: null,
    rpcError: null,
    ...opts,
  };

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue(
        o.authenticated
          ? { data: { user: { id: TEST_USER_ID } }, error: null }
          : { data: { user: null }, error: { message: "Unauthorized" } }
      ),
    },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "profiles") {
        return createChainableMock({
          data: {
            id: TEST_USER_ID,
            roles: o.roles,
            studio_id: TEST_STUDIO_ID,
            full_name: "Test User",
            email: "test@example.com",
          },
          error: null,
        });
      }
      return createChainableMock({ data: null, error: null });
    }),
    rpc: vi.fn().mockImplementation(() => ({
      then: (resolve: (v: unknown) => void) => {
        resolve({ data: o.rpcData, error: o.rpcError });
      },
    })),
  };
}

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(() => Promise.resolve(supabaseMock)),
}));

vi.mock("@/lib/anthropic", () => ({
  translateToSQL: (...args: unknown[]) => mockTranslateToSQL(...args),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
}));

const { POST } = await import("@/app/api/ai/search/route");

// ─── Tests ──────────────────────────────────────────────────────────
describe("POST /api/ai/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimit.mockReturnValue({ success: true, remaining: 19 });
  });

  // -- Auth ---------------------------------------------------------------

  it("returns 401 when unauthenticated", async () => {
    supabaseMock = buildSupabaseMock({ authenticated: false });
    const res = await POST(makeRequest({ query: "show members" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when user lacks owner/manager role", async () => {
    supabaseMock = buildSupabaseMock({ roles: ["member"] });
    const res = await POST(makeRequest({ query: "show members" }));
    expect(res.status).toBe(403);
  });

  // -- Validation ---------------------------------------------------------

  it("returns 400 when query is missing", async () => {
    supabaseMock = buildSupabaseMock({});
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("query");
  });

  it("returns 400 when query is empty string", async () => {
    supabaseMock = buildSupabaseMock({});
    const res = await POST(makeRequest({ query: "   " }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when query exceeds 500 characters", async () => {
    supabaseMock = buildSupabaseMock({});
    const res = await POST(makeRequest({ query: "x".repeat(501) }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("500");
  });

  // -- Rate limiting ------------------------------------------------------

  it("returns 429 when rate limit is exceeded", async () => {
    supabaseMock = buildSupabaseMock({});
    mockRateLimit.mockReturnValue({ success: false, remaining: 0 });
    const res = await POST(makeRequest({ query: "show members" }));
    expect(res.status).toBe(429);
  });

  // -- SQL translation + execution ----------------------------------------

  it("returns translated SQL results on success", async () => {
    supabaseMock = buildSupabaseMock({
      rpcData: [{ id: "1", name: "Alice" }],
    });
    mockTranslateToSQL.mockResolvedValue({
      sql: "SELECT * FROM members WHERE studio_id = $1",
      explanation: "Fetching all members",
      result_type: "table",
      error: null,
    });

    const res = await POST(makeRequest({ query: "show members" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sql).toBeDefined();
    expect(json.explanation).toBe("Fetching all members");
    expect(json.data).toEqual([{ id: "1", name: "Alice" }]);
  });

  it("returns error when translateToSQL fails", async () => {
    supabaseMock = buildSupabaseMock({});
    mockTranslateToSQL.mockResolvedValue({
      sql: null,
      explanation: null,
      result_type: null,
      error: "Could not translate query",
    });

    const res = await POST(makeRequest({ query: "something invalid" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.error).toBe("Could not translate query");
    expect(json.data).toBeNull();
  });
});
