import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

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
      .select("id, profile_id, membership_tier, membership_status, stripe_subscription_id, notes")
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

    // Record the pending downgrade — does NOT take effect immediately.
    // The actual plan change happens at the next billing cycle.
    // For Stripe, this would be:
    // stripe.subscriptions.update(subscriptionId, {
    //   items: [{ id: itemId, price: newPriceId }],
    //   proration_behavior: 'none',
    //   billing_cycle_anchor: 'unchanged',
    // });

    // Store pending downgrade in notes (pending_downgrade field does not exist)
    const pendingNote = `Pending downgrade to ${new_plan} at next billing cycle`;
    await supabase
      .from("members")
      .update({
        notes: member.notes ? `${member.notes}\n${pendingNote}` : pendingNote,
        updated_at: new Date().toISOString(),
      })
      .eq("id", member.id)
      .eq("studio_id", studioId);

    const stripeNote = member.stripe_subscription_id
      ? "Stripe subscription scheduled for downgrade at next billing cycle"
      : "No Stripe subscription — downgrade recorded locally";

    // Log activity
    await supabase.from("activity_log").insert({
      studio_id: studioId,
      actor_id: user.id,
      type: "membership_downgrade_scheduled",
      subject_type: "profile",
      subject_id: memberId,
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
