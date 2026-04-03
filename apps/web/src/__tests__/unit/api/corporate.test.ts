import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Constants ──────────────────────────────────────────────────────
const TEST_USER_ID = "aaaaaaaa-1111-2222-3333-444444444444";
const TEST_STUDIO_ID = "11111111-1111-1111-1111-111111111111";
const TEST_COMPANY_ID = "cccccccc-1111-2222-3333-444444444444";

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
  companiesList?: unknown[];
  companiesError?: boolean;
  companiesCount?: number;
  insertResult?: { data: unknown; error: unknown };
}) {
  const o = {
    authenticated: true,
    roles: ["admin"],
    companiesList: [],
    companiesError: false,
    companiesCount: 0,
    insertResult: {
      data: { id: TEST_COMPANY_ID, name: "Acme Corp", status: "prospect" },
      error: null,
    },
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
          data: { roles: o.roles },
          error: null,
        });
      }
      if (table === "company_accounts") {
        if (o.companiesError) {
          return createChainableMock({ data: null, error: { message: "DB error" }, count: null });
        }
        if (o.companiesList.length > 0 || o.companiesCount > 0) {
          return createChainableMock({ data: o.companiesList, error: null, count: o.companiesCount });
        }
        return createChainableMock(o.insertResult);
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

// Mock the validation module — let it pass by default
vi.mock("@/lib/validation", () => ({
  validateBody: vi.fn((_schema: unknown, body: unknown) => ({
    data: body,
    error: null,
  })),
  corporateCreateSchema: {},
}));

const { GET, POST } = await import("@/app/api/corporate/route");

// ─── GET Tests ──────────────────────────────────────────────────────
describe("GET /api/corporate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    supabaseMock = buildSupabaseMock({ authenticated: false });
    const res = await GET(makeRequest("http://localhost:3000/api/corporate"));
    expect(res.status).toBe(401);
  });

  it("returns 403 when user lacks admin/manager role", async () => {
    supabaseMock = buildSupabaseMock({ roles: ["member"] });
    const res = await GET(makeRequest("http://localhost:3000/api/corporate"));
    expect(res.status).toBe(403);
  });

  it("returns paginated companies on success", async () => {
    const companies = [{ id: TEST_COMPANY_ID, name: "Acme Corp", status: "active" }];
    supabaseMock = buildSupabaseMock({ companiesList: companies, companiesCount: 1 });
    const res = await GET(makeRequest("http://localhost:3000/api/corporate?limit=10"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual(companies);
    expect(json.count).toBe(1);
  });

  it("returns 500 when query fails", async () => {
    supabaseMock = buildSupabaseMock({ companiesError: true });
    const res = await GET(makeRequest("http://localhost:3000/api/corporate"));
    expect(res.status).toBe(500);
  });
});

// ─── POST Tests ─────────────────────────────────────────────────────
describe("POST /api/corporate", () => {
  beforeEach(() => vi.clearAllMocks());

  const validBody = {
    name: "Acme Corp",
    contact_name: "John Doe",
    contact_email: "john@acme.com",
  };

  it("returns 401 when unauthenticated", async () => {
    supabaseMock = buildSupabaseMock({ authenticated: false });
    const res = await POST(
      makeRequest("http://localhost:3000/api/corporate", { method: "POST", body: JSON.stringify(validBody) })
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when user lacks admin/manager role", async () => {
    supabaseMock = buildSupabaseMock({ roles: ["member"] });
    const res = await POST(
      makeRequest("http://localhost:3000/api/corporate", { method: "POST", body: JSON.stringify(validBody) })
    );
    expect(res.status).toBe(403);
  });

  it("returns 201 with created company on success", async () => {
    supabaseMock = buildSupabaseMock({});
    const res = await POST(
      makeRequest("http://localhost:3000/api/corporate", { method: "POST", body: JSON.stringify(validBody) })
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.id).toBe(TEST_COMPANY_ID);
  });

  it("returns 500 when insert fails", async () => {
    supabaseMock = buildSupabaseMock({
      insertResult: { data: null, error: { message: "Insert failed" } },
    });
    const res = await POST(
      makeRequest("http://localhost:3000/api/corporate", { method: "POST", body: JSON.stringify(validBody) })
    );
    expect(res.status).toBe(500);
  });
});
