import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
  enrichIntakeProfile,
  IntakeData,
  IntakeEnrichmentResult,
} from "@/lib/ai/intake-enrichment";

const STUDIO_ID = "11111111-1111-1111-1111-111111111111";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const INTAKE_WINDOW_DAYS = 14; // analyze first 2 weeks
const MAX_JOIN_AGE_DAYS = 21; // only process members who joined within 21 days

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Classify a booking time into a time slot category.
 */
function classifyTimeSlot(isoDate: string): "morning" | "afternoon" | "evening" {
  const hour = new Date(isoDate).getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

/**
 * Get the day of the week name from an ISO date string.
 */
function getDayOfWeek(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("en-US", { weekday: "long" });
}

/**
 * Build IntakeData for a member by querying their first 2 weeks of behavior.
 */
async function buildIntakeData(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  memberId: string
): Promise<{ data: IntakeData | null; error?: string }> {
  // Fetch member profile
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, membership_type, join_date, created_at")
    .eq("id", memberId)
    .eq("studio_id", STUDIO_ID)
    .single();

  if (profileError || !profile) {
    return { data: null, error: "Member not found" };
  }

  const joinDate = profile.join_date ?? profile.created_at;
  if (!joinDate) {
    return { data: null, error: "Member has no join date" };
  }

  const joinDateObj = new Date(joinDate);
  const now = new Date();
  const daysSinceJoin = Math.floor(
    (now.getTime() - joinDateObj.getTime()) / (24 * 60 * 60 * 1000)
  );

  if (daysSinceJoin > MAX_JOIN_AGE_DAYS) {
    return {
      data: null,
      error: `Member joined ${daysSinceJoin} days ago (max ${MAX_JOIN_AGE_DAYS})`,
    };
  }

  // Determine the intake analysis window: join date + 14 days (or now if less)
  const intakeWindowEnd = new Date(
    Math.min(
      joinDateObj.getTime() + INTAKE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
      now.getTime()
    )
  ).toISOString();

  // Run queries in parallel
  const [
    bookingsResult,
    cancellationsResult,
    noShowsResult,
    transactionsResult,
    referralResult,
    merchResult,
  ] = await Promise.all([
    // All checked-in bookings in the intake window
    supabase
      .from("bookings")
      .select(
        "id, checked_in_at, class_id, booking_type, classes(title, start_time)"
      )
      .eq("studio_id", STUDIO_ID)
      .eq("member_id", memberId)
      .eq("status", "checked_in")
      .gte("checked_in_at", joinDate)
      .lte("checked_in_at", intakeWindowEnd),

    // Cancellations in intake window
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", STUDIO_ID)
      .eq("member_id", memberId)
      .in("status", ["cancelled", "late_cancelled"])
      .gte("created_at", joinDate)
      .lte("created_at", intakeWindowEnd),

    // No-shows in intake window
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", STUDIO_ID)
      .eq("member_id", memberId)
      .eq("status", "no_show")
      .gte("created_at", joinDate)
      .lte("created_at", intakeWindowEnd),

    // Total spend in intake window
    supabase
      .from("transactions")
      .select("amount")
      .eq("studio_id", STUDIO_ID)
      .eq("member_id", memberId)
      .eq("status", "completed")
      .gte("created_at", joinDate)
      .lte("created_at", intakeWindowEnd),

    // Referral info: check if member was referred (has a referral tag or referred_by field)
    supabase
      .from("member_tags")
      .select("tag")
      .eq("member_id", memberId)
      .like("tag", "referred_by:%")
      .limit(1)
      .maybeSingle(),

    // Merch purchases
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", STUDIO_ID)
      .eq("member_id", memberId)
      .eq("type", "merchandise")
      .eq("status", "completed")
      .gte("created_at", joinDate)
      .lte("created_at", intakeWindowEnd),
  ]);

  const bookings = bookingsResult.data ?? [];

  // Derive visit days and time slots from bookings
  const visitDays: string[] = [];
  const timeSlots: string[] = [];
  const classCountMap = new Map<string, number>();
  let usedColdPlunge = false;
  let wasWalkIn = false;

  for (const booking of bookings) {
    const checkinTime = booking.checked_in_at;
    if (checkinTime) {
      const day = getDayOfWeek(checkinTime);
      if (!visitDays.includes(day)) visitDays.push(day);

      const slot = classifyTimeSlot(checkinTime);
      if (!timeSlots.includes(slot)) timeSlots.push(slot);
    }

    // Track class attendance
    const classData = booking.classes as { title?: string; start_time?: string } | null;
    const classTitle = classData?.title ?? "Open Sauna";
    classCountMap.set(classTitle, (classCountMap.get(classTitle) ?? 0) + 1);

    // Infer cold plunge usage from class title
    if (classTitle.toLowerCase().includes("cold plunge") || classTitle.toLowerCase().includes("cold")) {
      usedColdPlunge = true;
    }

    // Check for walk-in bookings
    if (booking.booking_type === "walk_in") {
      wasWalkIn = true;
    }
  }

  const classesAttended = Array.from(classCountMap.entries())
    .map(([title, count]) => ({ title, count }))
    .sort((a, b) => b.count - a.count);

  // Total spend in cents
  const totalSpend =
    transactionsResult.data?.reduce(
      (sum: number, t: { amount: number }) => sum + (t.amount ?? 0),
      0
    ) ?? 0;

  // Parse referral info
  const referredBy = referralResult.data?.tag
    ? referralResult.data.tag.replace("referred_by:", "")
    : null;

  return {
    data: {
      member_id: memberId,
      full_name: profile.full_name ?? "Unknown Member",
      join_date: joinDate,
      days_since_join: daysSinceJoin,
      membership_type: profile.membership_type ?? null,
      total_visits: bookings.length,
      visit_days: visitDays,
      preferred_time_slots: timeSlots,
      classes_attended: classesAttended,
      used_cold_plunge: usedColdPlunge,
      was_walk_in: wasWalkIn,
      cancellations: cancellationsResult.count ?? 0,
      no_shows: noShowsResult.count ?? 0,
      total_spend: totalSpend,
      referred_by: referredBy,
      purchased_merch: (merchResult.count ?? 0) > 0,
    },
  };
}

/**
 * Cache the enrichment result in ai_cache.
 */
async function cacheResult(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  memberId: string,
  result: IntakeEnrichmentResult
): Promise<void> {
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString();

  await supabase
    .from("ai_cache")
    .upsert(
      {
        studio_id: STUDIO_ID,
        cache_type: "intake_enrichment",
        entity_id: memberId,
        data: result as unknown as Record<string, unknown>,
        generated_at: now,
        expires_at: expiresAt,
      },
      { onConflict: "studio_id,cache_type,entity_id" }
    )
    .then(
      () => {
        /* success */
      },
      (err) => {
        console.error("Failed to cache intake enrichment:", err);
      }
    );
}

/**
 * Apply personalization tags to the member_tags table.
 */
async function applyPersonalizationTags(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  memberId: string,
  tags: string[]
): Promise<void> {
  if (tags.length === 0) return;

  const tagRows = tags.map((tag) => ({
    member_id: memberId,
    tag,
    source: "ai_intake_enrichment",
  }));

  // Upsert to avoid duplicates
  await supabase
    .from("member_tags")
    .upsert(tagRows, { onConflict: "member_id,tag" })
    .then(
      () => {
        /* success */
      },
      (err) => {
        console.error("Failed to apply personalization tags:", err);
      }
    );
}

// ---------------------------------------------------------------------------
// POST — Enrich intake profile for a single member
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { member_id } = body as { member_id?: string };

    if (!member_id) {
      return NextResponse.json(
        { error: "member_id is required" },
        { status: 400 }
      );
    }

    // Check for a valid cache entry first
    const { data: cached } = await supabase
      .from("ai_cache")
      .select("data, generated_at, expires_at")
      .eq("studio_id", STUDIO_ID)
      .eq("cache_type", "intake_enrichment")
      .eq("entity_id", member_id)
      .gt("expires_at", new Date().toISOString())
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached?.data) {
      return NextResponse.json({
        ...(cached.data as IntakeEnrichmentResult),
        cached: true,
        generated_at: cached.generated_at,
      });
    }

    // Build intake data from Supabase
    const { data: intakeData, error: buildError } = await buildIntakeData(
      supabase,
      member_id
    );

    if (!intakeData) {
      return NextResponse.json(
        { error: buildError ?? "Failed to build intake data" },
        { status: buildError?.includes("not found") ? 404 : 422 }
      );
    }

    // Generate enrichment
    const result = await enrichIntakeProfile(intakeData);

    // Cache result and apply tags in parallel
    await Promise.all([
      cacheResult(supabase, member_id, result),
      applyPersonalizationTags(supabase, member_id, result.personalization_tags),
    ]);

    return NextResponse.json({
      ...result,
      cached: false,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("POST /api/ai/intake-enrichment error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// GET — Batch process members who joined 14-21 days ago (cron endpoint)
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const supabase = await createServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const fourteenDaysAgo = new Date(
      now.getTime() - 14 * 24 * 60 * 60 * 1000
    ).toISOString();
    const twentyOneDaysAgo = new Date(
      now.getTime() - 21 * 24 * 60 * 60 * 1000
    ).toISOString();

    // Find members who joined 14-21 days ago
    const { data: candidates, error: candidatesError } = await supabase
      .from("profiles")
      .select("id, full_name, join_date, created_at")
      .eq("studio_id", STUDIO_ID)
      .gte("join_date", twentyOneDaysAgo)
      .lte("join_date", fourteenDaysAgo)
      .limit(50); // fetch more than needed to filter

    if (candidatesError || !candidates || candidates.length === 0) {
      return NextResponse.json({ processed: 0, errors: [] });
    }

    // Filter out members who already have a cache entry
    const memberIds = candidates.map((c) => c.id);

    const { data: existingCache } = await supabase
      .from("ai_cache")
      .select("entity_id")
      .eq("studio_id", STUDIO_ID)
      .eq("cache_type", "intake_enrichment")
      .in("entity_id", memberIds);

    const cachedIds = new Set(
      (existingCache ?? []).map((c) => c.entity_id)
    );

    const toProcess = candidates
      .filter((c) => !cachedIds.has(c.id))
      .slice(0, 20); // cap at 20 per batch

    if (toProcess.length === 0) {
      return NextResponse.json({ processed: 0, errors: [] });
    }

    // Process each member sequentially to avoid overwhelming the API
    let processed = 0;
    const errors: { member_id: string; error: string }[] = [];

    for (const member of toProcess) {
      try {
        const { data: intakeData, error: buildError } = await buildIntakeData(
          supabase,
          member.id
        );

        if (!intakeData) {
          errors.push({
            member_id: member.id,
            error: buildError ?? "Failed to build intake data",
          });
          continue;
        }

        const result = await enrichIntakeProfile(intakeData);

        await Promise.all([
          cacheResult(supabase, member.id, result),
          applyPersonalizationTags(
            supabase,
            member.id,
            result.personalization_tags
          ),
        ]);

        processed++;
      } catch (err) {
        errors.push({
          member_id: member.id,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({ processed, errors });
  } catch (err) {
    console.error("GET /api/ai/intake-enrichment error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
