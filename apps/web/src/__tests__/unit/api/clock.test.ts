import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Constants ──────────────────────────────────────────────────────
const TEST_USER_ID = "aaaaaaaa-1111-2222-3333-444444444444";
const TEST_STUDIO_ID = "bbbbbbbb-1111-2222-3333-444444444444";
const TEST_ENTRY_ID = "eeeeeeee-1111-2222-3333-444444444444";
const STUDIO_LAT = 27.9506;
const STUDIO_LNG = -82.4572;

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
  geofences?: unknown[];
  geofencesError?: boolean;
  locations?: unknown[];
  locationsError?: boolean;
  activeShift?: unknown;
  activeEntry?: unknown;
  insertResult?: { data: unknown; error: unknown };
  updateResult?: { data: unknown; error: unknown };
}) {
  const o = {
    authenticated: true,
    roles: ["staff"],
    geofences: [],
    geofencesError: false,
    locations: [],
    locationsError: false,
    activeShift: null as unknown,
    activeEntry: null as unknown,
    insertResult: { data: { id: TEST_ENTRY_ID, status: "active" }, error: null },
    updateResult: { data: { id: TEST_ENTRY_ID, status: "completed", total_hours: 8 }, error: null },
    ...opts,
  };

  let profilesCallCount = 0;
  let clockEntriesCallCount = 0;

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
        profilesCallCount++;
        if (profilesCallCount === 1) {
          // Role check
          return createChainableMock({ data: { roles: o.roles }, error: null });
        }
        // Studio ID
        return createChainableMock({ data: { studio_id: TEST_STUDIO_ID }, error: null });
      }
      if (table === "geofence_locations") {
        if (o.geofencesError) {
          return createChainableMock({ data: null, error: { message: "DB error" } });
        }
        return createChainableMock({ data: o.geofences, error: null });
      }
      if (table === "locations") {
        if (o.locationsError) {
          return createChainableMock({ data: null, error: { message: "Not found" } });
        }
        return createChainableMock({ data: o.locations, error: null });
      }
      if (table === "clock_entries") {
        clockEntriesCallCount++;
        if (clockEntriesCallCount === 1) {
          // First call: check active shift (clock_in) or find active entry (clock_out)
          if (o.activeShift) {
            return createChainableMock({ data: o.activeShift, error: null });
          }
          if (o.activeEntry) {
            return createChainableMock({ data: o.activeEntry, error: null });
          }
          // No active shift/entry — return null
          return createChainableMock({ data: null, error: null });
        }
        // Second call: insert (clock_in) or update (clock_out)
        return createChainableMock(o.insertResult.error ? o.insertResult : o.updateResult.error ? o.updateResult : o.insertResult);
      }
      return createChainableMock({ data: null, error: null });
    }),
  };
}

// ─── Module mocks ───────────────────────────────────────────────────
let supabaseMock: ReturnType<typeof buildSupabaseMock>;

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(() => Promise.resolve(supabaseMock)),
}));

const { POST } = await import("@/app/api/clock/route");

// ─── Tests ──────────────────────────────────────────────────────────
describe("POST /api/clock", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    supabaseMock = buildSupabaseMock({ authenticated: false });
    const res = await POST(
      makeRequest("http://localhost:3000/api/clock", {
        method: "POST",
        body: JSON.stringify({ action: "clock_in" }),
      })
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not staff", async () => {
    supabaseMock = buildSupabaseMock({ roles: ["member"] });
    const res = await POST(
      makeRequest("http://localhost:3000/api/clock", {
        method: "POST",
        body: JSON.stringify({ action: "clock_in" }),
      })
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 when action is invalid", async () => {
    supabaseMock = buildSupabaseMock({});
    const res = await POST(
      makeRequest("http://localhost:3000/api/clock", {
        method: "POST",
        body: JSON.stringify({ action: "break" }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when coordinates are out of range", async () => {
    supabaseMock = buildSupabaseMock({});
    const res = await POST(
      makeRequest("http://localhost:3000/api/clock", {
        method: "POST",
        body: JSON.stringify({ action: "clock_in", latitude: 999, longitude: 0 }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 201 when clocking in without coordinates", async () => {
    supabaseMock = buildSupabaseMock({});
    const res = await POST(
      makeRequest("http://localhost:3000/api/clock", {
        method: "POST",
        body: JSON.stringify({ action: "clock_in" }),
      })
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.id).toBe(TEST_ENTRY_ID);
  });

  it("returns 409 when already clocked in", async () => {
    supabaseMock = buildSupabaseMock({ activeShift: { id: "existing" } });
    const res = await POST(
      makeRequest("http://localhost:3000/api/clock", {
        method: "POST",
        body: JSON.stringify({ action: "clock_in" }),
      })
    );
    expect(res.status).toBe(409);
  });

  it("returns 400 when clocking out with no active entry", async () => {
    supabaseMock = buildSupabaseMock({ activeEntry: null });
    const res = await POST(
      makeRequest("http://localhost:3000/api/clock", {
        method: "POST",
        body: JSON.stringify({ action: "clock_out" }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 200 with completed entry when clocking out successfully", async () => {
    const active = { id: TEST_ENTRY_ID, clock_in: new Date(Date.now() - 8 * 3600000).toISOString(), status: "active" };
    supabaseMock = buildSupabaseMock({
      activeEntry: active,
      updateResult: { data: { id: TEST_ENTRY_ID, status: "completed", total_hours: 8 }, error: null },
    });
    const res = await POST(
      makeRequest("http://localhost:3000/api/clock", {
        method: "POST",
        body: JSON.stringify({ action: "clock_out" }),
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.total_hours).toBeGreaterThan(0);
  });
});
