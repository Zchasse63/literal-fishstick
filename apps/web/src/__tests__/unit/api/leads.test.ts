import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Constants ──────────────────────────────────────────────────────
const TEST_USER_ID = "aaaaaaaa-1111-2222-3333-444444444444";
const TEST_STUDIO_ID = "bbbbbbbb-1111-2222-3333-444444444444";
const TEST_LEAD_ID = "llllllll-1111-2222-3333-444444444444";

function makeRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

// ─── Chainable mock ─────────────────────────────────────────────────
import { createChainableMock, type MockReturnValue } from "@/__tests__/helpers/mock-chainable";

// ─── Supabase mock builder ──────────────────────────────────────────
function buildSupabaseMock(opts: {
  authenticated?: boolean;
  roles?: string[];
  leadsList?: unknown[];
  leadsError?: boolean;
  leadsCount?: number;
  duplicateEmail?: boolean;
  insertResult?: { data: unknown; error: unknown };
}) {
  const o = {
    authenticated: true,
    roles: ["admin"],
    leadsList: [],
    leadsError: false,
    leadsCount: 0,
    duplicateEmail: false,
    insertResult: {
      data: { id: TEST_LEAD_ID, first_name: "Jane", last_name: "Doe", email: "jane@test.com", status: "new" },
      error: null,
    },
    ...opts,
  };

  let leadsCallCount = 0;

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
      if (table === "leads") {
        leadsCallCount++;
        // GET list
        if (o.leadsError) {
          return createChainableMock({ data: null, error: { message: "DB error" }, count: null });
        }
        if (o.leadsList.length > 0 || o.leadsCount > 0) {
          return createChainableMock({ data: o.leadsList, error: null, count: o.leadsCount });
        }
        // POST: first call is duplicate check, second is insert
        if (leadsCallCount === 1) {
          return createChainableMock({
            data: o.duplicateEmail ? { id: "existing-id" } : null,
            error: null,
          });
        }
        return createChainableMock(o.insertResult);
      }
      // lead_activities, activity_log
      return createChainableMock({ data: null, error: null });
    }),
  };
}

// ─── Module mocks ───────────────────────────────────────────────────
let supabaseMock: ReturnType<typeof buildSupabaseMock>;

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(() => Promise.resolve(supabaseMock)),
}));

const { GET, POST } = await import("@/app/api/leads/route");

// ─── GET Tests ──────────────────────────────────────────────────────
describe("GET /api/leads", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    supabaseMock = buildSupabaseMock({ authenticated: false });
    const res = await GET(makeRequest("http://localhost:3000/api/leads"));
    expect(res.status).toBe(401);
  });

  it("returns 403 when user lacks admin/manager role", async () => {
    supabaseMock = buildSupabaseMock({ roles: ["member"] });
    const res = await GET(makeRequest("http://localhost:3000/api/leads"));
    expect(res.status).toBe(403);
  });

  it("returns paginated leads on success", async () => {
    const leads = [{ id: TEST_LEAD_ID, first_name: "Jane", status: "new" }];
    supabaseMock = buildSupabaseMock({ leadsList: leads, leadsCount: 1 });
    const res = await GET(makeRequest("http://localhost:3000/api/leads?limit=10"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual(leads);
    expect(json.count).toBe(1);
  });

  it("returns 500 when query fails", async () => {
    supabaseMock = buildSupabaseMock({ leadsError: true });
    const res = await GET(makeRequest("http://localhost:3000/api/leads"));
    expect(res.status).toBe(500);
  });
});

// ─── POST Tests ─────────────────────────────────────────────────────
describe("POST /api/leads", () => {
  beforeEach(() => vi.clearAllMocks());

  const validBody = { first_name: "Jane", last_name: "Doe", email: "jane@test.com" };

  it("returns 401 when unauthenticated", async () => {
    supabaseMock = buildSupabaseMock({ authenticated: false });
    const res = await POST(
      makeRequest("http://localhost:3000/api/leads", { method: "POST", body: JSON.stringify(validBody) })
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when required fields missing", async () => {
    supabaseMock = buildSupabaseMock({});
    const res = await POST(
      makeRequest("http://localhost:3000/api/leads", { method: "POST", body: JSON.stringify({ first_name: "Jane" }) })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when email format is invalid", async () => {
    supabaseMock = buildSupabaseMock({});
    const res = await POST(
      makeRequest("http://localhost:3000/api/leads", {
        method: "POST",
        body: JSON.stringify({ ...validBody, email: "not-email" }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 409 when lead with email already exists", async () => {
    supabaseMock = buildSupabaseMock({ duplicateEmail: true });
    const res = await POST(
      makeRequest("http://localhost:3000/api/leads", { method: "POST", body: JSON.stringify(validBody) })
    );
    expect(res.status).toBe(409);
  });

  it("returns 201 with created lead on success", async () => {
    supabaseMock = buildSupabaseMock({});
    const res = await POST(
      makeRequest("http://localhost:3000/api/leads", { method: "POST", body: JSON.stringify(validBody) })
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.id).toBe(TEST_LEAD_ID);
  });

  it("returns 500 when insert fails", async () => {
    supabaseMock = buildSupabaseMock({
      insertResult: { data: null, error: { message: "Insert failed" } },
    });
    const res = await POST(
      makeRequest("http://localhost:3000/api/leads", { method: "POST", body: JSON.stringify(validBody) })
    );
    expect(res.status).toBe(500);
  });
});
