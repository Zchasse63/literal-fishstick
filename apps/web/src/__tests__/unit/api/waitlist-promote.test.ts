import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Constants ──────────────────────────────────────────────────────
const TEST_USER_ID = "aaaaaaaa-1111-2222-3333-444444444444";
const TEST_STUDIO_ID = "bbbbbbbb-1111-2222-3333-444444444444";
const TEST_CLASS_ID = "cccccccc-1111-2222-3333-444444444444";
const TEST_MEMBER_ID = "dddddddd-1111-2222-3333-444444444444";
const TEST_WAITLIST_ID = "eeeeeeee-1111-2222-3333-444444444444";
const TEST_BOOKING_ID = "ffffffff-1111-2222-3333-444444444444";
const CRON_SECRET = "test-cron-secret-123";

function makeRequest(
  headers: Record<string, string> = {}
): NextRequest {
  return new NextRequest(
    new URL("http://localhost:3000/api/cron/waitlist-promote"),
    { method: "POST", headers }
  );
}

// ─── Chainable mock ─────────────────────────────────────────────────
import { createChainableMock } from "@/__tests__/helpers/mock-chainable";

// ─── Supabase mock builder ──────────────────────────────────────────
function buildSupabaseMock(opts: {
  authenticated?: boolean;
  roles?: string[];
  upcomingClasses?: unknown[];
  classError?: boolean;
  bookedCount?: number;
  waitlistEntries?: unknown[];
  existingBooking?: unknown;
  bookingInsertError?: boolean;
}) {
  const o = {
    authenticated: true,
    roles: ["owner"],
    upcomingClasses: [] as unknown[],
    classError: false,
    bookedCount: 5,
    waitlistEntries: [] as unknown[],
    existingBooking: null,
    bookingInsertError: false,
    ...opts,
  };

  let bookingsCallCount = 0;

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
      if (table === "classes") {
        if (o.classError) {
          return createChainableMock({
            data: null,
            error: { message: "DB error" },
          });
        }
        return createChainableMock({
          data: o.upcomingClasses,
          error: null,
        });
      }
      if (table === "bookings") {
        bookingsCallCount++;
        if (bookingsCallCount === 1) {
          // Count current bookings for class
          return createChainableMock({
            data: null,
            error: null,
            count: o.bookedCount,
          });
        }
        if (bookingsCallCount === 2) {
          // Duplicate booking check (maybeSingle)
          return createChainableMock({
            data: o.existingBooking,
            error: null,
          });
        }
        if (bookingsCallCount === 3) {
          // Insert new booking
          if (o.bookingInsertError) {
            return createChainableMock({
              data: null,
              error: { message: "Booking insert failed" },
            });
          }
          return createChainableMock({
            data: { id: TEST_BOOKING_ID },
            error: null,
          });
        }
        return createChainableMock({ data: null, error: null });
      }
      if (table === "waitlist_entries") {
        return createChainableMock({
          data: o.waitlistEntries,
          error: null,
        });
      }
      // activity_log
      return createChainableMock({ data: null, error: null });
    }),
  };
}

// ─── Module mocks ───────────────────────────────────────────────────
let supabaseMock: ReturnType<typeof buildSupabaseMock>;

// Store the original env so we can restore it
const originalEnv = { ...process.env };

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(() => Promise.resolve(supabaseMock)),
}));

const { POST, GET } = await import("@/app/api/cron/waitlist-promote/route");

// ─── Tests ──────────────────────────────────────────────────────────
describe("POST /api/cron/waitlist-promote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = CRON_SECRET;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // -- Auth: cron secret --------------------------------------------------

  it("accepts requests with valid Bearer cron secret", async () => {
    supabaseMock = buildSupabaseMock({});
    const res = await POST(
      makeRequest({ authorization: `Bearer ${CRON_SECRET}` })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.promoted).toBe(0);
  });

  it("accepts requests with valid x-cron-secret header", async () => {
    supabaseMock = buildSupabaseMock({});
    const res = await POST(
      makeRequest({ "x-cron-secret": CRON_SECRET })
    );
    expect(res.status).toBe(200);
  });

  it("returns 401 when unauthenticated and no cron secret", async () => {
    supabaseMock = buildSupabaseMock({ authenticated: false });
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated user lacks admin/owner role", async () => {
    supabaseMock = buildSupabaseMock({ roles: ["member"] });
    const res = await POST(makeRequest());
    expect(res.status).toBe(403);
  });

  // -- No upcoming classes ------------------------------------------------

  it("returns promoted:0 when no upcoming classes", async () => {
    supabaseMock = buildSupabaseMock({
      upcomingClasses: [],
    });
    const res = await POST(
      makeRequest({ authorization: `Bearer ${CRON_SECRET}` })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.promoted).toBe(0);
  });

  // -- Class fetch error --------------------------------------------------

  it("returns 500 when class query fails", async () => {
    supabaseMock = buildSupabaseMock({ classError: true });
    const res = await POST(
      makeRequest({ authorization: `Bearer ${CRON_SECRET}` })
    );
    expect(res.status).toBe(500);
  });

  // -- Promotion with open spots ------------------------------------------

  it("promotes a waitlist entry when class has open spots", async () => {
    const now = new Date();
    const futureStart = new Date(now.getTime() + 2 * 3600000).toISOString();
    supabaseMock = buildSupabaseMock({
      upcomingClasses: [
        {
          id: TEST_CLASS_ID,
          capacity: 12,
          studio_id: TEST_STUDIO_ID,
          start_time: futureStart,
          title: "Open Sauna",
        },
      ],
      bookedCount: 10, // 2 open spots
      waitlistEntries: [
        {
          id: TEST_WAITLIST_ID,
          member_id: TEST_MEMBER_ID,
          class_id: TEST_CLASS_ID,
        },
      ],
    });

    const res = await POST(
      makeRequest({ authorization: `Bearer ${CRON_SECRET}` })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.promoted).toBe(1);
    expect(json.results[0].status).toBe("promoted");
  });

  // -- GET delegates to POST ----------------------------------------------

  it("GET delegates to POST handler", async () => {
    supabaseMock = buildSupabaseMock({});
    const req = new NextRequest(
      new URL("http://localhost:3000/api/cron/waitlist-promote"),
      {
        method: "GET",
        headers: { authorization: `Bearer ${CRON_SECRET}` },
      }
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
  });
});
