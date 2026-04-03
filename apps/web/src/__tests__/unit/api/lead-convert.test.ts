import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Constants ──────────────────────────────────────────────────────
const TEST_USER_ID = "aaaaaaaa-1111-2222-3333-444444444444";
const TEST_STUDIO_ID = "bbbbbbbb-1111-2222-3333-444444444444";
const TEST_LEAD_ID = "llllllll-1111-2222-3333-444444444444";
const TEST_MEMBER_ID = "mmmmmmmm-1111-2222-3333-444444444444";

function makeRequest(body?: unknown): NextRequest {
  return new NextRequest(
    new URL(`http://localhost:3000/api/leads/${TEST_LEAD_ID}/convert`),
    {
      method: "POST",
      body: body ? JSON.stringify(body) : "{}",
      headers: { "content-type": "application/json" },
    }
  );
}

// ─── Chainable mock ─────────────────────────────────────────────────
import { createChainableMock } from "@/__tests__/helpers/mock-chainable";

// ─── Supabase mock builder ──────────────────────────────────────────
function buildSupabaseMock(opts: {
  authenticated?: boolean;
  roles?: string[];
  lead?: Record<string, unknown> | null;
  leadError?: boolean;
  existingProfile?: { id: string } | null;
  newProfileId?: string;
  profileInsertError?: boolean;
  updateError?: boolean;
}) {
  const o = {
    authenticated: true,
    roles: ["admin"],
    lead: {
      id: TEST_LEAD_ID,
      first_name: "Jane",
      last_name: "Doe",
      email: "jane@test.com",
      phone: "555-1234",
      status: "new",
      studio_id: TEST_STUDIO_ID,
    } as Record<string, unknown> | null,
    leadError: false,
    existingProfile: null as { id: string } | null,
    newProfileId: TEST_MEMBER_ID,
    profileInsertError: false,
    updateError: false,
    ...opts,
  };

  let profilesCallCount = 0;
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
        profilesCallCount++;
        if (profilesCallCount === 1) {
          // Auth role check
          return createChainableMock({
            data: { studio_id: TEST_STUDIO_ID, roles: o.roles },
            error: null,
          });
        }
        if (profilesCallCount === 2) {
          // Duplicate email check (maybeSingle)
          return createChainableMock({
            data: o.existingProfile,
            error: null,
          });
        }
        if (profilesCallCount === 3) {
          // Insert new profile
          if (o.profileInsertError) {
            return createChainableMock({
              data: null,
              error: { message: "Profile insert failed" },
            });
          }
          return createChainableMock({
            data: { id: o.newProfileId },
            error: null,
          });
        }
        return createChainableMock({ data: null, error: null });
      }
      if (table === "leads") {
        leadsCallCount++;
        if (leadsCallCount === 1) {
          // Fetch the lead
          if (o.leadError) {
            return createChainableMock({
              data: null,
              error: { message: "Not found" },
            });
          }
          return createChainableMock({ data: o.lead, error: null });
        }
        // Update lead status
        if (o.updateError) {
          return createChainableMock({
            data: null,
            error: { message: "Update failed" },
          });
        }
        return createChainableMock({
          data: {
            ...o.lead,
            status: "converted",
            converted_member_id: o.existingProfile?.id ?? o.newProfileId,
          },
          error: null,
        });
      }
      // lead_activities, activity_log, membership_plans, members
      return createChainableMock({ data: null, error: null });
    }),
  };
}

// ─── Module mocks ───────────────────────────────────────────────────
let supabaseMock: ReturnType<typeof buildSupabaseMock>;

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(() => Promise.resolve(supabaseMock)),
}));

const { POST } = await import("@/app/api/leads/[id]/convert/route");

// ─── Tests ──────────────────────────────────────────────────────────
describe("POST /api/leads/[id]/convert", () => {
  beforeEach(() => vi.clearAllMocks());

  const routeContext = { params: Promise.resolve({ id: TEST_LEAD_ID }) };

  // -- Auth ---------------------------------------------------------------

  it("returns 401 when unauthenticated", async () => {
    supabaseMock = buildSupabaseMock({ authenticated: false });
    const res = await POST(makeRequest(), routeContext);
    expect(res.status).toBe(401);
  });

  it("returns 403 when user lacks admin/manager role", async () => {
    supabaseMock = buildSupabaseMock({ roles: ["member"] });
    const res = await POST(makeRequest(), routeContext);
    expect(res.status).toBe(403);
  });

  // -- Lead not found -----------------------------------------------------

  it("returns 404 when lead does not exist", async () => {
    supabaseMock = buildSupabaseMock({ leadError: true });
    const res = await POST(makeRequest(), routeContext);
    expect(res.status).toBe(404);
  });

  // -- Already converted --------------------------------------------------

  it("returns 409 when lead is already converted", async () => {
    supabaseMock = buildSupabaseMock({
      lead: {
        id: TEST_LEAD_ID,
        first_name: "Jane",
        last_name: "Doe",
        email: "jane@test.com",
        status: "converted",
        studio_id: TEST_STUDIO_ID,
      },
    });
    const res = await POST(makeRequest(), routeContext);
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toContain("already been converted");
  });

  // -- Successful conversion (new profile) --------------------------------

  it("returns 200 with member_id on successful conversion", async () => {
    supabaseMock = buildSupabaseMock({});
    const res = await POST(makeRequest(), routeContext);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.member_id).toBe(TEST_MEMBER_ID);
    expect(json.data.lead.status).toBe("converted");
  });

  // -- Links to existing profile ------------------------------------------

  it("links to existing profile when email already exists", async () => {
    const existingId = "existing-profile-111";
    supabaseMock = buildSupabaseMock({
      existingProfile: { id: existingId },
    });
    const res = await POST(makeRequest(), routeContext);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.member_id).toBe(existingId);
  });

  // -- Profile creation failure -------------------------------------------

  it("returns 500 when profile creation fails", async () => {
    supabaseMock = buildSupabaseMock({ profileInsertError: true });
    const res = await POST(makeRequest(), routeContext);
    expect(res.status).toBe(500);
  });
});
