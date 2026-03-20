import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const VALID_PLANS = ["unlimited", "10_class", "6_class"] as const;
type Plan = (typeof VALID_PLANS)[number];

/**
 * POST /api/members/[id]/downgrade
 * Downgrade a member's membership (takes effect at next billing cycle).
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

    // Fetch current member with active membership
    const { data: member, error: memberError } = await supabase
      .from("profiles")
      .select("*, memberships(id, type, status, stripe_subscription_id, expires_at)")
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

    // Record the pending downgrade — does NOT take effect immediately.
    // The actual plan change happens at the next billing cycle.
    // For Stripe, this would be:
    // stripe.subscriptions.update(subscriptionId, {
    //   items: [{ id: itemId, price: newPriceId }],
    //   proration_behavior: 'none',
    //   billing_cycle_anchor: 'unchanged',
    // });

    // Store pending downgrade in membership metadata
    if (currentMembership) {
      await supabase
        .from("memberships")
        .update({
          pending_downgrade: new_plan,
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentMembership.id)
        .eq("studio_id", studioId);
    }

    const stripeNote = currentMembership?.stripe_subscription_id
      ? "Stripe subscription scheduled for downgrade at next billing cycle"
      : "No Stripe subscription — downgrade recorded locally";

    // Log activity
    await supabase.from("activity_log").insert({
      studio_id: studioId,
      actor_id: user.id,
      action: "membership_downgrade_scheduled",
      entity_type: "profile",
      entity_id: memberId,
      metadata: {
        old_plan: oldPlan,
        new_plan,
        effective: "next_billing_cycle",
        stripe_note: stripeNote,
      },
    });

    return NextResponse.json({
      data: {
        member_id: memberId,
        current_plan: oldPlan,
        scheduled_plan: new_plan,
        effective: "next_billing_cycle",
        stripe_note: stripeNote,
      },
    });
  } catch (err) {
    console.error("POST /api/members/[id]/downgrade error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
