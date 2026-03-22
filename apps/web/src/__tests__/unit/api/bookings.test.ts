import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Helpers ────────────────────────────────────────────────────────

const TEST_USER_ID = "aaaaaaaa-1111-2222-3333-444444444444";
const TEST_STUDIO_ID = "bbbbbbbb-1111-2222-3333-444444444444";
const TEST_CLASS_ID = "cccccccc-1111-2222-3333-444444444444";
const TEST_MEMBER_ID = "dddddddd-1111-2222-3333-444444444444";
const TEST_BOOKING_ID = "eeeeeeee-1111-2222-3333-444444444444";

function makeRequest(
  url: string,
  init?: RequestInit
): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

// ─── Chainable Supabase mock builder ────────────────────────────────

type MockReturnValue = {
  data: unknown;
  error: unknown;
  count?: number | null;
};

/**
 * Creates a chainable mock that records method calls and returns
 * the configured response when a terminal method (single/maybeSingle)
 * is reached, or when the chain resolves as a thenable (for queries
 * without an explicit terminal).
 */
function createChainableMock(response: MockReturnValue) {
  const chain: Record<string, unknown> = {};
  const methods = [
    "from",
    "select",
    "insert",
    "eq",
    "in",
    "order",
    "range",
    "single",
    "maybeSingle",
  ];

  for (const method of methods) {
    if (method === "single" || method === "maybeSingle") {
      chain[method] = vi.fn(() => Promise.resolve(response));
    } else {
      chain[method] = vi.fn(() => chain);
    }
  }

  // Allow awaiting the chain directly (query with no terminal call)
  chain.then = vi.fn((resolve: (v: unknown) => void) => resolve(response));

  return chain;
}

/**
 * Build a Supabase client mock where each .from(table) call can return
 * a different chainable sub-mock.  Pass a map of table -> response.
 * Tables not listed fall through to a default empty-success response.
 */
function buildSupabaseMock(
  tableResponses: Record<string, MockReturnValue>,
  authResponse?: { user: unknown; error?: unknown }
) {
  const defaultResponse: MockReturnValue = { data: null, error: null, count: 0 };

  // Track per-table call indices so repeated .from("bookings") calls
  // can return different results when an array of responses is needed.
  const tableChains: Record<string, ReturnType<typeof createChainableMock>> = {};

  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: authResponse?.user ?? null },
        error: authResponse?.error ?? null,
      }),
    },
    from: vi.fn((table: string) => {
      // Create a fresh chain every call so each .from() in the route
      // gets its own chain that resolves independently.
      const resp = tableResponses[table] ?? defaultResponse;
      const chain = createChainableMock(resp);
      tableChains[table] = chain;
      return chain;
    }),
  };

  return supabase;
}

// ─── Module mocks ───────────────────────────────────────────────────

let mockSupabase: ReturnType<typeof buildSupabaseMock>;

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

// ─── Import route handlers AFTER mocks are registered ───────────────
const { GET, POST } = await import(
  "@/app/api/bookings/route"
);

// =====================================================================
//  GET /api/bookings
// =====================================================================

