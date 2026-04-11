import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_STUDIO_ID } from '@/lib/constants'
import { normalizePhone } from '@/lib/validation'

/**
 * GET /api/members/[id]
 * Fetch single member with profile, bookings summary, transaction summary, tags, credit packs.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient();
    const { id } = await params;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: authProfile } = await supabase
      .from("profiles")
      .select("studio_id, roles")
      .eq("id", user.id)
      .single();

    const studioId =
      authProfile?.studio_id ?? DEFAULT_STUDIO_ID;

    // Role check
    const roles: string[] = authProfile?.roles ?? [];
    if (!roles.some((r: string) => ["owner", "manager"].includes(r))) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    // Fetch member profile with memberships
    const { data: member, error: memberError } = await supabase
      .from("profiles")
      .select("*, memberships(id, type, status, started_at, expires_at)")
      .eq("id", id)
      .eq("studio_id", studioId)
      .single();

    if (memberError || !member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Fetch tags
    const { data: tags } = await supabase
      .from("member_tags")
      .select("*")
      .eq("member_id", id)
      .eq("studio_id", studioId)
      .order("created_at", { ascending: false });

    // Total bookings count
    const { count: totalBookings } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("member_id", id)
      .eq("studio_id", studioId);

    // Bookings in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { count: recentBookings } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("member_id", id)
      .eq("studio_id", studioId)
      .gte("created_at", thirtyDaysAgo.toISOString());

    // Transaction summary
    const { data: transactions } = await supabase
      .from("transactions")
      .select("amount")
      .eq("member_id", id)
      .eq("studio_id", studioId)
      .eq("status", "completed");

    const totalSpend = (transactions ?? []).reduce(
      (sum, t) => sum + (t.amount ?? 0),
      0
    );

    // Credit packs
    const { data: creditPacks } = await supabase
      .from("credit_packs")
      .select("*")
      .eq("member_id", id)
      .eq("studio_id", studioId)
      .order("created_at", { ascending: false });

    return NextResponse.json({
      data: {
        ...member,
        tags: tags ?? [],
        credit_packs: creditPacks ?? [],
        bookings_summary: {
          total: totalBookings ?? 0,
          last_30_days: recentBookings ?? 0,
        },
        transaction_summary: {
          total_spend: totalSpend,
          transaction_count: (transactions ?? []).length,
        },
      },
    });
  } catch (err) {
    console.error("GET /api/members/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/members/[id]
 * Update member contact info and notes. URL [id] is the `profiles.id`
 * (profile_id), NOT the `members.id` — see BUG-013.
 *
 * Accepted body fields:
 *   profiles columns: full_name?, email?, phone?, exclude_from_analytics?
 *   members columns:  notes?
 *
 * Rejected (use the dedicated routes below instead):
 *   membership_tier, membership_status, credits_remaining → /upgrade, /pause
 *   roles → owner-only role-management endpoint (not yet implemented)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient();
    const { id } = await params;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: authProfile } = await supabase
      .from("profiles")
      .select("studio_id, roles")
      .eq("id", user.id)
      .single();

    const studioId =
      authProfile?.studio_id ?? DEFAULT_STUDIO_ID;

    // Role check — only owner/manager can update members (prevents privilege escalation)
    const callerRoles: string[] = authProfile?.roles ?? [];
    if (!callerRoles.some((r: string) => ["owner", "manager"].includes(r))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    // BUG-012 fix: split allowed fields by table. Membership state changes
    // (membership_tier/status/credits_remaining) live on `members` and have
    // dedicated routes (/upgrade, /pause, /downgrade) — they are NOT in
    // either list here. `notes` lives on `members`, NOT `profiles` —
    // BUG-012 Layer 1.
    // NOTE: 'roles' intentionally excluded — role changes require owner-only endpoint
    const profileAllowedFields = [
      "full_name",
      "email",
      "phone",
      "exclude_from_analytics",
    ];
    const memberAllowedFields = ["notes"];

    const profileUpdates: Record<string, unknown> = {};
    const memberUpdates: Record<string, unknown> = {};
    for (const field of profileAllowedFields) {
      if (body[field] !== undefined) profileUpdates[field] = body[field];
    }
    for (const field of memberAllowedFields) {
      if (body[field] !== undefined) memberUpdates[field] = body[field];
    }

    if (profileUpdates.phone !== undefined) {
      profileUpdates.phone = normalizePhone(profileUpdates.phone as string | null);
    }

    if (
      Object.keys(profileUpdates).length === 0 &&
      Object.keys(memberUpdates).length === 0
    ) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // Server-side email format validation (matches POST handler).
    if (typeof profileUpdates.email === "string") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(profileUpdates.email)) {
        return NextResponse.json(
          { error: "Invalid email format" },
          { status: 400 }
        );
      }
    }

    // BUG-012 Layer 6: duplicate-email check when email is being changed.
    // Mirrors the POST handler check, with .neq("id", id) to allow keeping
    // the same email (idempotent update).
    if (profileUpdates.email !== undefined) {
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", profileUpdates.email)
        .eq("studio_id", studioId)
        .neq("id", id)
        .maybeSingle();
      if (existing) {
        return NextResponse.json(
          { error: "A member with this email already exists" },
          { status: 409 }
        );
      }
    }

    // Fetch the existing profile up front. Two reasons:
    //   1) Confirms the member exists in this studio before any writes — if
    //      not, we 404 cleanly without leaving partial state.
    //   2) Captures `full_name` for the activity_log description regardless
    //      of which table the update touches. Without this, a notes-only
    //      update would have no profile fetch and the description would
    //      fall back to "(unknown)" — code-reviewer Important #4.
    const { data: existingProfile, error: existingProfileError } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("id", id)
      .eq("studio_id", studioId)
      .single();

    if (existingProfileError || !existingProfile) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Profile update — only fires if there's at least one profile field.
    let updatedProfile: Record<string, unknown> | null = null;
    if (Object.keys(profileUpdates).length > 0) {
      profileUpdates.updated_at = new Date().toISOString();
      const { data, error } = await supabase
        .from("profiles")
        .update(profileUpdates)
        .eq("id", id)
        .eq("studio_id", studioId)
        .select()
        .single();
      if (error) {
        return NextResponse.json(
          { error: "Internal server error" },
          { status: 500 }
        );
      }
      if (!data) {
        return NextResponse.json(
          { error: "Member not found" },
          { status: 404 }
        );
      }
      updatedProfile = data;
    }

    // BUG-012 Layer 1: notes (and any future member-table fields) must
    // write to `members`, not `profiles`. Keyed by profile_id since `id` is
    // the profile UUID. Uses .select().single() so a 0-row UPDATE (orphaned
    // member row, future RLS gap) surfaces as a clean 404 instead of a
    // silent 200 — code-reviewer Important #3.
    if (Object.keys(memberUpdates).length > 0) {
      memberUpdates.updated_at = new Date().toISOString();
      const { data: updatedMember, error: memberError } = await supabase
        .from("members")
        .update(memberUpdates)
        .eq("profile_id", id)
        .eq("studio_id", studioId)
        .select("id")
        .maybeSingle();
      if (memberError) {
        return NextResponse.json(
          { error: `Failed to update member fields: ${memberError.message}` },
          { status: 500 }
        );
      }
      if (!updatedMember) {
        return NextResponse.json(
          { error: "Member not found" },
          { status: 404 }
        );
      }
    }

    // BUG-012 Layer 4: activity_log requires `description` (NOT NULL) and
    // the Supabase JS client does not throw on insert errors. Capture the
    // error and console.error on failure — no rollback because activity
    // log is observability, not business-critical, and the user has
    // genuinely been updated. Mirrors the Tier 3.5 POST handler pattern.
    const updatedFieldNames = [
      ...Object.keys(profileUpdates).filter((k) => k !== "updated_at"),
      ...Object.keys(memberUpdates).filter((k) => k !== "updated_at"),
    ];
    // Prefer the freshly-updated full_name if the profile was touched;
    // otherwise fall back to the pre-update value captured above. Either
    // way, we always have a real name and never write "(unknown)".
    const memberName =
      (updatedProfile?.full_name as string | undefined) ??
      (existingProfile.full_name as string | null) ??
      "(unknown)";
    const { error: activityError } = await supabase
      .from("activity_log")
      .insert({
        studio_id: studioId,
        actor_id: user.id,
        type: "member_updated",
        subject_type: "profile",
        subject_id: id,
        description: `Member updated: ${memberName}`,
        metadata: {
          ...profileUpdates,
          ...memberUpdates,
          fields: updatedFieldNames,
        },
      });
    if (activityError) {
      console.error(
        "PUT /api/members/[id]: activity_log insert failed",
        activityError.message,
      );
    }

    // Invalidate AI cache entries for this member so stale predictions
    // (churn, health score, etc.) are regenerated on next request.
    await supabase
      .from("ai_cache")
      .delete()
      .eq("studio_id", studioId)
      .eq("entity_id", id);

    return NextResponse.json({ data: updatedProfile ?? { id } });
  } catch (err) {
    console.error("PUT /api/members/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/members/[id]
 * Soft-delete a member by setting profiles.is_active = false. URL [id] is
 * the profiles.id (profile_id), NOT the members.id — see BUG-013. Writes an
 * activity_log row with type='member_deleted'. Idempotent: archiving an
 * already-archived member is a no-op and does not append a second log row.
 *
 * BUG-014 fix (Tier 3.7): the previous implementation was broken at three
 * DB layers (phantom `profiles.status` column, missing `description` on the
 * activity_log insert, invalid `type='member_archived'` enum value) and had
 * no role check. All four layers remediated inline.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient();
    const { id } = await params;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: authProfile } = await supabase
      .from("profiles")
      .select("studio_id, roles")
      .eq("id", user.id)
      .single();

    const studioId =
      authProfile?.studio_id ?? DEFAULT_STUDIO_ID;

    // Role check — only owner/manager can archive members. Previously
    // missing: any authenticated user could hit this route.
    const callerRoles: string[] = authProfile?.roles ?? [];
    if (!callerRoles.some((r: string) => ["owner", "manager"].includes(r))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch existing profile up front. Two reasons:
    //   1) Confirms the member exists in this studio before any writes — if
    //      not, we 404 cleanly.
    //   2) Captures `full_name` for the activity_log description so we always
    //      log a real name instead of "(unknown)".
    //   3) Lets us short-circuit the idempotent "already archived" path
    //      without creating a duplicate activity_log row.
    const { data: existingProfile, error: existingProfileError } = await supabase
      .from("profiles")
      .select("id, full_name, is_active")
      .eq("id", id)
      .eq("studio_id", studioId)
      .single();

    if (existingProfileError || !existingProfile) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Idempotent short-circuit. Already archived? Return success without
    // writing a new activity_log row. Callers can detect via the flag.
    if (existingProfile.is_active === false) {
      return NextResponse.json({
        data: { id, already_archived: true },
      });
    }

    // BUG-014 Layer 1: the column is `is_active` on `profiles`, NOT `status`.
    // Flipping is_active=false is the conventional soft-delete flag.
    const { data: updated, error } = await supabase
      .from("profiles")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("studio_id", studioId)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }

    if (!updated) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // BUG-014 Layer 2+3: activity_log requires `description` (NOT NULL) and
    // `type` must be in the CHECK enum. Canonical value is 'member_deleted'
    // — "archived" is a synonym in this soft-delete model. Capture error
    // and console.error on failure — no rollback because activity_log is
    // observability, not business-critical. Mirrors PUT + POST handlers.
    const memberName = existingProfile.full_name ?? "(unknown)";
    const { error: activityError } = await supabase
      .from("activity_log")
      .insert({
        studio_id: studioId,
        actor_id: user.id,
        type: "member_deleted",
        subject_type: "profile",
        subject_id: id,
        description: `Member archived: ${memberName}`,
        metadata: {
          action: "archive",
          profile_id: id,
        },
      });
    if (activityError) {
      console.error(
        "DELETE /api/members/[id]: activity_log insert failed",
        activityError.message,
      );
    }

    // Invalidate AI cache entries for this member so churn/health
    // predictions don't count an archived member as active.
    await supabase
      .from("ai_cache")
      .delete()
      .eq("studio_id", studioId)
      .eq("entity_id", id);

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("DELETE /api/members/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
