import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Constants ──────────────────────────────────────────────────────
const TEST_USER_ID = "aaaaaaaa-1111-2222-3333-444444444444";
const TEST_STUDIO_ID = "bbbbbbbb-1111-2222-3333-444444444444";
const TEST_CAMPAIGN_ID = "cccccccc-1111-2222-3333-444444444444";

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

// ─── Mock for requireRole ───────────────────────────────────────────
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

function buildRequireRoleMock(opts: {
  authenticated?: boolean;
  hasRole?: boolean;
  campaignsList?: unknown[];
  campaignsError?: boolean;
  campaignsCount?: number;
  insertResult?: { data: unknown; error: unknown };
}) {
  const o = {
    authenticated: true,
    hasRole: true,
    campaignsList: [],
    campaignsError: false,
    campaignsCount: 0,
    insertResult: {
      data: { id: TEST_CAMPAIGN_ID, name: "Test Campaign", type: "email", status: "draft" },
      error: null,
    },
    ...opts,
  };

  const supabaseMock = {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "campaigns") {
        if (o.campaignsError) {
          return createChainableMock({ data: null, error: { message: "DB error" }, count: null });
        }
        if (o.campaignsList.length > 0 || o.campaignsCount > 0) {
          return createChainableMock({ data: o.campaignsList, error: null, count: o.campaignsCount });
        }
        return createChainableMock(o.insertResult);
      }
      return createChainableMock({ data: null, error: null });
    }),
  };

  if (!o.authenticated) {
    requireRoleMockReturn = {
      error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "content-type": "application/json" } }),
      user: null, profile: null, supabase: supabaseMock, studioId: null,
    };
  } else if (!o.hasRole) {
    requireRoleMockReturn = {
      error: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { "content-type": "application/json" } }),
      user: { id: TEST_USER_ID }, profile: { roles: ["member"] }, supabase: supabaseMock, studioId: TEST_STUDIO_ID,
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

const { GET, POST } = await import("@/app/api/campaigns/route");

// ─── GET Tests ──────────────────────────────────────────────────────
describe("GET /api/campaigns", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    buildRequireRoleMock({ authenticated: false });
    const res = await GET(makeRequest("http://localhost:3000/api/campaigns"));
    expect(res.status).toBe(401);
  });

  it("returns 403 when user lacks role", async () => {
    buildRequireRoleMock({ hasRole: false });
    const res = await GET(makeRequest("http://localhost:3000/api/campaigns"));
    expect(res.status).toBe(403);
  });

  it("returns paginated campaigns on success", async () => {
    const campaigns = [{ id: TEST_CAMPAIGN_ID, name: "Welcome", status: "draft" }];
    buildRequireRoleMock({ campaignsList: campaigns, campaignsCount: 1 });
    const res = await GET(makeRequest("http://localhost:3000/api/campaigns?limit=10"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual(campaigns);
    expect(json.count).toBe(1);
  });

  it("returns 500 when query fails", async () => {
    buildRequireRoleMock({ campaignsError: true });
    const res = await GET(makeRequest("http://localhost:3000/api/campaigns"));
    expect(res.status).toBe(500);
  });
});

// ─── POST Tests ─────────────────────────────────────────────────────
describe("POST /api/campaigns", () => {
  beforeEach(() => vi.clearAllMocks());

  const validBody = { name: "Spring Promo", type: "email", subject: "Hello!", body_template: "<p>Hi</p>" };

  it("returns 401 when unauthenticated", async () => {
    buildRequireRoleMock({ authenticated: false });
    const res = await POST(
      makeRequest("http://localhost:3000/api/campaigns", { method: "POST", body: JSON.stringify(validBody) })
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when name or type is missing", async () => {
    buildRequireRoleMock({});
    const res = await POST(
      makeRequest("http://localhost:3000/api/campaigns", { method: "POST", body: JSON.stringify({ name: "Test" }) })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when type is invalid", async () => {
    buildRequireRoleMock({});
    const res = await POST(
      makeRequest("http://localhost:3000/api/campaigns", { method: "POST", body: JSON.stringify({ name: "Test", type: "push" }) })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when A/B test fields are incomplete", async () => {
    buildRequireRoleMock({});
    const res = await POST(
      makeRequest("http://localhost:3000/api/campaigns", {
        method: "POST",
        body: JSON.stringify({ ...validBody, ab_test_enabled: true, variant_a_subject: "A" }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 201 with created campaign on success", async () => {
    buildRequireRoleMock({});
    const res = await POST(
      makeRequest("http://localhost:3000/api/campaigns", { method: "POST", body: JSON.stringify(validBody) })
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.id).toBe(TEST_CAMPAIGN_ID);
  });

  it("returns 500 when insert fails", async () => {
    buildRequireRoleMock({ insertResult: { data: null, error: { message: "Insert failed" } } });
    const res = await POST(
      makeRequest("http://localhost:3000/api/campaigns", { method: "POST", body: JSON.stringify(validBody) })
    );
    expect(res.status).toBe(500);
  });
});
