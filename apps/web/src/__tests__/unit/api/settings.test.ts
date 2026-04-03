import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Constants ──────────────────────────────────────────────────────
const TEST_USER_ID = "aaaaaaaa-1111-2222-3333-444444444444";
const TEST_STUDIO_ID = "bbbbbbbb-1111-2222-3333-444444444444";

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
  settings?: unknown;
  settingsError?: boolean;
  locationFallback?: unknown;
  locationError?: boolean;
  existingSettings?: boolean;
  updateResult?: { data: unknown; error: unknown };
}) {
  const o = {
    authenticated: true,
    roles: ["owner"],
    settings: null as unknown,
    settingsError: false,
    locationFallback: null as unknown,
    locationError: false,
    existingSettings: true,
    updateResult: { data: { id: "s1", name: "Updated Studio" }, error: null },
    ...opts,
  };

  let studioSettingsCallCount = 0;

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
          data: { studio_id: TEST_STUDIO_ID, roles: o.roles },
          error: null,
        });
      }
      if (table === "studio_settings") {
        studioSettingsCallCount++;
        if (studioSettingsCallCount === 1) {
          // GET: fetch settings / PUT: check existing
          if (o.settingsError) {
            return createChainableMock({ data: null, error: { message: "Not found" } });
          }
          return createChainableMock({
            data: o.settings ?? (o.existingSettings ? { id: "s1", name: "Test Studio" } : null),
            error: o.settings ? null : (o.existingSettings ? null : null),
          });
        }
        // PUT: update or insert
        return createChainableMock(o.updateResult);
      }
      if (table === "locations") {
        if (o.locationError) {
          return createChainableMock({ data: null, error: { message: "Not found" } });
        }
        return createChainableMock({
          data: o.locationFallback ?? { id: "loc1", name: "Main Location" },
          error: null,
        });
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

const { GET, PUT } = await import("@/app/api/settings/route");

// ─── GET Tests ──────────────────────────────────────────────────────
describe("GET /api/settings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    supabaseMock = buildSupabaseMock({ authenticated: false });
    const res = await GET(makeRequest("http://localhost:3000/api/settings"));
    expect(res.status).toBe(401);
  });

  it("returns 403 when user lacks role", async () => {
    supabaseMock = buildSupabaseMock({ roles: ["member"] });
    const res = await GET(makeRequest("http://localhost:3000/api/settings"));
    expect(res.status).toBe(403);
  });

  it("returns settings on success", async () => {
    const settings = { id: "s1", name: "Test Studio", timezone: "US/Eastern" };
    supabaseMock = buildSupabaseMock({ settings });
    const res = await GET(makeRequest("http://localhost:3000/api/settings"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.name).toBe("Test Studio");
  });

  it("falls back to locations when settings not found", async () => {
    supabaseMock = buildSupabaseMock({
      settingsError: true,
      locationFallback: { id: "loc1", name: "Main Location" },
    });
    const res = await GET(makeRequest("http://localhost:3000/api/settings"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.name).toBe("Main Location");
  });

  it("returns 404 when neither settings nor locations found", async () => {
    supabaseMock = buildSupabaseMock({ settingsError: true, locationError: true });
    const res = await GET(makeRequest("http://localhost:3000/api/settings"));
    expect(res.status).toBe(404);
  });
});

// ─── PUT Tests ──────────────────────────────────────────────────────
describe("PUT /api/settings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    supabaseMock = buildSupabaseMock({ authenticated: false });
    const res = await PUT(
      makeRequest("http://localhost:3000/api/settings", { method: "PUT", body: JSON.stringify({ name: "New" }) })
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when no valid fields provided", async () => {
    supabaseMock = buildSupabaseMock({});
    const res = await PUT(
      makeRequest("http://localhost:3000/api/settings", { method: "PUT", body: JSON.stringify({ invalid: "x" }) })
    );
    expect(res.status).toBe(400);
  });

  it("returns 200 with updated settings on success", async () => {
    supabaseMock = buildSupabaseMock({
      updateResult: { data: { id: "s1", name: "Updated" }, error: null },
    });
    const res = await PUT(
      makeRequest("http://localhost:3000/api/settings", { method: "PUT", body: JSON.stringify({ name: "Updated" }) })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.name).toBe("Updated");
  });
});
