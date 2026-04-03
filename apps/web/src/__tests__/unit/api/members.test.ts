import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Constants ──────────────────────────────────────────────────────
const TEST_USER_ID = "aaaaaaaa-1111-2222-3333-444444444444";
const TEST_STUDIO_ID = "bbbbbbbb-1111-2222-3333-444444444444";
const TEST_MEMBER_ID = "dddddddd-1111-2222-3333-444444444444";

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

// ─── Mock for requireRole (newer pattern) ───────────────────────────
let requireRoleMockReturn: {
  error: unknown;
  user: unknown;
  profile: unknown;
  supabase: unknown;
  studioId: string | null;
};

vi.mock("@/lib/auth/require-role", () => ({
  requireRole: vi.fn(() => Promise.resolve(requireRoleMockReturn)),
}));

// ─── Shared supabase mock for routes using requireRole ──────────────
function buildRequireRoleMock(opts: {
  authenticated?: boolean;
  hasRole?: boolean;
  membersList?: unknown[];
  membersError?: boolean;
  membersCount?: number;
  duplicateEmail?: boolean;
  insertResult?: { data: unknown; error: unknown };
}) {
  const o = {
    authenticated: true,
    hasRole: true,
    membersList: [],
    membersError: false,
    membersCount: 0,
    duplicateEmail: false,
    insertResult: { data: { id: TEST_MEMBER_ID, email: "new@test.com", full_name: "New Member" }, error: null },
    ...opts,
  };

  let profilesCallCount = 0;

  const supabaseMock = {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "members") {
        return createChainableMock({
          data: o.membersError ? null : o.membersList,
          error: o.membersError ? { message: "DB error" } : null,
          count: o.membersCount,
        });
      }
      if (table === "profiles") {
        profilesCallCount++;
        if (profilesCallCount === 1) {
          // Duplicate email check (for POST)
          return createChainableMock({
            data: o.duplicateEmail ? { id: "existing-id" } : null,
            error: null,
          });
        }
        // Insert (for POST)
        return createChainableMock(o.insertResult);
      }
      // activity_log
      return createChainableMock({ data: null, error: null });
    }),
  };

  if (!o.authenticated) {
    requireRoleMockReturn = {
      error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "content-type": "application/json" } }),
      user: null,
      profile: null,
      supabase: supabaseMock,
      studioId: null,
    };
  } else if (!o.hasRole) {
    requireRoleMockReturn = {
      error: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { "content-type": "application/json" } }),
      user: { id: TEST_USER_ID },
      profile: { roles: ["member"] },
      supabase: supabaseMock,
      studioId: TEST_STUDIO_ID,
    };
  } else {
    requireRoleMockReturn = {
      error: null,
      user: { id: TEST_USER_ID },
      profile: { id: TEST_USER_ID, roles: ["owner"], studio_id: TEST_STUDIO_ID },
      supabase: supabaseMock,
      studioId: TEST_STUDIO_ID,
    };
  }

  return supabaseMock;
}

// ─── Import route after mocks ───────────────────────────────────────
const { GET, POST } = await import("@/app/api/members/route");

// ─── Tests ──────────────────────────────────────────────────────────
describe("GET /api/members", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    buildRequireRoleMock({ authenticated: false });
    const res = await GET(
      makeRequest("http://localhost:3000/api/members")
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when user lacks owner/manager role", async () => {
    buildRequireRoleMock({ hasRole: false });
    const res = await GET(
      makeRequest("http://localhost:3000/api/members")
    );
    expect(res.status).toBe(403);
  });

  it("returns paginated members on success", async () => {
    const members = [
      { id: TEST_MEMBER_ID, full_name: "Test Member", membership_status: "active" },
    ];
    buildRequireRoleMock({ membersList: members, membersCount: 1 });
    const res = await GET(
      makeRequest("http://localhost:3000/api/members?limit=10&offset=0")
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual(members);
    expect(json.count).toBe(1);
  });

  it("returns 500 when query fails", async () => {
    buildRequireRoleMock({ membersError: true });
    const res = await GET(
      makeRequest("http://localhost:3000/api/members")
    );
    expect(res.status).toBe(500);
  });
});

describe("POST /api/members", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    buildRequireRoleMock({ authenticated: false });
    const res = await POST(
      makeRequest("http://localhost:3000/api/members", {
        method: "POST",
        body: JSON.stringify({ email: "a@b.com", full_name: "Test" }),
      })
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when email or full_name is missing", async () => {
    buildRequireRoleMock({});
    const res = await POST(
      makeRequest("http://localhost:3000/api/members", {
        method: "POST",
        body: JSON.stringify({ email: "a@b.com" }),
      })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/required/i);
  });

  it("returns 400 when email format is invalid", async () => {
    buildRequireRoleMock({});
    const res = await POST(
      makeRequest("http://localhost:3000/api/members", {
        method: "POST",
        body: JSON.stringify({ email: "not-an-email", full_name: "Test" }),
      })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/email/i);
  });

  it("returns 409 when email already exists in studio", async () => {
    buildRequireRoleMock({ duplicateEmail: true });
    const res = await POST(
      makeRequest("http://localhost:3000/api/members", {
        method: "POST",
        body: JSON.stringify({ email: "existing@test.com", full_name: "Test" }),
      })
    );
    expect(res.status).toBe(409);
  });

  it("returns 201 with created member on success", async () => {
    const created = { id: TEST_MEMBER_ID, email: "new@test.com", full_name: "New Member", roles: ["member"] };
    buildRequireRoleMock({ insertResult: { data: created, error: null } });
    const res = await POST(
      makeRequest("http://localhost:3000/api/members", {
        method: "POST",
        body: JSON.stringify({ email: "new@test.com", full_name: "New Member" }),
      })
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.email).toBe("new@test.com");
  });

  it("returns 500 when insert fails", async () => {
    buildRequireRoleMock({ insertResult: { data: null, error: { message: "Insert failed" } } });
    const res = await POST(
      makeRequest("http://localhost:3000/api/members", {
        method: "POST",
        body: JSON.stringify({ email: "new@test.com", full_name: "New Member" }),
      })
    );
    expect(res.status).toBe(500);
  });
});
