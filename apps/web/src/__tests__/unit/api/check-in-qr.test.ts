import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Constants ──────────────────────────────────────────────────────
const TEST_USER_ID = "aaaaaaaa-1111-2222-3333-444444444444";
const TEST_STUDIO_ID = "bbbbbbbb-1111-2222-3333-444444444444";
const TEST_MEMBER_ID = "dddddddd-1111-2222-3333-444444444444";
const TEST_BOOKING_ID = "eeeeeeee-1111-2222-3333-444444444444";
const TEST_TOKEN = "qr-token-abc123";
const TEST_TOKEN_ID = "ffffffff-1111-2222-3333-444444444444";
const TEST_CLASS_ID = "cccccccc-1111-2222-3333-444444444444";

function makeRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

// ─── Chainable mock ─────────────────────────────────────────────────
type MockReturnValue = { data: unknown; error: unknown; count?: number | null };

function createChainableMock(response: MockReturnValue) {
  const chain: Record<string, unknown> = {};
  const methods = [
    "from", "select", "insert", "update", "delete",
    "eq", "neq", "gte", "lte", "gt", "lt", "in", "or", "not", "is",
    "order", "limit", "range", "single", "maybeSingle",
    "match", "contains", "filter", "textSearch",
  ];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.then = (resolve: (v: unknown) => void) =>
    resolve({ data: response.data, error: response.error, count: response.count ?? null });
  return chain;
}

// ─── Supabase mock builder ──────────────────────────────────────────
function buildSupabaseMock(opts: {
  authenticated?: boolean;
  roles?: string[];
  tokenRecord?: unknown;
  tokenError?: boolean;
  bookings?: unknown[];
  bookingError?: boolean;
  bookingUpdateResult?: { data: unknown; error: unknown };
  memberInfo?: { full_name: string; email: string };
  checkInCount?: number;
  bonusThreshold?: number;
  existingBonus?: boolean;
}) {
  const o = {
    authenticated: true,
    roles: ["owner"],
    tokenRecord: null,
    tokenError: false,
    bookings: [],
    bookingError: false,
    bookingUpdateResult: { data: { id: TEST_BOOKING_ID, status: "checked_in" }, error: null },
    memberInfo: { full_name: "Test Member", email: "member@test.com" },
    checkInCount: 0,
    bonusThreshold: 7,
    existingBonus: false,
    ...opts,
  };

  let profileCallCount = 0;
  let bookingsCallCount = 0;

  const mock = {
    auth: {
      getUser: vi.fn().mockResolvedValue(
        o.authenticated
          ? { data: { user: { id: TEST_USER_ID } }, error: null }
          : { data: { user: null }, error: { message: "Unauthorized" } }
      ),
    },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "profiles") {
        profileCallCount++;
        if (profileCallCount === 1) {
          // Auth profile lookup
          return createChainableMock({
            data: { studio_id: TEST_STUDIO_ID, roles: o.roles },
            error: null,
          });
        }
        // Member info lookup
        return createChainableMock({
          data: o.memberInfo,
          error: null,
        });
      }
      if (table === "check_in_tokens") {
        return createChainableMock({
          data: o.tokenError ? null : o.tokenRecord,
          error: o.tokenError ? { message: "Not found" } : null,
        });
      }
      if (table === "bookings") {
        bookingsCallCount++;
        if (bookingsCallCount === 1) {
          // Find booking query
          return createChainableMock({
            data: o.bookingError ? null : o.bookings,
            error: o.bookingError ? { message: "DB error" } : null,
          });
        }
        if (bookingsCallCount === 2) {
          // Update booking
          return createChainableMock(o.bookingUpdateResult);
        }
        // Check-in count for trainer bonus
        return createChainableMock({
          data: null,
          error: null,
          count: o.checkInCount,
        });
      }
      if (table === "studio_settings") {
        return createChainableMock({
          data: { trainer_bonus_threshold: o.bonusThreshold },
          error: null,
        });
      }
      if (table === "trainer_bonuses") {
        return createChainableMock({
          data: o.existingBonus ? { id: "existing-bonus" } : null,
          error: null,
        });
      }
      // activity_log and other tables
      return createChainableMock({ data: null, error: null });
    }),
  };

  return mock;
}

// ─── Module mocks ───────────────────────────────────────────────────
let supabaseMock: ReturnType<typeof buildSupabaseMock>;

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(() => Promise.resolve(supabaseMock)),
}));

// ─── Import route after mocks ───────────────────────────────────────
const { POST } = await import("@/app/api/check-in/qr/route");

