import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Constants ──────────────────────────────────────────────────────
const TEST_USER_ID = "aaaaaaaa-1111-2222-3333-444444444444";
const TEST_STUDIO_ID = "11111111-1111-1111-1111-111111111111";
const TEST_INVOICE_ID = "iiiiiiii-1111-2222-3333-444444444444";

function makeRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

// ─── Chainable mock ─────────────────────────────────────────────────
import { createChainableMock, type MockReturnValue } from "@/__tests__/helpers/mock-chainable";

// ─── Supabase mock builder ──────────────────────────────────────────
function buildSupabaseMock(opts: {
  authenticated?: boolean;
  roles?: string[];
  invoice?: unknown;
  invoiceError?: boolean;
  invoiceStatus?: string;
  updateResult?: { data: unknown; error: unknown };
}) {
  const o = {
    authenticated: true,
    roles: ["owner"],
    invoice: null as unknown,
    invoiceError: false,
    invoiceStatus: "draft",
    updateResult: { data: { id: TEST_INVOICE_ID, status: "draft" }, error: null },
    ...opts,
  };

  let invoicesCallCount = 0;

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
          data: { id: TEST_USER_ID, roles: o.roles, studio_id: TEST_STUDIO_ID },
          error: null,
        });
      }
      if (table === "corporate_invoices") {
        invoicesCallCount++;
        if (invoicesCallCount === 1) {
          // GET: fetch invoice / PUT: check existing
          if (o.invoiceError) {
            return createChainableMock({ data: null, error: { message: "Not found" } });
          }
          return createChainableMock({
            data: o.invoice ?? { id: TEST_INVOICE_ID, status: o.invoiceStatus, invoice_number: "INV-001" },
            error: null,
          });
        }
        // PUT: update
        return createChainableMock(o.updateResult);
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

const { GET, PUT } = await import("@/app/api/invoices/[id]/route");

// ─── GET Tests ──────────────────────────────────────────────────────
describe("GET /api/invoices/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  const params = Promise.resolve({ id: TEST_INVOICE_ID });

  it("returns 401 when unauthenticated", async () => {
    supabaseMock = buildSupabaseMock({ authenticated: false });
    const res = await GET(makeRequest("http://localhost:3000/api/invoices/x"), { params });
    expect(res.status).toBe(401);
  });

  it("returns 403 when user lacks role", async () => {
    supabaseMock = buildSupabaseMock({ roles: ["member"] });
    const res = await GET(makeRequest("http://localhost:3000/api/invoices/x"), { params });
    expect(res.status).toBe(403);
  });

  it("returns 404 when invoice not found", async () => {
    supabaseMock = buildSupabaseMock({ invoiceError: true });
    const res = await GET(makeRequest("http://localhost:3000/api/invoices/x"), { params });
    expect(res.status).toBe(404);
  });

  it("returns 200 with invoice data on success", async () => {
    const invoice = { id: TEST_INVOICE_ID, status: "draft", total: 500 };
    supabaseMock = buildSupabaseMock({ invoice });
    const res = await GET(makeRequest("http://localhost:3000/api/invoices/x"), { params });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.id).toBe(TEST_INVOICE_ID);
  });
});

// ─── PUT Tests ──────────────────────────────────────────────────────
describe("PUT /api/invoices/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  const params = Promise.resolve({ id: TEST_INVOICE_ID });

  it("returns 401 when unauthenticated", async () => {
    supabaseMock = buildSupabaseMock({ authenticated: false });
    const res = await PUT(
      makeRequest("http://localhost:3000/api/invoices/x", { method: "PUT", body: JSON.stringify({ total: 600 }) }),
      { params }
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when invoice not found", async () => {
    supabaseMock = buildSupabaseMock({ invoiceError: true });
    const res = await PUT(
      makeRequest("http://localhost:3000/api/invoices/x", { method: "PUT", body: JSON.stringify({ total: 600 }) }),
      { params }
    );
    expect(res.status).toBe(404);
  });

  it("returns 409 when invoice is not in draft status", async () => {
    supabaseMock = buildSupabaseMock({ invoiceStatus: "sent" });
    const res = await PUT(
      makeRequest("http://localhost:3000/api/invoices/x", { method: "PUT", body: JSON.stringify({ total: 600 }) }),
      { params }
    );
    expect(res.status).toBe(409);
  });

  it("returns 400 when no valid fields provided", async () => {
    supabaseMock = buildSupabaseMock({});
    const res = await PUT(
      makeRequest("http://localhost:3000/api/invoices/x", { method: "PUT", body: JSON.stringify({ invalid_field: "x" }) }),
      { params }
    );
    expect(res.status).toBe(400);
  });

  it("returns 200 with updated invoice on success", async () => {
    const updated = { id: TEST_INVOICE_ID, status: "draft", total: 600 };
    supabaseMock = buildSupabaseMock({ updateResult: { data: updated, error: null } });
    const res = await PUT(
      makeRequest("http://localhost:3000/api/invoices/x", { method: "PUT", body: JSON.stringify({ total: 600 }) }),
      { params }
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.total).toBe(600);
  });
});
