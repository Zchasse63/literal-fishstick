import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";

// ─── Helpers ───────────────────────────────────────────────────
function todayDateStr(): string {
  // YYYY-MM-DD for the server's current date
  return new Date().toISOString().split("T")[0]!;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0]!;
}

/** Monday 00:00 of the ISO week containing `dateStr`. */
function weekStart(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = d.getUTCDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().split("T")[0]!;
}

function dayName(): string {
  return [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ][new Date().getDay()]!;
}

function pctDelta(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

// ─── Revenue helper (sum positive completed txns in a range) ──
async function revenueInRange(
  supabase: ReturnType<Awaited<ReturnType<typeof requireRole>>["supabase"] extends infer S ? () => S : never> extends () => infer R ? R : any,
  studioId: string,
  start: string,
  endExclusive: string,
): Promise<number> {
  const { data } = await supabase
    .from("transactions")
    .select("amount")
    .eq("studio_id", studioId)
    .eq("status", "completed")
    .gt("amount", 0)
    .gte("created_at", start + "T00:00:00")
    .lt("created_at", endExclusive + "T00:00:00");
  return (data ?? []).reduce(
    (sum: number, row: { amount: number }) => sum + (row.amount ?? 0),
    0,
  );
}

// ─── Attendance helper (non-cancelled bookings for classes in range) ──
async function attendanceInRange(
  supabase: any,
  studioId: string,
  start: string,
  endExclusive: string,
): Promise<number> {
  // First get class ids in range
  const { data: classes } = await supabase
    .from("classes")
    .select("id")
    .eq("studio_id", studioId)
    .gte("starts_at", start + "T00:00:00")
    .lt("starts_at", endExclusive + "T00:00:00");
  if (!classes || classes.length === 0) return 0;
  const classIds = classes.map((c: { id: string }) => c.id);
  const { count } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("studio_id", studioId)
    .in("class_id", classIds)
    .not("status", "in", '("cancelled","late_cancelled")');
  return count ?? 0;
}

// ─── Fill rate helper ──────────────────────────────────────────
async function fillRateInRange(
  supabase: any,
  studioId: string,
  start: string,
  endExclusive: string,
): Promise<number> {
  const { data: classes } = await supabase
    .from("classes")
    .select("booked_count, capacity")
    .eq("studio_id", studioId)
    .gte("starts_at", start + "T00:00:00")
    .lt("starts_at", endExclusive + "T00:00:00");
  if (!classes || classes.length === 0) return 0;
  let totalFill = 0;
  let count = 0;
  for (const c of classes) {
    if (c.capacity > 0) {
      totalFill += (c.booked_count ?? 0) / c.capacity;
      count++;
    }
  }
  return count > 0 ? totalFill / count : 0;
}

// ─── New faces helper (members with bookings in range who had 0 in lookback) ──
async function newFacesInRange(
  supabase: any,
  studioId: string,
  start: string,
  endExclusive: string,
  lookbackStart: string,
): Promise<number> {
  // Get class ids in this range
  const { data: classes } = await supabase
    .from("classes")
    .select("id")
    .eq("studio_id", studioId)
    .gte("starts_at", start + "T00:00:00")
    .lt("starts_at", endExclusive + "T00:00:00");
  if (!classes || classes.length === 0) return 0;
  const classIds = classes.map((c: { id: string }) => c.id);

  // Members who booked in this range
  const { data: currentBookings } = await supabase
    .from("bookings")
    .select("member_id")
    .eq("studio_id", studioId)
    .in("class_id", classIds)
    .not("status", "in", '("cancelled","late_cancelled")');
  if (!currentBookings || currentBookings.length === 0) return 0;

  const currentMemberIds = [
    ...new Set(
      currentBookings.map((b: { member_id: string }) => b.member_id),
    ),
  ];

  // Get class ids in lookback period
  const { data: lookbackClasses } = await supabase
    .from("classes")
    .select("id")
    .eq("studio_id", studioId)
    .gte("starts_at", lookbackStart + "T00:00:00")
    .lt("starts_at", start + "T00:00:00");

  if (!lookbackClasses || lookbackClasses.length === 0) {
    // No prior classes means everyone is a new face
    return currentMemberIds.length;
  }

  const lookbackClassIds = lookbackClasses.map(
    (c: { id: string }) => c.id,
  );

  // Members who booked in lookback period
  const { data: priorBookings } = await supabase
    .from("bookings")
    .select("member_id")
    .eq("studio_id", studioId)
    .in("class_id", lookbackClassIds)
    .not("status", "in", '("cancelled","late_cancelled")');

  const priorMemberIds = new Set(
    (priorBookings ?? []).map(
      (b: { member_id: string }) => b.member_id,
    ),
  );

  return currentMemberIds.filter(
    (id: string) => !priorMemberIds.has(id),
  ).length;
}

// ─── Cancellation counts helper ────────────────────────────────
async function cancellationsInRange(
  supabase: any,
  studioId: string,
  start: string,
  endExclusive: string,
): Promise<{ cancelled: number; total: number }> {
  const { data: classes } = await supabase
    .from("classes")
    .select("id")
    .eq("studio_id", studioId)
    .gte("starts_at", start + "T00:00:00")
    .lt("starts_at", endExclusive + "T00:00:00");
  if (!classes || classes.length === 0) return { cancelled: 0, total: 0 };
  const classIds = classes.map((c: { id: string }) => c.id);

  const [cancelledRes, totalRes] = await Promise.all([
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", studioId)
      .in("class_id", classIds)
      .in("status", ["cancelled", "late_cancelled"]),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", studioId)
      .in("class_id", classIds),
  ]);

  return {
    cancelled: cancelledRes.count ?? 0,
    total: totalRes.count ?? 0,
  };
}

// ─── Returning members helper ──────────────────────────────────
async function returningMembersInRange(
  supabase: any,
  studioId: string,
  start: string,
  endExclusive: string,
): Promise<number> {
  // Get class ids in this range
  const { data: classes } = await supabase
    .from("classes")
    .select("id")
    .eq("studio_id", studioId)
    .gte("starts_at", start + "T00:00:00")
    .lt("starts_at", endExclusive + "T00:00:00");
  if (!classes || classes.length === 0) return 0;
  const classIds = classes.map((c: { id: string }) => c.id);

  // Members who booked in this range
  const { data: currentBookings } = await supabase
    .from("bookings")
    .select("member_id")
    .eq("studio_id", studioId)
    .in("class_id", classIds)
    .not("status", "in", '("cancelled","late_cancelled")');
  if (!currentBookings || currentBookings.length === 0) return 0;

  const currentMemberIds = [
    ...new Set(
      currentBookings.map((b: { member_id: string }) => b.member_id),
    ),
  ];

  // Get class ids before this range
  const { data: priorClasses } = await supabase
    .from("classes")
    .select("id")
    .eq("studio_id", studioId)
    .lt("starts_at", start + "T00:00:00");
  if (!priorClasses || priorClasses.length === 0) return 0;
  const priorClassIds = priorClasses.map(
    (c: { id: string }) => c.id,
  );

  // Members who booked before this range
  const { data: priorBookings } = await supabase
    .from("bookings")
    .select("member_id")
    .eq("studio_id", studioId)
    .in("class_id", priorClassIds)
    .not("status", "in", '("cancelled","late_cancelled")');

  const priorMemberIds = new Set(
    (priorBookings ?? []).map(
      (b: { member_id: string }) => b.member_id,
    ),
  );

  return currentMemberIds.filter((id: string) =>
    priorMemberIds.has(id),
  ).length;
}

// ─── Signups helper ────────────────────────────────────────────
async function signupsInRange(
  supabase: any,
  studioId: string,
  start: string,
  endExclusive: string,
): Promise<number> {
  const { count } = await supabase
    .from("members")
    .select("id", { count: "exact", head: true })
    .eq("studio_id", studioId)
    .gte("created_at", start + "T00:00:00")
    .lt("created_at", endExclusive + "T00:00:00");
  return count ?? 0;
}

/**
 * GET /api/analytics/kpi-overview
 *
 * Returns hero metrics (today vs same day last week) and weekly review
 * KPIs (this week vs last week). All monetary values are in cents.
 */
export async function GET(request: NextRequest) {
  try {
    void request;

    // ─── Auth + Role Check ─────────────────────────────────────
    const auth = await requireRole(["owner", "manager"]);
    if (auth.error) return auth.error;
    const { studioId, supabase } = auth;

    const today = todayDateStr();
    const tomorrow = addDays(today, 1);
    const compDay = addDays(today, -7);
    const compDayEnd = addDays(compDay, 1);

    const thisWeekStart = weekStart(today);
    const thisWeekEnd = addDays(thisWeekStart, 7);
    const lastWeekStart = addDays(thisWeekStart, -7);
    const lastWeekEnd = thisWeekStart;
    const lookbackStart = addDays(thisWeekStart, -30);
    const lookbackStartPrev = addDays(lastWeekStart, -30);

    // ─── Run hero + weekly queries in parallel ─────────────────
    const [
      // Hero: today
      revToday,
      attToday,
      frToday,
      // Hero: comparison day
      revComp,
      attComp,
      frComp,
      // Hero: new faces this week + last week
      nfThisWeek,
      nfLastWeek,
      // Weekly: this week
      wRevThis,
      wAttThis,
      wSignupsThis,
      wFrThis,
      wRetThis,
      wCancelThis,
      // Weekly: last week
      wRevLast,
      wAttLast,
      wSignupsLast,
      wFrLast,
      wRetLast,
      wCancelLast,
    ] = await Promise.allSettled([
      // Hero metrics — today
      revenueInRange(supabase, studioId!, today, tomorrow),
      attendanceInRange(supabase, studioId!, today, tomorrow),
      fillRateInRange(supabase, studioId!, today, tomorrow),
      // Hero metrics — comparison day
      revenueInRange(supabase, studioId!, compDay, compDayEnd),
      attendanceInRange(supabase, studioId!, compDay, compDayEnd),
      fillRateInRange(supabase, studioId!, compDay, compDayEnd),
      // New faces
      newFacesInRange(supabase, studioId!, thisWeekStart, thisWeekEnd, lookbackStart),
      newFacesInRange(supabase, studioId!, lastWeekStart, lastWeekEnd, lookbackStartPrev),
      // Weekly — this week
      revenueInRange(supabase, studioId!, thisWeekStart, thisWeekEnd),
      attendanceInRange(supabase, studioId!, thisWeekStart, thisWeekEnd),
      signupsInRange(supabase, studioId!, thisWeekStart, thisWeekEnd),
      fillRateInRange(supabase, studioId!, thisWeekStart, thisWeekEnd),
      returningMembersInRange(supabase, studioId!, thisWeekStart, thisWeekEnd),
      cancellationsInRange(supabase, studioId!, thisWeekStart, thisWeekEnd),
      // Weekly — last week
      revenueInRange(supabase, studioId!, lastWeekStart, lastWeekEnd),
      attendanceInRange(supabase, studioId!, lastWeekStart, lastWeekEnd),
      signupsInRange(supabase, studioId!, lastWeekStart, lastWeekEnd),
      fillRateInRange(supabase, studioId!, lastWeekStart, lastWeekEnd),
      returningMembersInRange(supabase, studioId!, lastWeekStart, lastWeekEnd),
      cancellationsInRange(supabase, studioId!, lastWeekStart, lastWeekEnd),
    ]);

    // ─── Extract settled values ────────────────────────────────
    function v<T>(r: PromiseSettledResult<T>, fallback: T): T {
      return r.status === "fulfilled" ? r.value : fallback;
    }

    const heroRevToday = v(revToday, 0);
    const heroRevComp = v(revComp, 0);
    const heroAttToday = v(attToday, 0);
    const heroAttComp = v(attComp, 0);
    const heroFrToday = v(frToday, 0);
    const heroFrComp = v(frComp, 0);
    const heroNfThis = v(nfThisWeek, 0);
    const heroNfLast = v(nfLastWeek, 0);

    const wkRevThis = v(wRevThis, 0);
    const wkRevLast = v(wRevLast, 0);
    const wkAttThis = v(wAttThis, 0);
    const wkAttLast = v(wAttLast, 0);
    const wkSigThis = v(wSignupsThis, 0);
    const wkSigLast = v(wSignupsLast, 0);
    const wkFrThis = v(wFrThis, 0);
    const wkFrLast = v(wFrLast, 0);
    const wkRetThis = v(wRetThis, 0);
    const wkRetLast = v(wRetLast, 0);
    const wkCanThis = v(wCancelThis, { cancelled: 0, total: 0 });
    const wkCanLast = v(wCancelLast, { cancelled: 0, total: 0 });

    const deltaLabel = `vs last ${dayName()}`;

    // ─── Build hero ────────────────────────────────────────────
    const hero = {
      revenue: {
        value: heroRevToday,
        delta: pctDelta(heroRevToday, heroRevComp),
        deltaLabel,
      },
      attendance: {
        value: heroAttToday,
        delta: pctDelta(heroAttToday, heroAttComp),
        deltaLabel,
      },
      fillRate: {
        value: Math.round(heroFrToday * 1000) / 10,
        delta: pctDelta(heroFrToday, heroFrComp),
        deltaLabel,
      },
      newFaces: {
        value: heroNfThis,
        delta: pctDelta(heroNfThis, heroNfLast),
        deltaLabel: "vs last week",
      },
    };

    // ─── Build weekly review ───────────────────────────────────
    const cancelRateThis =
      wkCanThis.total > 0
        ? wkCanThis.cancelled / wkCanThis.total
        : 0;
    const cancelRateLast =
      wkCanLast.total > 0
        ? wkCanLast.cancelled / wkCanLast.total
        : 0;
    const newFaceRatioThis =
      wkAttThis > 0 ? heroNfThis / wkAttThis : 0;
    const newFaceRatioLast =
      wkAttLast > 0 ? heroNfLast / wkAttLast : 0;
    const rpvThis = wkAttThis > 0 ? wkRevThis / wkAttThis : 0;
    const rpvLast = wkAttLast > 0 ? wkRevLast / wkAttLast : 0;

    const week = {
      revenue: {
        value: wkRevThis,
        prior: wkRevLast,
        delta: pctDelta(wkRevThis, wkRevLast),
      },
      attendance: {
        value: wkAttThis,
        prior: wkAttLast,
        delta: pctDelta(wkAttThis, wkAttLast),
      },
      signups: {
        value: wkSigThis,
        prior: wkSigLast,
        delta: pctDelta(wkSigThis, wkSigLast),
      },
      newFaceRatio: {
        value: Math.round(newFaceRatioThis * 1000) / 10,
        prior: Math.round(newFaceRatioLast * 1000) / 10,
        delta: pctDelta(newFaceRatioThis, newFaceRatioLast),
      },
      revenuePerVisit: {
        value: Math.round(rpvThis),
        prior: Math.round(rpvLast),
        delta: pctDelta(rpvThis, rpvLast),
      },
      fillRate: {
        value: Math.round(wkFrThis * 1000) / 10,
        prior: Math.round(wkFrLast * 1000) / 10,
        delta: pctDelta(wkFrThis, wkFrLast),
      },
      returningMembers: {
        value: wkRetThis,
        prior: wkRetLast,
        delta: pctDelta(wkRetThis, wkRetLast),
      },
      cancellationRate: {
        value: Math.round(cancelRateThis * 1000) / 10,
        prior: Math.round(cancelRateLast * 1000) / 10,
        delta: pctDelta(cancelRateThis, cancelRateLast),
      },
    };

    return NextResponse.json(
      { hero, week },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (err) {
    console.error("GET /api/analytics/kpi-overview error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
