import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

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
      .select("studio_id")
      .eq("id", user.id)
      .single();

    const studioId =
      authProfile?.studio_id ?? "11111111-1111-1111-1111-111111111111";

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

    // Fetch current member
    const { data: member, error: memberError } = await supabase
      .from("profiles")
      .select("*, memberships(id, type, status, stripe_subscription_id)")
      .eq("id", memberId)
      .eq("studio_id", studioId)
      .single();

    if (memberError || !member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    const currentMembership = Array.isArray(member.memberships)
      ? member.memberships.find(
          (m: { status: string }) => m.status === "active"
        )
      : null;

    const oldPlan = currentMembership?.type ?? "none";

    if (oldPlan === new_plan) {
      return NextResponse.json(
        { error: "Member is already on this plan" },
        { status: 400 }
      );
    }

    // Update membership tier on the profile
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        membership_tier: new_plan,
        updated_at: new Date().toISOString(),
      })
      .eq("id", memberId)
      .eq("studio_id", studioId);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    // Update the membership record if it exists
    if (currentMembership) {
      await supabase
        .from("memberships")
        .update({
          type: new_plan,
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentMembership.id)
        .eq("studio_id", studioId);
    }

    // If Stripe subscription exists, update with proration
    // Note: Full Stripe integration requires the Stripe SDK.
    // This logs the intent; the actual Stripe call would be:
    // stripe.subscriptions.update(subscriptionId, {
    //   items: [{ id: itemId, price: newPriceId }],
    //   proration_behavior: 'create_prorations',
    // });
    const stripeNote = currentMembership?.stripe_subscription_id
      ? "Stripe subscription proration pending"
      : "No Stripe subscription to update";

    // Log activity
    await supabase.from("activity_log").insert({
      studio_id: studioId,
      actor_id: user.id,
      action: "membership_upgraded",
      entity_type: "profile",
      entity_id: memberId,
      metadata: {
        old_plan: oldPlan,
        new_plan,
        stripe_note: stripeNote,
      },
    });

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
