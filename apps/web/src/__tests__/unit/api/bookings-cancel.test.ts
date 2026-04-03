import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Constants ─────────────────────────────────────────────────────
const TEST_USER_ID = "aaaaaaaa-1111-2222-3333-444444444444";
const TEST_STUDIO_ID = "bbbbbbbb-1111-2222-3333-444444444444";
const TEST_BOOKING_ID = "eeeeeeee-1111-2222-3333-444444444444";
const TEST_MEMBER_ID = "dddddddd-1111-2222-3333-444444444444";
const TEST_CLASS_ID = "cccccccc-1111-2222-3333-444444444444";

function makeRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

// ─── Chainable mock ────────────────────────────────────────────────
import { createChainableMock, type MockReturnValue } from "@/__tests__/helpers/mock-chainable";

function buildSupabaseMock(
  tableResponses: Record<string, MockReturnValue>,
  authResponse?: { user: unknown; error?: unknown }
) {
  const defaultResponse: MockReturnValue = { data: null, error: null, count: 0 };
  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: authResponse?.user ?? null },
        error: authResponse?.error ?? null,
      }),
    },
    from: vi.fn((table: string) => {
      const resp = tableResponses[table] ?? defaultResponse;
      return createChainableMock(resp);
    }),
  };
  return supabase;
}

// ─── Module mocks ──────────────────────────────────────────────────
let mockSupabase: ReturnType<typeof buildSupabaseMock>;

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

const mockInngestSend = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/inngest/client", () => ({
  inngest: { send: mockInngestSend },
}));

// Import route handler AFTER mocks are registered
const { POST } = await import("@/app/api/bookings/[id]/cancel/route");

// Helper to create params
function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

// Helper for a future class start time (in N hours)
function futureClassTime(hoursFromNow: number) {
  const d = new Date();
  d.setTime(d.getTime() + hoursFromNow * 60 * 60 * 1000);
  return d.toISOString();
}

