import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Constants ──────────────────────────────────────────────────────
const TEST_USER_ID = "aaaaaaaa-1111-2222-3333-444444444444";
const TEST_STUDIO_ID = "bbbbbbbb-1111-2222-3333-444444444444";
const TEST_SIM_ID = "ssssssss-1111-2222-3333-444444444444";

function makeRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

// ─── Chainable mock ─────────────────────────────────────────────────
import { createChainableMock, type MockReturnValue } from "@/__tests__/helpers/mock-chainable";

// ─── Supabase mock builder ──────────────────────────────────────────
function buildSupabaseMock(opts: {
  authenticated?: boolean;
  roles?: string[];
  simulations?: unknown[];
  simulationsError?: boolean;
  insertResult?: { data: unknown; error: unknown };
}) {
  const o = {
    authenticated: true,
    roles: ["owner"],
    simulations: [],
    simulationsError: false,
    insertResult: { data: { id: TEST_SIM_ID, name: "Test Sim", status: "draft" }, error: null },
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
          data: { studio_id: TEST_STUDIO_ID, roles: o.roles },
          error: null,
        });
      }
      if (table === "pricing_simulations") {
        if (o.simulationsError) {
          return createChainableMock({ data: null, error: { message: "DB error" } });
        }
        if (o.simulations.length > 0) {
          return createChainableMock({ data: o.simulations, error: null });
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

const { GET, POST } = await import("@/app/api/pricing-simulator/route");

// ─── GET Tests ──────────────────────────────────────────────────────
describe("GET /api/pricing-simulator", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    supabaseMock = buildSupabaseMock({ authenticated: false });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 when user lacks allowed role", async () => {
    supabaseMock = buildSupabaseMock({ roles: ["member"] });
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns simulations on success", async () => {
    const sims = [{ id: TEST_SIM_ID, name: "Test", status: "draft" }];
    supabaseMock = buildSupabaseMock({ simulations: sims });
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual(sims);
  });

  it("returns 500 when query fails", async () => {
    supabaseMock = buildSupabaseMock({ simulationsError: true });
    const res = await GET();
    expect(res.status).toBe(500);
  });
});

// ─── POST Tests ─────────────────────────────────────────────────────
describe("POST /api/pricing-simulator", () => {
  beforeEach(() => vi.clearAllMocks());

  const validBody = {
    name: "Price Increase Test",
    changes: [{ plan_id: "p1", plan_name: "Unlimited", current_price: 99, new_price: 119 }],
  };

  it("returns 401 when unauthenticated", async () => {
    supabaseMock = buildSupabaseMock({ authenticated: false });
    const res = await POST(
      makeRequest("http://localhost:3000/api/pricing-simulator", {
        method: "POST",
        body: JSON.stringify(validBody),
      })
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when name is missing", async () => {
    supabaseMock = buildSupabaseMock({});
    const res = await POST(
      makeRequest("http://localhost:3000/api/pricing-simulator", {
        method: "POST",
        body: JSON.stringify({ changes: validBody.changes }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when changes array is empty", async () => {
    supabaseMock = buildSupabaseMock({});
    const res = await POST(
      makeRequest("http://localhost:3000/api/pricing-simulator", {
        method: "POST",
        body: JSON.stringify({ name: "Test", changes: [] }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when change entry is incomplete", async () => {
    supabaseMock = buildSupabaseMock({});
    const res = await POST(
      makeRequest("http://localhost:3000/api/pricing-simulator", {
        method: "POST",
        body: JSON.stringify({ name: "Test", changes: [{ plan_id: "p1" }] }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 201 with created simulation on success", async () => {
    supabaseMock = buildSupabaseMock({});
    const res = await POST(
      makeRequest("http://localhost:3000/api/pricing-simulator", {
        method: "POST",
        body: JSON.stringify(validBody),
      })
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.id).toBe(TEST_SIM_ID);
  });

  it("returns 500 when insert fails", async () => {
    supabaseMock = buildSupabaseMock({
      insertResult: { data: null, error: { message: "Insert failed" } },
    });
    const res = await POST(
      makeRequest("http://localhost:3000/api/pricing-simulator", {
        method: "POST",
        body: JSON.stringify(validBody),
      })
    );
    expect(res.status).toBe(500);
  });
});
