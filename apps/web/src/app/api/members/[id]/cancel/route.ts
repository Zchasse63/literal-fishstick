import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_STUDIO_ID } from '@/lib/constants'
import { cancelSubscription, isStripeConfigured } from '@/lib/stripe'

/**
 * POST /api/members/[id]/cancel
 *
 * Cancel a member's recurring membership.
 * Body: { immediately?: boolean, reason?: string }
 *
 * Default behavior: cancel_at_period_end (member keeps access until the
 * current billing period ends). Set immediately=true to cancel right away.
 *
 * When STRIPE_SECRET_KEY is not set, the Stripe side runs in dry-run mode
 * and the member row is still marked cancelled — useful for dev/test.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient();
    const { id: memberId } = await params;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: authProfile } = await supabase
      .from("profiles")
      .select("studio_id, roles")
      .eq("id", user.id)
      .single();

    const studioId = authProfile?.studio_id ?? DEFAULT_STUDIO_ID;

    // Role check: admin/owner/manager may cancel any member; members may
    // cancel their own subscription.
    const roles: string[] = authProfile?.roles ?? [];
    const isAdmin = roles.some((r: string) =>
      ["owner", "admin", "manager"].includes(r)
    );
    const isSelf = user.id === memberId;

    if (!isAdmin && !isSelf) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { immediately = false, reason = null } = body as {
      immediately?: boolean;
      reason?: string | null;
    };

    // Fetch member record — match by profile_id (the `memberId` path param
    // is the profile id from the UI, consistent with pause/upgrade/downgrade).
    const { data: member, error: memberError } = await supabase
      .from("members")
      .select(
        "id, profile_id, membership_tier, membership_status, stripe_subscription_id"
      )
      .eq("profile_id", memberId)
      .eq("studio_id", studioId)
      .maybeSingle();

    if (memberError || !member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (member.membership_status === "cancelled") {
      return NextResponse.json(
        { error: "Membership is already cancelled" },
        { status: 409 }
      );
    }

    // ─── Stripe Cancel ───────────────────────────────────────
    let stripeResult: { id: string; dry_run: boolean; error: string | null } = {
      id: "",
      dry_run: !isStripeConfigured(),
      error: null,
    };

    if (member.stripe_subscription_id) {
      const result = await cancelSubscription(
        member.stripe_subscription_id,
        immediately
      );
      stripeResult = {
        id: result.id,
        dry_run: result.dry_run,
        error: result.error,
      };

      if (result.error) {
        // Capture-and-log: record the failure but don't block the DB update.
        console.error(
          `POST /api/members/${memberId}/cancel: Stripe cancel failed: ${result.error}`
        );
      }
    }

    // ─── Update Member Row ───────────────────────────────────
    const nowIso = new Date().toISOString();
    const nextStatus = immediately ? "cancelled" : member.membership_status;
    // For cancel-at-period-end we keep status='active' but the activity log
    // records the pending cancel; the dunning cron will flip status when the
    // Stripe webhook fires at period end.

    const { error: updateError } = await supabase
      .from("members")
      .update({
        membership_status: nextStatus,
        updated_at: nowIso,
      })
      .eq("id", member.id)
      .eq("studio_id", studioId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // ─── Activity Log ────────────────────────────────────────
    const { error: activityError } = await supabase.from("activity_log").insert({
      studio_id: studioId,
      actor_id: user.id,
      type: "membership_change",
      subject_type: "profile",
      subject_id: memberId,
      description: immediately
        ? `Membership cancelled immediately (was ${member.membership_tier ?? "none"})`
        : `Membership cancellation scheduled for end of billing period (was ${member.membership_tier ?? "none"})`,
      metadata: {
        previous_tier: member.membership_tier,
        action: immediately ? "cancel_immediate" : "cancel_at_period_end",
        stripe_subscription_id: member.stripe_subscription_id,
        stripe_result_id: stripeResult.id,
        stripe_dry_run: stripeResult.dry_run,
        stripe_error: stripeResult.error,
        reason,
      },
    });

    if (activityError) {
      console.error(
        "POST /api/members/[id]/cancel: activity_log insert failed",
        activityError.message
      );
    }

    return NextResponse.json({
      data: {
        member_id: memberId,
        previous_tier: member.membership_tier,
        cancel_at_period_end: !immediately,
        cancelled_immediately: immediately,
        effective: immediately ? "now" : "end_of_billing_period",
        stripe: {
          subscription_id: member.stripe_subscription_id,
          result_id: stripeResult.id,
          dry_run: stripeResult.dry_run,
          error: stripeResult.error,
        },
      },
    });
  } catch (err) {
    console.error("POST /api/members/[id]/cancel error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
