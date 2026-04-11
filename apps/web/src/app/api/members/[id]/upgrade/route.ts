import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

const VALID_PLANS = ["unlimited", "10_class", "6_class"] as const;
type Plan = (typeof VALID_PLANS)[number];

/**
 * POST /api/members/[id]/upgrade
 * Upgrade a member's membership tier with Stripe proration.
 * Body: { new_plan: 'unlimited' | '10_class' | '6_class' }
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

    const body = await request.json();
    const { new_plan } = body as { new_plan: Plan };

    if (!new_plan || !VALID_PLANS.includes(new_plan)) {
      return NextResponse.json(
        {
          error: `new_plan is required and must be one of: ${VALID_PLANS.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Fetch current member record
    const { data: member, error: memberError } = await supabase
      .from("members")
      .select("id, profile_id, membership_tier, membership_status, stripe_subscription_id")
      .eq("profile_id", memberId)
      .eq("studio_id", studioId)
      .maybeSingle();

    if (memberError || !member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    const oldPlan = member.membership_tier ?? "none";

    if (oldPlan === new_plan) {
      return NextResponse.json(
        { error: "Member is already on this plan" },
        { status: 400 }
      );
    }

    // Update membership tier on the members table
    const { error: updateError } = await supabase
      .from("members")
      .update({
        membership_tier: new_plan,
        updated_at: new Date().toISOString(),
      })
      .eq("id", member.id)
      .eq("studio_id", studioId);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    // If Stripe subscription exists, update with proration
    // Note: Full Stripe integration requires the Stripe SDK.
    // This logs the intent; the actual Stripe call would be:
    // stripe.subscriptions.update(subscriptionId, {
    //   items: [{ id: itemId, price: newPriceId }],
    //   proration_behavior: 'create_prorations',
    // });
    const stripeNote = member.stripe_subscription_id
      ? "Stripe subscription proration pending"
      : "No Stripe subscription to update";

    // BUG-021 fix: 'membership_upgraded' was not in the activity_log type
    // CHECK enum (canonical is 'membership_change'). The previous insert
    // silently swallowed every upgrade. Also add the NOT NULL description
    // and capture { error } per the canonical capture-and-log pattern.
    const { error: activityError } = await supabase.from("activity_log").insert({
      studio_id: studioId,
      actor_id: user.id,
      type: "membership_change",
      subject_type: "profile",
      subject_id: memberId,
      description: `Membership changed: ${oldPlan} → ${new_plan}`,
      metadata: {
        old_plan: oldPlan,
        new_plan,
        stripe_note: stripeNote,
        action: "upgrade",
      },
    });

    if (activityError) {
      console.error(
        "POST /api/members/[id]/upgrade: activity_log insert failed",
        activityError.message
      );
    }

    return NextResponse.json({
      data: {
        member_id: memberId,
        old_plan: oldPlan,
        new_plan,
        effective: "immediate",
        stripe_note: stripeNote,
      },
    });
  } catch (err) {
    console.error("POST /api/members/[id]/upgrade error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