// ─── Tests ──────────────────────────────────────────────────────────
describe("POST /api/check-in/qr", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const body = (overrides = {}) =>
    JSON.stringify({ member_id: TEST_MEMBER_ID, token: TEST_TOKEN, ...overrides });

  it("returns 401 when unauthenticated", async () => {
    supabaseMock = buildSupabaseMock({ authenticated: false });
    const res = await POST(
      makeRequest("http://localhost:3000/api/check-in/qr", { method: "POST", body: body() })
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when user lacks owner/manager role", async () => {
    supabaseMock = buildSupabaseMock({ roles: ["member"] });
    const res = await POST(
      makeRequest("http://localhost:3000/api/check-in/qr", { method: "POST", body: body() })
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 when member_id or token is missing", async () => {
    supabaseMock = buildSupabaseMock({});
    const res = await POST(
      makeRequest("http://localhost:3000/api/check-in/qr", { method: "POST", body: JSON.stringify({}) })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/required/i);
  });

  it("returns 400 when token is invalid", async () => {
    supabaseMock = buildSupabaseMock({ tokenError: true });
    const res = await POST(
      makeRequest("http://localhost:3000/api/check-in/qr", { method: "POST", body: body() })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/invalid/i);
  });

  it("returns 400 when token is expired", async () => {
    supabaseMock = buildSupabaseMock({
      tokenRecord: {
        id: TEST_TOKEN_ID,
        token: TEST_TOKEN,
        member_id: TEST_MEMBER_ID,
        studio_id: TEST_STUDIO_ID,
        expires_at: new Date(Date.now() - 60000).toISOString(), // expired
        used_at: null,
      },
    });
    const res = await POST(
      makeRequest("http://localhost:3000/api/check-in/qr", { method: "POST", body: body() })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/expired/i);
  });

  it("returns 400 when token already used", async () => {
    supabaseMock = buildSupabaseMock({
      tokenRecord: {
        id: TEST_TOKEN_ID,
        token: TEST_TOKEN,
        member_id: TEST_MEMBER_ID,
        studio_id: TEST_STUDIO_ID,
        expires_at: new Date(Date.now() + 60000).toISOString(),
        used_at: new Date().toISOString(), // already used
      },
    });
    const res = await POST(
      makeRequest("http://localhost:3000/api/check-in/qr", { method: "POST", body: body() })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/already been used/i);
  });

  it("returns 404 when no matching booking found", async () => {
    supabaseMock = buildSupabaseMock({
      tokenRecord: {
        id: TEST_TOKEN_ID,
        token: TEST_TOKEN,
        member_id: TEST_MEMBER_ID,
        studio_id: TEST_STUDIO_ID,
        expires_at: new Date(Date.now() + 60000).toISOString(),
        used_at: null,
      },
      bookings: [],
    });
    const res = await POST(
      makeRequest("http://localhost:3000/api/check-in/qr", { method: "POST", body: body() })
    );
    expect(res.status).toBe(404);
  });

  it("returns 200 with check-in data on success", async () => {
    const booking = {
      id: TEST_BOOKING_ID,
      member_id: TEST_MEMBER_ID,
      class_id: TEST_CLASS_ID,
      status: "confirmed",
      classes: { id: TEST_CLASS_ID, name: "Morning Sauna", start_time: new Date().toISOString(), end_time: new Date().toISOString(), trainer_id: null },
    };
    supabaseMock = buildSupabaseMock({
      tokenRecord: {
        id: TEST_TOKEN_ID,
        token: TEST_TOKEN,
        member_id: TEST_MEMBER_ID,
        studio_id: TEST_STUDIO_ID,
        expires_at: new Date(Date.now() + 60000).toISOString(),
        used_at: null,
      },
      bookings: [booking],
    });
    const res = await POST(
      makeRequest("http://localhost:3000/api/check-in/qr", { method: "POST", body: body() })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.member_name).toBe("Test Member");
  });

  it("returns 500 when booking update fails", async () => {
    const booking = {
      id: TEST_BOOKING_ID,
      member_id: TEST_MEMBER_ID,
      class_id: TEST_CLASS_ID,
      status: "confirmed",
      classes: { id: TEST_CLASS_ID, name: "Morning Sauna", start_time: new Date().toISOString(), end_time: new Date().toISOString(), trainer_id: null },
    };
    supabaseMock = buildSupabaseMock({
      tokenRecord: {
        id: TEST_TOKEN_ID,
        token: TEST_TOKEN,
        member_id: TEST_MEMBER_ID,
        studio_id: TEST_STUDIO_ID,
        expires_at: new Date(Date.now() + 60000).toISOString(),
        used_at: null,
      },
      bookings: [booking],
      bookingUpdateResult: { data: null, error: { message: "Update failed" } },
    });
    const res = await POST(
      makeRequest("http://localhost:3000/api/check-in/qr", { method: "POST", body: body() })
    );
    expect(res.status).toBe(500);
  });
});