// ─── Tests ─────────────────────────────────────────────────────────
describe("POST /api/bookings/[id]/cancel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -- Auth -----------------------------------------------------------

  it("returns 401 when unauthenticated", async () => {
    mockSupabase = buildSupabaseMock({}, { user: null, error: { message: "No session" } });
    const res = await POST(
      makeRequest("/api/bookings/x/cancel", { method: "POST", body: "{}" }),
      makeParams(TEST_BOOKING_ID)
    );
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 403 when user lacks owner/manager role", async () => {
    mockSupabase = buildSupabaseMock(
      { profiles: { data: { studio_id: TEST_STUDIO_ID, roles: ["member"] }, error: null } },
      { user: { id: TEST_USER_ID } }
    );
    const res = await POST(
      makeRequest("/api/bookings/x/cancel", { method: "POST", body: "{}" }),
      makeParams(TEST_BOOKING_ID)
    );
    expect(res.status).toBe(403);
  });

  // -- Booking states -------------------------------------------------

  it("returns 404 when booking not found", async () => {
    mockSupabase = buildSupabaseMock(
      {
        profiles: { data: { studio_id: TEST_STUDIO_ID, roles: ["owner"] }, error: null },
        bookings: { data: null, error: { code: "PGRST116", message: "not found" } },
      },
      { user: { id: TEST_USER_ID } }
    );
    const res = await POST(
      makeRequest("/api/bookings/x/cancel", { method: "POST", body: "{}" }),
      makeParams(TEST_BOOKING_ID)
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 when booking is already cancelled", async () => {
    const supabase = buildSupabaseMock(
      { profiles: { data: { studio_id: TEST_STUDIO_ID, roles: ["owner"] }, error: null } },
      { user: { id: TEST_USER_ID } }
    );
    const originalFrom = supabase.from;
    supabase.from = vi.fn((table: string) => {
      if (table === "bookings") {
        return createChainableMock({
          data: { id: TEST_BOOKING_ID, status: "cancelled", member_id: TEST_MEMBER_ID, class_id: TEST_CLASS_ID, classes: { start_time: futureClassTime(24) } },
          error: null,
        });
      }
      return originalFrom(table);
    }) as typeof supabase.from;
    mockSupabase = supabase;

    const res = await POST(
      makeRequest("/api/bookings/x/cancel", { method: "POST", body: "{}" }),
      makeParams(TEST_BOOKING_ID)
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Booking is already cancelled");
  });

  it("returns 400 when booking is checked_in", async () => {
    const supabase = buildSupabaseMock(
      { profiles: { data: { studio_id: TEST_STUDIO_ID, roles: ["owner"] }, error: null } },
      { user: { id: TEST_USER_ID } }
    );
    const originalFrom = supabase.from;
    supabase.from = vi.fn((table: string) => {
      if (table === "bookings") {
        return createChainableMock({
          data: { id: TEST_BOOKING_ID, status: "checked_in", member_id: TEST_MEMBER_ID, class_id: TEST_CLASS_ID, classes: { start_time: futureClassTime(24) } },
          error: null,
        });
      }
      return originalFrom(table);
    }) as typeof supabase.from;
    mockSupabase = supabase;

    const res = await POST(
      makeRequest("/api/bookings/x/cancel", { method: "POST", body: "{}" }),
      makeParams(TEST_BOOKING_ID)
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Cannot cancel a booking after check-in");
  });

  // -- Successful cancellation (not late) -----------------------------

  it("cancels a future booking with is_late_cancel=false", async () => {
    const updatedBooking = { id: TEST_BOOKING_ID, status: "cancelled", is_late_cancel: false };
    const supabase = buildSupabaseMock(
      { profiles: { data: { studio_id: TEST_STUDIO_ID, roles: ["owner"] }, error: null } },
      { user: { id: TEST_USER_ID } }
    );

    let bookingsCallCount = 0;
    const originalFrom = supabase.from;
    supabase.from = vi.fn((table: string) => {
      if (table === "bookings") {
        bookingsCallCount++;
        if (bookingsCallCount === 1) {
          // Fetch booking — class starts in 24 hours (not late)
          return createChainableMock({
            data: {
              id: TEST_BOOKING_ID, status: "booked", member_id: TEST_MEMBER_ID,
              class_id: TEST_CLASS_ID, glofox_id: null,
              classes: { start_time: futureClassTime(24) },
            },
            error: null,
          });
        }
        if (bookingsCallCount === 2) {
          // Update booking
          return createChainableMock({ data: updatedBooking, error: null });
        }
      }
      if (table === "studio_settings") {
        return createChainableMock({
          data: { late_cancel_window_hours: 4, strike_system_enabled: true },
          error: null,
        });
      }
      if (table === "activity_log") {
        return createChainableMock({ data: null, error: null });
      }
      return originalFrom(table);
    }) as typeof supabase.from;
    mockSupabase = supabase;

    const res = await POST(
      makeRequest("/api/bookings/x/cancel", { method: "POST", body: "{}" }),
      makeParams(TEST_BOOKING_ID)
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.late_cancellation).toBe(false);
    expect(json.strike_applied).toBe(false);
    expect(json.penalty_amount).toBe(0);
  });

  // -- Late cancellation with strikes ---------------------------------

  it("applies a warning on first late cancellation (no penalty)", async () => {
    const updatedBooking = { id: TEST_BOOKING_ID, status: "cancelled", is_late_cancel: true };
    const supabase = buildSupabaseMock(
      { profiles: { data: { studio_id: TEST_STUDIO_ID, roles: ["owner"] }, error: null } },
      { user: { id: TEST_USER_ID } }
    );

    let bookingsCallCount = 0;
    const originalFrom = supabase.from;
    supabase.from = vi.fn((table: string) => {
      if (table === "bookings") {
        bookingsCallCount++;
        if (bookingsCallCount === 1) {
          return createChainableMock({
            data: {
              id: TEST_BOOKING_ID, status: "booked", member_id: TEST_MEMBER_ID,
              class_id: TEST_CLASS_ID, glofox_id: null,
              classes: { start_time: futureClassTime(1) }, // 1 hour out = within 4hr window
            },
            error: null,
          });
        }
        if (bookingsCallCount === 2) return createChainableMock({ data: updatedBooking, error: null });
      }
      if (table === "studio_settings") {
        return createChainableMock({
          data: { late_cancel_window_hours: 4, strike_system_enabled: true },
          error: null,
        });
      }
      if (table === "member_strikes") {
        // First call: count existing strikes (0)
        // Second call: insert new strike
        return createChainableMock({ data: null, error: null, count: 0 });
      }
      if (table === "activity_log") return createChainableMock({ data: null, error: null });
      return originalFrom(table);
    }) as typeof supabase.from;
    mockSupabase = supabase;

    const res = await POST(
      makeRequest("/api/bookings/x/cancel", { method: "POST", body: "{}" }),
      makeParams(TEST_BOOKING_ID)
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.late_cancellation).toBe(true);
    expect(json.strike_applied).toBe(true);
    expect(json.strike_count).toBe(1);
    expect(json.penalty_amount).toBe(0); // First strike = warning only
  });

  it("applies $5 penalty on second strike", async () => {
    const supabase = buildSupabaseMock(
      { profiles: { data: { studio_id: TEST_STUDIO_ID, roles: ["owner"] }, error: null } },
      { user: { id: TEST_USER_ID } }
    );

    let bookingsCallCount = 0;
    const originalFrom = supabase.from;
    supabase.from = vi.fn((table: string) => {
      if (table === "bookings") {
        bookingsCallCount++;
        if (bookingsCallCount === 1) {
          return createChainableMock({
            data: {
              id: TEST_BOOKING_ID, status: "booked", member_id: TEST_MEMBER_ID,
              class_id: TEST_CLASS_ID, glofox_id: null,
              classes: { start_time: futureClassTime(1) },
            },
            error: null,
          });
        }
        if (bookingsCallCount === 2) return createChainableMock({ data: { id: TEST_BOOKING_ID, status: "cancelled" }, error: null });
      }
      if (table === "studio_settings") {
        return createChainableMock({ data: { late_cancel_window_hours: 4, strike_system_enabled: true }, error: null });
      }
      if (table === "member_strikes") {
        // 1 existing strike → this becomes strike #2
        return createChainableMock({ data: null, error: null, count: 1 });
      }
      if (table === "activity_log") return createChainableMock({ data: null, error: null });
      return originalFrom(table);
    }) as typeof supabase.from;
    mockSupabase = supabase;

    const res = await POST(
      makeRequest("/api/bookings/x/cancel", { method: "POST", body: "{}" }),
      makeParams(TEST_BOOKING_ID)
    );
    const json = await res.json();
    expect(json.strike_count).toBe(2);
    expect(json.penalty_amount).toBe(5);
  });

  it("applies $10 penalty on third+ strike", async () => {
    const supabase = buildSupabaseMock(
      { profiles: { data: { studio_id: TEST_STUDIO_ID, roles: ["owner"] }, error: null } },
      { user: { id: TEST_USER_ID } }
    );

    let bookingsCallCount = 0;
    const originalFrom = supabase.from;
    supabase.from = vi.fn((table: string) => {
      if (table === "bookings") {
        bookingsCallCount++;
        if (bookingsCallCount === 1) {
          return createChainableMock({
            data: {
              id: TEST_BOOKING_ID, status: "booked", member_id: TEST_MEMBER_ID,
              class_id: TEST_CLASS_ID, glofox_id: null,
              classes: { start_time: futureClassTime(1) },
            },
            error: null,
          });
        }
        if (bookingsCallCount === 2) return createChainableMock({ data: { id: TEST_BOOKING_ID, status: "cancelled" }, error: null });
      }
      if (table === "studio_settings") {
        return createChainableMock({ data: { late_cancel_window_hours: 4, strike_system_enabled: true }, error: null });
      }
      if (table === "member_strikes") {
        // 2 existing strikes → this becomes strike #3
        return createChainableMock({ data: null, error: null, count: 2 });
      }
      if (table === "activity_log") return createChainableMock({ data: null, error: null });
      return originalFrom(table);
    }) as typeof supabase.from;
    mockSupabase = supabase;

    const res = await POST(
      makeRequest("/api/bookings/x/cancel", { method: "POST", body: "{}" }),
      makeParams(TEST_BOOKING_ID)
    );
    const json = await res.json();
    expect(json.strike_count).toBe(3);
    expect(json.penalty_amount).toBe(10);
  });

  // -- Glofox write-back ──────────────────────────────────────────────

  it("does NOT fire inngest when booking has no glofox_id", async () => {
    const supabase = buildSupabaseMock(
      { profiles: { data: { studio_id: TEST_STUDIO_ID, roles: ["owner"] }, error: null } },
      { user: { id: TEST_USER_ID } }
    );

    let bookingsCallCount = 0;
    const originalFrom = supabase.from;
    supabase.from = vi.fn((table: string) => {
      if (table === "bookings") {
        bookingsCallCount++;
        if (bookingsCallCount === 1) {
          return createChainableMock({
            data: {
              id: TEST_BOOKING_ID, status: "booked", member_id: TEST_MEMBER_ID,
              class_id: TEST_CLASS_ID, glofox_id: null,
              classes: { start_time: futureClassTime(24) },
            },
            error: null,
          });
        }
        if (bookingsCallCount === 2) return createChainableMock({ data: { id: TEST_BOOKING_ID, status: "cancelled" }, error: null });
      }
      if (table === "studio_settings") return createChainableMock({ data: { late_cancel_window_hours: 4, strike_system_enabled: true }, error: null });
      if (table === "activity_log") return createChainableMock({ data: null, error: null });
      return originalFrom(table);
    }) as typeof supabase.from;
    mockSupabase = supabase;

    await POST(
      makeRequest("/api/bookings/x/cancel", { method: "POST", body: "{}" }),
      makeParams(TEST_BOOKING_ID)
    );
    expect(mockInngestSend).not.toHaveBeenCalled();
  });

  it("fires inngest glofox/cancel-booking when booking has glofox_id", async () => {
    const supabase = buildSupabaseMock(
      { profiles: { data: { studio_id: TEST_STUDIO_ID, roles: ["owner"] }, error: null } },
      { user: { id: TEST_USER_ID } }
    );

    let bookingsCallCount = 0;
    const originalFrom = supabase.from;
    supabase.from = vi.fn((table: string) => {
      if (table === "bookings") {
        bookingsCallCount++;
        if (bookingsCallCount === 1) {
          return createChainableMock({
            data: {
              id: TEST_BOOKING_ID, status: "booked", member_id: TEST_MEMBER_ID,
              class_id: TEST_CLASS_ID, glofox_id: "glofox-123",
              classes: { start_time: futureClassTime(24) },
            },
            error: null,
          });
        }
        if (bookingsCallCount === 2) return createChainableMock({ data: { id: TEST_BOOKING_ID, status: "cancelled" }, error: null });
      }
      if (table === "studio_settings") return createChainableMock({ data: { late_cancel_window_hours: 4, strike_system_enabled: true }, error: null });
      if (table === "activity_log") return createChainableMock({ data: null, error: null });
      return originalFrom(table);
    }) as typeof supabase.from;
    mockSupabase = supabase;

    await POST(
      makeRequest("/api/bookings/x/cancel", { method: "POST", body: "{}" }),
      makeParams(TEST_BOOKING_ID)
    );
    expect(mockInngestSend).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "glofox/cancel-booking",
        data: expect.objectContaining({
          booking_id: TEST_BOOKING_ID,
          glofox_booking_id: "glofox-123",
          studio_id: TEST_STUDIO_ID,
        }),
      })
    );
  });

  // -- DB error ──────────────────────────────────────────────────────

  it("returns 500 when booking update fails", async () => {
    const supabase = buildSupabaseMock(
      { profiles: { data: { studio_id: TEST_STUDIO_ID, roles: ["owner"] }, error: null } },
      { user: { id: TEST_USER_ID } }
    );

    let bookingsCallCount = 0;
    const originalFrom = supabase.from;
    supabase.from = vi.fn((table: string) => {
      if (table === "bookings") {
        bookingsCallCount++;
        if (bookingsCallCount === 1) {
          return createChainableMock({
            data: {
              id: TEST_BOOKING_ID, status: "booked", member_id: TEST_MEMBER_ID,
              class_id: TEST_CLASS_ID, glofox_id: null,
              classes: { start_time: futureClassTime(24) },
            },
            error: null,
          });
        }
        if (bookingsCallCount === 2) {
          return createChainableMock({ data: null, error: { message: "update failed" } });
        }
      }
      if (table === "studio_settings") return createChainableMock({ data: { late_cancel_window_hours: 4, strike_system_enabled: true }, error: null });
      return originalFrom(table);
    }) as typeof supabase.from;
    mockSupabase = supabase;

    const res = await POST(
      makeRequest("/api/bookings/x/cancel", { method: "POST", body: "{}" }),
      makeParams(TEST_BOOKING_ID)
    );
    expect(res.status).toBe(500);
  });
});