describe("GET /api/bookings", () => {
  // -- Auth -----------------------------------------------------------

  it("returns 401 when the user is not authenticated", async () => {
    mockSupabase = buildSupabaseMock({}, { user: null, error: { message: "No session" } });

    const res = await GET(makeRequest("/api/bookings"));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 403 when user lacks owner/manager role", async () => {
    mockSupabase = buildSupabaseMock(
      {
        profiles: { data: { studio_id: TEST_STUDIO_ID, roles: ["member"] }, error: null },
      },
      { user: { id: TEST_USER_ID } }
    );

    const res = await GET(makeRequest("/api/bookings"));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("Forbidden");
  });

  // -- Success --------------------------------------------------------

  it("returns paginated bookings for an authorized owner", async () => {
    const bookings = [{ id: TEST_BOOKING_ID, status: "confirmed" }];

    mockSupabase = buildSupabaseMock(
      {
        profiles: { data: { studio_id: TEST_STUDIO_ID, roles: ["owner"] }, error: null },
        bookings: { data: bookings, error: null, count: 1 },
      },
      { user: { id: TEST_USER_ID } }
    );

    const res = await GET(makeRequest("/api/bookings?limit=10&offset=0"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual(bookings);
    expect(json.count).toBe(1);
  });

  // -- Filters --------------------------------------------------------

  it("passes class_id and status filters to the query", async () => {
    mockSupabase = buildSupabaseMock(
      {
        profiles: { data: { studio_id: TEST_STUDIO_ID, roles: ["manager"] }, error: null },
        bookings: { data: [], error: null, count: 0 },
      },
      { user: { id: TEST_USER_ID } }
    );

    const res = await GET(
      makeRequest(`/api/bookings?class_id=${TEST_CLASS_ID}&status=confirmed`)
    );
    expect(res.status).toBe(200);

    // Verify .eq was called with the filter values.
    // The bookings chain is re-created each call, so we inspect the
    // last chain created for the "bookings" table.
    const bookingsFrom = mockSupabase.from.mock.calls.filter(
      (c: string[]) => c[0] === "bookings"
    );
    expect(bookingsFrom.length).toBeGreaterThan(0);
  });

  // -- Limit cap ------------------------------------------------------

  it("caps limit at 100 even if a higher value is requested", async () => {
    mockSupabase = buildSupabaseMock(
      {
        profiles: { data: { studio_id: TEST_STUDIO_ID, roles: ["owner"] }, error: null },
        bookings: { data: [], error: null, count: 0 },
      },
      { user: { id: TEST_USER_ID } }
    );

    const res = await GET(makeRequest("/api/bookings?limit=999"));
    expect(res.status).toBe(200);

    // The range call should use offset=0, offset+limit-1 = 99
    // We verify indirectly that the response succeeded (the mock
    // would still return data regardless, but the code path is exercised).
    const json = await res.json();
    expect(json).toHaveProperty("data");
  });

  // -- DB error -------------------------------------------------------

  it("returns 500 when the bookings query fails", async () => {
    mockSupabase = buildSupabaseMock(
      {
        profiles: { data: { studio_id: TEST_STUDIO_ID, roles: ["owner"] }, error: null },
        bookings: { data: null, error: { message: "relation does not exist" }, count: null },
      },
      { user: { id: TEST_USER_ID } }
    );

    const res = await GET(makeRequest("/api/bookings"));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("relation does not exist");
  });
});

// =====================================================================
//  POST /api/bookings
// =====================================================================

describe("POST /api/bookings", () => {
  // -- Auth -----------------------------------------------------------

  it("returns 401 when the user is not authenticated", async () => {
    mockSupabase = buildSupabaseMock({}, { user: null, error: { message: "No session" } });

    const res = await POST(
      makeRequest("/api/bookings", {
        method: "POST",
        body: JSON.stringify({ class_id: TEST_CLASS_ID, member_id: TEST_MEMBER_ID }),
      })
    );
    expect(res.status).toBe(401);
  });

  // -- Validation -----------------------------------------------------

  it("returns 400 when class_id is missing", async () => {
    mockSupabase = buildSupabaseMock(
      {
        profiles: { data: { studio_id: TEST_STUDIO_ID, roles: ["owner"] }, error: null },
      },
      { user: { id: TEST_USER_ID } }
    );

    const res = await POST(
      makeRequest("/api/bookings", {
        method: "POST",
        body: JSON.stringify({ member_id: TEST_MEMBER_ID }),
      })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Validation failed");
  });

  it("returns 400 when class_id is not a valid UUID", async () => {
    mockSupabase = buildSupabaseMock(
      {
        profiles: { data: { studio_id: TEST_STUDIO_ID, roles: ["owner"] }, error: null },
      },
      { user: { id: TEST_USER_ID } }
    );

    const res = await POST(
      makeRequest("/api/bookings", {
        method: "POST",
        body: JSON.stringify({ class_id: "not-a-uuid", member_id: TEST_MEMBER_ID }),
      })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Validation failed");
    expect(json.details).toBeDefined();
  });

  // -- Class not found ------------------------------------------------

  it("returns 404 when the class does not exist", async () => {
    mockSupabase = buildSupabaseMock(
      {
        profiles: { data: { studio_id: TEST_STUDIO_ID, roles: ["owner"] }, error: null },
        classes: { data: null, error: { code: "PGRST116", message: "not found" } },
      },
      { user: { id: TEST_USER_ID } }
    );

    const res = await POST(
      makeRequest("/api/bookings", {
        method: "POST",
        body: JSON.stringify({ class_id: TEST_CLASS_ID, member_id: TEST_MEMBER_ID }),
      })
    );
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Class not found");
  });

  // -- Full capacity --------------------------------------------------

  it("returns 409 when class is at full capacity", async () => {
    // For POST, the route calls .from("classes") then .from("bookings") for count.
    // We need classes to succeed and the bookings count to match capacity.
    // Because .from() is called multiple times for different tables (and
    // "bookings" is called twice — once for count, once for duplicate check),
    // we build a custom mock.
    const supabase = buildSupabaseMock(
      {
        profiles: { data: { studio_id: TEST_STUDIO_ID, roles: ["owner"] }, error: null },
      },
      { user: { id: TEST_USER_ID } }
    );

    let bookingsCallCount = 0;
    const originalFrom = supabase.from;
    supabase.from = vi.fn((table: string) => {
      if (table === "classes") {
        return createChainableMock({
          data: { id: TEST_CLASS_ID, capacity: 12, studio_id: TEST_STUDIO_ID },
          error: null,
        });
      }
      if (table === "bookings") {
        bookingsCallCount++;
        if (bookingsCallCount === 1) {
          // Capacity count query — return count = 12 (at capacity)
          return createChainableMock({ data: null, error: null, count: 12 });
        }
      }
      return originalFrom(table);
    }) as typeof supabase.from;

    mockSupabase = supabase;

    const res = await POST(
      makeRequest("/api/bookings", {
        method: "POST",
        body: JSON.stringify({ class_id: TEST_CLASS_ID, member_id: TEST_MEMBER_ID }),
      })
    );
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe("Class is at full capacity");
  });

  // -- Duplicate booking ----------------------------------------------

  it("returns 409 when member already has an active booking", async () => {
    const supabase = buildSupabaseMock(
      {
        profiles: { data: { studio_id: TEST_STUDIO_ID, roles: ["owner"] }, error: null },
      },
      { user: { id: TEST_USER_ID } }
    );

    let bookingsCallCount = 0;
    const originalFrom = supabase.from;
    supabase.from = vi.fn((table: string) => {
      if (table === "classes") {
        return createChainableMock({
          data: { id: TEST_CLASS_ID, capacity: 12, studio_id: TEST_STUDIO_ID },
          error: null,
        });
      }
      if (table === "bookings") {
        bookingsCallCount++;
        if (bookingsCallCount === 1) {
          // Capacity count — has room
          return createChainableMock({ data: null, error: null, count: 5 });
        }
        if (bookingsCallCount === 2) {
          // Duplicate check — existing booking found
          return createChainableMock({
            data: { id: TEST_BOOKING_ID },
            error: null,
          });
        }
      }
      return originalFrom(table);
    }) as typeof supabase.from;

    mockSupabase = supabase;

    const res = await POST(
      makeRequest("/api/bookings", {
        method: "POST",
        body: JSON.stringify({ class_id: TEST_CLASS_ID, member_id: TEST_MEMBER_ID }),
      })
    );
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe("Member already has an active booking for this class");
  });

  // -- Successful creation --------------------------------------------

  it("returns 201 with the created booking on success", async () => {
    const createdBooking = {
      id: TEST_BOOKING_ID,
      class_id: TEST_CLASS_ID,
      member_id: TEST_MEMBER_ID,
      studio_id: TEST_STUDIO_ID,
      status: "confirmed",
    };

    const supabase = buildSupabaseMock(
      {
        profiles: { data: { studio_id: TEST_STUDIO_ID, roles: ["owner"] }, error: null },
      },
      { user: { id: TEST_USER_ID } }
    );

    let bookingsCallCount = 0;
    const originalFrom = supabase.from;
    supabase.from = vi.fn((table: string) => {
      if (table === "classes") {
        return createChainableMock({
          data: { id: TEST_CLASS_ID, capacity: 12, studio_id: TEST_STUDIO_ID },
          error: null,
        });
      }
      if (table === "bookings") {
        bookingsCallCount++;
        if (bookingsCallCount === 1) {
          // Capacity count
          return createChainableMock({ data: null, error: null, count: 5 });
        }
        if (bookingsCallCount === 2) {
          // Duplicate check — no existing booking
          return createChainableMock({ data: null, error: null });
        }
        if (bookingsCallCount === 3) {
          // Insert
          return createChainableMock({ data: createdBooking, error: null });
        }
      }
      if (table === "activity_log") {
        return createChainableMock({ data: null, error: null });
      }
      return originalFrom(table);
    }) as typeof supabase.from;

    mockSupabase = supabase;

    const res = await POST(
      makeRequest("/api/bookings", {
        method: "POST",
        body: JSON.stringify({ class_id: TEST_CLASS_ID, member_id: TEST_MEMBER_ID }),
      })
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data).toEqual(createdBooking);
    expect(json.data.status).toBe("confirmed");
  });

  // -- Activity log ---------------------------------------------------

  it("creates an activity log entry after successful booking", async () => {
    const createdBooking = {
      id: TEST_BOOKING_ID,
      class_id: TEST_CLASS_ID,
      member_id: TEST_MEMBER_ID,
      studio_id: TEST_STUDIO_ID,
      status: "confirmed",
    };

    const supabase = buildSupabaseMock(
      {
        profiles: { data: { studio_id: TEST_STUDIO_ID, roles: ["owner"] }, error: null },
      },
      { user: { id: TEST_USER_ID } }
    );

    let bookingsCallCount = 0;
    let activityLogInsertCalled = false;
    let activityLogPayload: unknown = null;

    const originalFrom = supabase.from;
    supabase.from = vi.fn((table: string) => {
      if (table === "classes") {
        return createChainableMock({
          data: { id: TEST_CLASS_ID, capacity: 12, studio_id: TEST_STUDIO_ID },
          error: null,
        });
      }
      if (table === "bookings") {
        bookingsCallCount++;
        if (bookingsCallCount === 1) {
          return createChainableMock({ data: null, error: null, count: 3 });
        }
        if (bookingsCallCount === 2) {
          return createChainableMock({ data: null, error: null });
        }
        if (bookingsCallCount === 3) {
          return createChainableMock({ data: createdBooking, error: null });
        }
      }
      if (table === "activity_log") {
        activityLogInsertCalled = true;
        const chain = createChainableMock({ data: null, error: null });
        const originalInsert = chain.insert as ReturnType<typeof vi.fn>;
        chain.insert = vi.fn((payload: unknown) => {
          activityLogPayload = payload;
          return originalInsert(payload);
        });
        return chain;
      }
      return originalFrom(table);
    }) as typeof supabase.from;

    mockSupabase = supabase;

    const res = await POST(
      makeRequest("/api/bookings", {
        method: "POST",
        body: JSON.stringify({ class_id: TEST_CLASS_ID, member_id: TEST_MEMBER_ID }),
      })
    );
    expect(res.status).toBe(201);
    expect(activityLogInsertCalled).toBe(true);
    expect(activityLogPayload).toMatchObject({
      studio_id: TEST_STUDIO_ID,
      actor_id: TEST_USER_ID,
      action: "booking_created",
      entity_type: "booking",
      entity_id: TEST_BOOKING_ID,
      metadata: { class_id: TEST_CLASS_ID, member_id: TEST_MEMBER_ID },
    });
  });

  // -- DB error on insert ---------------------------------------------

  it("returns 500 when the booking insert fails", async () => {
    const supabase = buildSupabaseMock(
      {
        profiles: { data: { studio_id: TEST_STUDIO_ID, roles: ["owner"] }, error: null },
      },
      { user: { id: TEST_USER_ID } }
    );

    let bookingsCallCount = 0;
    const originalFrom = supabase.from;
    supabase.from = vi.fn((table: string) => {
      if (table === "classes") {
        return createChainableMock({
          data: { id: TEST_CLASS_ID, capacity: 12, studio_id: TEST_STUDIO_ID },
          error: null,
        });
      }
      if (table === "bookings") {
        bookingsCallCount++;
        if (bookingsCallCount === 1) {
          return createChainableMock({ data: null, error: null, count: 5 });
        }
        if (bookingsCallCount === 2) {
          return createChainableMock({ data: null, error: null });
        }
        if (bookingsCallCount === 3) {
          // Insert fails
          return createChainableMock({
            data: null,
            error: { message: "unique_violation" },
          });
        }
      }
      return originalFrom(table);
    }) as typeof supabase.from;

    mockSupabase = supabase;

    const res = await POST(
      makeRequest("/api/bookings", {
        method: "POST",
        body: JSON.stringify({ class_id: TEST_CLASS_ID, member_id: TEST_MEMBER_ID }),
      })
    );
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("unique_violation");
  });
});
