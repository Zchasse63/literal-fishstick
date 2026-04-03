import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Constants ─────────────────────────────────────────────────────
const TEST_USER_ID = "aaaaaaaa-1111-2222-3333-444444444444";
const TEST_STUDIO_ID = "bbbbbbbb-1111-2222-3333-444444444444";
const TEST_BOOKING_ID = "eeeeeeee-1111-2222-3333-444444444444";
const TEST_MEMBER_ID = "dddddddd-1111-2222-3333-444444444444";
const TEST_CLASS_ID = "cccccccc-1111-2222-3333-444444444444";
const TEST_TRAINER_ID = "ffffffff-1111-2222-3333-444444444444";

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
  return {
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

const { POST } = await import("@/app/api/check-in/route");

// ─── Tests ─────────────────────────────────────────────────────────
describe("POST /api/check-in", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -- Auth -----------------------------------------------------------

  it("returns 401 when unauthenticated", async () => {
    mockSupabase = buildSupabaseMock({}, { user: null, error: { message: "No session" } });
    const res = await POST(
      makeRequest("/api/check-in", {
        method: "POST",
        body: JSON.stringify({ booking_id: TEST_BOOKING_ID }),
      })
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when user lacks owner/manager role", async () => {
    mockSupabase = buildSupabaseMock(
      { profiles: { data: { studio_id: TEST_STUDIO_ID, roles: ["member"] }, error: null } },
      { user: { id: TEST_USER_ID } }
    );
    const res = await POST(
      makeRequest("/api/check-in", {
        method: "POST",
        body: JSON.stringify({ booking_id: TEST_BOOKING_ID }),
      })
    );
    expect(res.status).toBe(403);
  });

  // -- Validation -----------------------------------------------------

  it("returns 400 when booking_id is missing", async () => {
    mockSupabase = buildSupabaseMock(
      { profiles: { data: { studio_id: TEST_STUDIO_ID, roles: ["owner"] }, error: null } },
      { user: { id: TEST_USER_ID } }
    );
    const res = await POST(
      makeRequest("/api/check-in", {
        method: "POST",
        body: JSON.stringify({}),
      })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("booking_id is required");
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
      makeRequest("/api/check-in", {
        method: "POST",
        body: JSON.stringify({ booking_id: TEST_BOOKING_ID }),
      })
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 when already checked in", async () => {
    const supabase = buildSupabaseMock(
      { profiles: { data: { studio_id: TEST_STUDIO_ID, roles: ["owner"] }, error: null } },
      { user: { id: TEST_USER_ID } }
    );
    const originalFrom = supabase.from;
    supabase.from = vi.fn((table: string) => {
      if (table === "bookings") {
        return createChainableMock({
          data: { id: TEST_BOOKING_ID, status: "checked_in", member_id: TEST_MEMBER_ID, class_id: TEST_CLASS_ID },
          error: null,
        });
      }
      return originalFrom(table);
    }) as typeof supabase.from;
    mockSupabase = supabase;

    const res = await POST(
      makeRequest("/api/check-in", {
        method: "POST",
        body: JSON.stringify({ booking_id: TEST_BOOKING_ID }),
      })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Member is already checked in");
  });

  it("returns 400 when booking is cancelled", async () => {
    const supabase = buildSupabaseMock(
      { profiles: { data: { studio_id: TEST_STUDIO_ID, roles: ["owner"] }, error: null } },
      { user: { id: TEST_USER_ID } }
    );
    const originalFrom = supabase.from;
    supabase.from = vi.fn((table: string) => {
      if (table === "bookings") {
        return createChainableMock({
          data: { id: TEST_BOOKING_ID, status: "cancelled", member_id: TEST_MEMBER_ID, class_id: TEST_CLASS_ID },
          error: null,
        });
      }
      return originalFrom(table);
    }) as typeof supabase.from;
    mockSupabase = supabase;

    const res = await POST(
      makeRequest("/api/check-in", {
        method: "POST",
        body: JSON.stringify({ booking_id: TEST_BOOKING_ID }),
      })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Cannot check in a cancelled booking");
  });

  // -- Successful check-in (no trainer) ──────────────────────────────

  it("returns 200 with checked_in status on success", async () => {
    const updatedBooking = { id: TEST_BOOKING_ID, status: "checked_in", attended: true };
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
              classes: { id: TEST_CLASS_ID, trainer_id: null, start_time: new Date().toISOString(), end_time: new Date().toISOString() },
              members: { glofox_id: null },
            },
            error: null,
          });
        }
        if (bookingsCallCount === 2) return createChainableMock({ data: updatedBooking, error: null });
      }
      if (table === "activity_log") return createChainableMock({ data: null, error: null });
      return originalFrom(table);
    }) as typeof supabase.from;
    mockSupabase = supabase;

    const res = await POST(
      makeRequest("/api/check-in", {
        method: "POST",
        body: JSON.stringify({ booking_id: TEST_BOOKING_ID }),
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.status).toBe("checked_in");
    expect(json.bonus_triggered).toBe(false);
  });

  // -- Trainer bonus logic ────────────────────────────────────────────

  it("triggers trainer bonus when check-in count meets threshold", async () => {
    const supabase = buildSupabaseMock(
      { profiles: { data: { studio_id: TEST_STUDIO_ID, roles: ["owner"] }, error: null } },
      { user: { id: TEST_USER_ID } }
    );

    let bookingsCallCount = 0;
    let bonusInserted = false;
    const originalFrom = supabase.from;
    supabase.from = vi.fn((table: string) => {
      if (table === "bookings") {
        bookingsCallCount++;
        if (bookingsCallCount === 1) {
          // Fetch booking with trainer
          return createChainableMock({
            data: {
              id: TEST_BOOKING_ID, status: "booked", member_id: TEST_MEMBER_ID,
              class_id: TEST_CLASS_ID, glofox_id: null,
              classes: { id: TEST_CLASS_ID, trainer_id: TEST_TRAINER_ID, start_time: new Date().toISOString(), end_time: new Date().toISOString() },
              members: { glofox_id: null },
            },
            error: null,
          });
        }
        if (bookingsCallCount === 2) {
          // Update booking
          return createChainableMock({ data: { id: TEST_BOOKING_ID, status: "checked_in" }, error: null });
        }
        if (bookingsCallCount === 3) {
          // Count check-ins for trainer bonus — 7 = at threshold
          return createChainableMock({ data: null, error: null, count: 7 });
        }
      }
      if (table === "activity_log") return createChainableMock({ data: null, error: null });
      if (table === "studio_settings") {
        return createChainableMock({ data: { trainer_bonus_threshold: 7 }, error: null });
      }
      if (table === "trainer_bonuses") {
        if (!bonusInserted) {
          // maybeSingle check — no existing bonus
          bonusInserted = true;
          return createChainableMock({ data: null, error: null });
        }
        // Insert
        return createChainableMock({ data: null, error: null });
      }
      return originalFrom(table);
    }) as typeof supabase.from;
    mockSupabase = supabase;

    const res = await POST(
      makeRequest("/api/check-in", {
        method: "POST",
        body: JSON.stringify({ booking_id: TEST_BOOKING_ID }),
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.bonus_triggered).toBe(true);
    expect(json.check_in_count).toBe(7);
  });

  it("does not duplicate bonus when one already exists", async () => {
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
              classes: { id: TEST_CLASS_ID, trainer_id: TEST_TRAINER_ID, start_time: new Date().toISOString(), end_time: new Date().toISOString() },
              members: { glofox_id: null },
            },
            error: null,
          });
        }
        if (bookingsCallCount === 2) return createChainableMock({ data: { id: TEST_BOOKING_ID, status: "checked_in" }, error: null });
        if (bookingsCallCount === 3) return createChainableMock({ data: null, error: null, count: 8 });
      }
      if (table === "activity_log") return createChainableMock({ data: null, error: null });
      if (table === "studio_settings") return createChainableMock({ data: { trainer_bonus_threshold: 7 }, error: null });
      if (table === "trainer_bonuses") {
        // Existing bonus found — should NOT insert another
        return createChainableMock({ data: { id: "existing-bonus" }, error: null });
      }
      return originalFrom(table);
    }) as typeof supabase.from;
    mockSupabase = supabase;

    const res = await POST(
      makeRequest("/api/check-in", {
        method: "POST",
        body: JSON.stringify({ booking_id: TEST_BOOKING_ID }),
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.bonus_triggered).toBe(true);
    // Verify trainer_bonuses.insert was NOT called (only select was)
    const bonusCalls = mockSupabase.from.mock.calls.filter(
      (c: string[]) => c[0] === "trainer_bonuses"
    );
    // Should only have been called once (for the existence check), not for insert
    expect(bonusCalls.length).toBe(1);
  });

  // -- Glofox write-back ─────────────────────────────────────────────

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
              classes: { id: TEST_CLASS_ID, trainer_id: null },
              members: { glofox_id: null },
            },
            error: null,
          });
        }
        if (bookingsCallCount === 2) return createChainableMock({ data: { id: TEST_BOOKING_ID, status: "checked_in" }, error: null });
      }
      if (table === "activity_log") return createChainableMock({ data: null, error: null });
      return originalFrom(table);
    }) as typeof supabase.from;
    mockSupabase = supabase;

    await POST(
      makeRequest("/api/check-in", {
        method: "POST",
        body: JSON.stringify({ booking_id: TEST_BOOKING_ID }),
      })
    );
    expect(mockInngestSend).not.toHaveBeenCalled();
  });

  it("fires inngest glofox/mark-attendance when both glofox IDs present", async () => {
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
              class_id: TEST_CLASS_ID, glofox_id: "glofox-booking-456",
              classes: { id: TEST_CLASS_ID, trainer_id: null },
              members: { glofox_id: "glofox-member-789" },
            },
            error: null,
          });
        }
        if (bookingsCallCount === 2) return createChainableMock({ data: { id: TEST_BOOKING_ID, status: "checked_in" }, error: null });
      }
      if (table === "activity_log") return createChainableMock({ data: null, error: null });
      return originalFrom(table);
    }) as typeof supabase.from;
    mockSupabase = supabase;

    await POST(
      makeRequest("/api/check-in", {
        method: "POST",
        body: JSON.stringify({ booking_id: TEST_BOOKING_ID }),
      })
    );
    expect(mockInngestSend).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "glofox/mark-attendance",
        data: expect.objectContaining({
          booking_id: TEST_BOOKING_ID,
          glofox_booking_id: "glofox-booking-456",
          glofox_user_id: "glofox-member-789",
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
              classes: { id: TEST_CLASS_ID, trainer_id: null },
              members: { glofox_id: null },
            },
            error: null,
          });
        }
        if (bookingsCallCount === 2) {
          return createChainableMock({ data: null, error: { message: "update failed" } });
        }
      }
      return originalFrom(table);
    }) as typeof supabase.from;
    mockSupabase = supabase;

    const res = await POST(
      makeRequest("/api/check-in", {
        method: "POST",
        body: JSON.stringify({ booking_id: TEST_BOOKING_ID }),
      })
    );
    expect(res.status).toBe(500);
  });
});
