import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Constants ──────────────────────────────────────────────────────
const TEST_USER_ID = "aaaaaaaa-1111-2222-3333-444444444444";
const TEST_STUDIO_ID = "bbbbbbbb-1111-2222-3333-444444444444";
const TEST_CLASS_ID = "cccccccc-1111-2222-3333-444444444444";
const TEST_CLASS_TYPE_ID = "11111111-aaaa-bbbb-cccc-dddddddddddd";

function makeRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

// ─── Chainable mock ─────────────────────────────────────────────────
import { createChainableMock, type MockReturnValue } from "@/__tests__/helpers/mock-chainable";

// ─── Supabase mock builder ──────────────────────────────────────────
function buildSupabaseMock(opts: {
  authenticated?: boolean;
  roles?: string[];
  classesList?: unknown[];
  classesError?: boolean;
  classesCount?: number;
  classTypeExists?: boolean;
  insertResult?: { data: unknown; error: unknown };
}) {
  const o = {
    authenticated: true,
    roles: ["owner"],
    classesList: [],
    classesError: false,
    classesCount: 0,
    classTypeExists: true,
    insertResult: {
      data: { id: TEST_CLASS_ID, class_type_id: TEST_CLASS_TYPE_ID, status: "scheduled" },
      error: null,
    },
    ...opts,
  };

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
        return createChainableMock({
          data: { studio_id: TEST_STUDIO_ID, roles: o.roles },
          error: null,
        });
      }
      if (table === "classes") {
        // Could be GET list or POST insert
        if (o.classesError) {
          return createChainableMock({ data: null, error: { message: "DB error" }, count: null });
        }
        if (o.classesList.length > 0 || o.classesCount > 0) {
          return createChainableMock({ data: o.classesList, error: null, count: o.classesCount });
        }
        // For POST (insert)
        return createChainableMock(o.insertResult);
      }
      if (table === "class_types") {
        return createChainableMock({
          data: o.classTypeExists ? { id: TEST_CLASS_TYPE_ID } : null,
          error: o.classTypeExists ? null : { message: "Not found" },
        });
      }
      // activity_log
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
const { GET, POST } = await import("@/app/api/classes/route");

// ─── GET Tests ──────────────────────────────────────────────────────
describe("GET /api/classes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    supabaseMock = buildSupabaseMock({ authenticated: false });
    const res = await GET(
      makeRequest("http://localhost:3000/api/classes")
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when user lacks owner/manager role", async () => {
    supabaseMock = buildSupabaseMock({ roles: ["member"] });
    const res = await GET(
      makeRequest("http://localhost:3000/api/classes")
    );
    expect(res.status).toBe(403);
  });

  it("returns paginated classes on success", async () => {
    const classes = [
      { id: TEST_CLASS_ID, class_type_id: TEST_CLASS_TYPE_ID, status: "scheduled" },
    ];
    supabaseMock = buildSupabaseMock({ classesList: classes, classesCount: 1 });
    const res = await GET(
      makeRequest("http://localhost:3000/api/classes?limit=10")
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual(classes);
    expect(json.count).toBe(1);
  });

  it("returns 500 when query fails", async () => {
    supabaseMock = buildSupabaseMock({ classesError: true });
    const res = await GET(
      makeRequest("http://localhost:3000/api/classes")
    );
    expect(res.status).toBe(500);
  });
});

// ─── POST Tests ─────────────────────────────────────────────────────
describe("POST /api/classes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validBody = {
    class_type_id: TEST_CLASS_TYPE_ID,
    start_time: "2026-04-10T17:00:00Z",
    end_time: "2026-04-10T18:00:00Z",
    capacity: 12,
  };

  it("returns 401 when unauthenticated", async () => {
    supabaseMock = buildSupabaseMock({ authenticated: false });
    const res = await POST(
      makeRequest("http://localhost:3000/api/classes", {
        method: "POST",
        body: JSON.stringify(validBody),
      })
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when required fields are missing", async () => {
    supabaseMock = buildSupabaseMock({});
    const res = await POST(
      makeRequest("http://localhost:3000/api/classes", {
        method: "POST",
        body: JSON.stringify({ class_type_id: TEST_CLASS_TYPE_ID }),
      })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/required/i);
  });

  it("returns 400 when capacity is not a positive number", async () => {
    supabaseMock = buildSupabaseMock({});
    const res = await POST(
      makeRequest("http://localhost:3000/api/classes", {
        method: "POST",
        body: JSON.stringify({ ...validBody, capacity: -1 }),
      })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/capacity/i);
  });

  it("returns 400 when end_time is before start_time", async () => {
    supabaseMock = buildSupabaseMock({});
    const res = await POST(
      makeRequest("http://localhost:3000/api/classes", {
        method: "POST",
        body: JSON.stringify({
          ...validBody,
          start_time: "2026-04-10T18:00:00Z",
          end_time: "2026-04-10T17:00:00Z",
        }),
      })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/after/i);
  });

  it("returns 404 when class type does not exist", async () => {
    supabaseMock = buildSupabaseMock({ classTypeExists: false });
    const res = await POST(
      makeRequest("http://localhost:3000/api/classes", {
        method: "POST",
        body: JSON.stringify(validBody),
      })
    );
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/class type/i);
  });

  it("returns 201 with created class on success", async () => {
    const created = {
      id: TEST_CLASS_ID,
      class_type_id: TEST_CLASS_TYPE_ID,
      status: "scheduled",
      class_types: { id: TEST_CLASS_TYPE_ID, name: "Open Sauna", description: null, color: "#4F46E5" },
    };
    supabaseMock = buildSupabaseMock({ insertResult: { data: created, error: null } });
    const res = await POST(
      makeRequest("http://localhost:3000/api/classes", {
        method: "POST",
        body: JSON.stringify(validBody),
      })
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.id).toBe(TEST_CLASS_ID);
  });

  it("returns 500 when insert fails", async () => {
    supabaseMock = buildSupabaseMock({
      insertResult: { data: null, error: { message: "Insert failed" } },
    });
    const res = await POST(
      makeRequest("http://localhost:3000/api/classes", {
        method: "POST",
        body: JSON.stringify(validBody),
      })
    );
    expect(res.status).toBe(500);
  });
});
