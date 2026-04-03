import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Constants ──────────────────────────────────────────────────────
const TEST_USER_ID = "aaaaaaaa-1111-2222-3333-444444444444";
const TEST_STUDIO_ID = "bbbbbbbb-1111-2222-3333-444444444444";
const TEST_STAFF_ID = "ssssssss-1111-2222-3333-444444444444";
const TEST_PROFILE_ID = "pppppppp-1111-2222-3333-444444444444";

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
  staffList?: unknown[];
  staffError?: boolean;
  staffCount?: number;
  profileExists?: boolean;
  duplicateStaff?: boolean;
  profileInsertResult?: { data: unknown; error: unknown };
  staffInsertResult?: { data: unknown; error: unknown };
}) {
  const o = {
    authenticated: true,
    roles: ["owner"],
    staffList: [],
    staffError: false,
    staffCount: 0,
    profileExists: false,
    duplicateStaff: false,
    profileInsertResult: { data: { id: TEST_PROFILE_ID }, error: null },
    staffInsertResult: {
      data: { id: TEST_STAFF_ID, role: "trainer", is_active: true, profile: { id: TEST_PROFILE_ID, full_name: "New Staff", email: "new@test.com" } },
      error: null,
    },
    ...opts,
  };

  let profilesCallCount = 0;
  let staffCallCount = 0;

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
          // Auth profile
          return createChainableMock({ data: { studio_id: TEST_STUDIO_ID, roles: o.roles }, error: null });
        }
        if (profilesCallCount === 2) {
          // Check existing profile by email (POST)
          return createChainableMock({
            data: o.profileExists ? { id: TEST_PROFILE_ID } : null,
            error: null,
          });
        }
        // Create new profile (POST)
        return createChainableMock(o.profileInsertResult);
      }
      if (table === "staff") {
        staffCallCount++;
        if (o.staffError) {
          return createChainableMock({ data: null, error: { message: "DB error" }, count: null });
        }
        if (o.staffList.length > 0 || o.staffCount > 0) {
          return createChainableMock({ data: o.staffList, error: null, count: o.staffCount });
        }
        // POST: first is duplicate check, second is insert
        if (staffCallCount === 1) {
          return createChainableMock({
            data: o.duplicateStaff ? { id: "existing" } : null,
            error: null,
          });
        }
        return createChainableMock(o.staffInsertResult);
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

const { GET, POST } = await import("@/app/api/staff/route");

// ─── GET Tests ──────────────────────────────────────────────────────
describe("GET /api/staff", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    supabaseMock = buildSupabaseMock({ authenticated: false });
    const res = await GET(makeRequest("http://localhost:3000/api/staff"));
    expect(res.status).toBe(401);
  });

  it("returns 403 when user lacks role", async () => {
    supabaseMock = buildSupabaseMock({ roles: ["member"] });
    const res = await GET(makeRequest("http://localhost:3000/api/staff"));
    expect(res.status).toBe(403);
  });

  it("returns staff list on success", async () => {
    const staff = [{ id: TEST_STAFF_ID, role: "trainer", is_active: true }];
    supabaseMock = buildSupabaseMock({ staffList: staff, staffCount: 1 });
    const res = await GET(makeRequest("http://localhost:3000/api/staff?limit=10"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual(staff);
  });

  it("returns 500 when query fails", async () => {
    supabaseMock = buildSupabaseMock({ staffError: true });
    const res = await GET(makeRequest("http://localhost:3000/api/staff"));
    expect(res.status).toBe(500);
  });
});

// ─── POST Tests ─────────────────────────────────────────────────────
describe("POST /api/staff", () => {
  beforeEach(() => vi.clearAllMocks());

  const validBody = { email: "trainer@test.com", full_name: "New Trainer", role: "trainer" };

  it("returns 401 when unauthenticated", async () => {
    supabaseMock = buildSupabaseMock({ authenticated: false });
    const res = await POST(
      makeRequest("http://localhost:3000/api/staff", { method: "POST", body: JSON.stringify(validBody) })
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when required fields missing", async () => {
    supabaseMock = buildSupabaseMock({});
    const res = await POST(
      makeRequest("http://localhost:3000/api/staff", { method: "POST", body: JSON.stringify({ email: "a@b.com" }) })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when email format is invalid", async () => {
    supabaseMock = buildSupabaseMock({});
    const res = await POST(
      makeRequest("http://localhost:3000/api/staff", {
        method: "POST",
        body: JSON.stringify({ ...validBody, email: "not-email" }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 409 when staff record already exists", async () => {
    supabaseMock = buildSupabaseMock({ profileExists: true, duplicateStaff: true });
    const res = await POST(
      makeRequest("http://localhost:3000/api/staff", { method: "POST", body: JSON.stringify(validBody) })
    );
    expect(res.status).toBe(409);
  });

  it("returns 201 with created staff on success", async () => {
    supabaseMock = buildSupabaseMock({});
    const res = await POST(
      makeRequest("http://localhost:3000/api/staff", { method: "POST", body: JSON.stringify(validBody) })
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.id).toBe(TEST_STAFF_ID);
  });

  it("returns 500 when staff insert fails", async () => {
    supabaseMock = buildSupabaseMock({
      staffInsertResult: { data: null, error: { message: "Insert failed" } },
    });
    const res = await POST(
      makeRequest("http://localhost:3000/api/staff", { method: "POST", body: JSON.stringify(validBody) })
    );
    expect(res.status).toBe(500);
  });
});
