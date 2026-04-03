import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const ALLOWED_ROLES = ["owner", "admin", "manager"];

/**
 * POST /api/leads/[id]/convert
 * Convert a lead to a member: create a profile, update lead status to 'converted',
 * set converted_member_id and converted_at, log activity.
 * Body: { roles?, membership_plan_id? }
 */
export async function POST(
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("studio_id, roles")
      .eq("id", user.id)
      .single();

    const studioId =
      profile?.studio_id ?? "11111111-1111-1111-1111-111111111111";
    const roles: string[] = profile?.roles ?? [];
    if (!roles.some((r: string) => ALLOWED_ROLES.includes(r))) {
      return NextResponse.json(
        { error: "Insufficient permissions. Admin or manager role required." },
        { status: 403 }
      );
    }

    // Fetch the lead
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", id)
      .eq("studio_id", studioId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (lead.status === "converted") {
      return NextResponse.json(
        { error: "Lead has already been converted" },
        { status: 409 }
      );
    }

    const body = await request.json().catch(() => ({}));

    // Check if a profile with this email already exists
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", lead.email)
      .eq("studio_id", studioId)
      .maybeSingle();

    let memberId: string;

    if (existingProfile) {
      // Link to existing profile
      memberId = existingProfile.id;
    } else {
      // Create a new member profile
      const fullName = `${lead.first_name} ${lead.last_name}`.trim();
      const { data: newProfile, error: profileError } = await supabase
        .from("profiles")
        .insert({
          email: lead.email,
          full_name: fullName,
          phone: lead.phone ?? null,
          roles: body.roles ?? ["member"],
          studio_id: studioId,
          status: "active",
        })
        .select()
        .single();

      if (profileError || !newProfile) {
        return NextResponse.json(
          { error: profileError?.message ?? "Failed to create member profile" },
          { status: 500 }
        );
      }
      memberId = newProfile.id;
    }

    // If a membership plan was specified, create the membership record
    const membershipPlanId = body.membership_plan_id;
    if (membershipPlanId) {
      // Look up the plan details
      const { data: plan } = await supabase
        .from("membership_plans")
        .select("id, name, tier, price")
        .eq("id", membershipPlanId)
        .eq("studio_id", studioId)
        .single();

      if (plan) {
        // Upsert into members table with the chosen plan
        await supabase.from("members").upsert(
          {
            profile_id: memberId,
            studio_id: studioId,
            membership_plan_id: plan.id,
            membership_tier: plan.tier ?? plan.name,
            membership_status: "active",
            join_date: new Date().toISOString().split("T")[0],
          },
          { onConflict: "profile_id,studio_id" }
        );
      }
    }

    // Update lead status
    const { data: updatedLead, error: updateError } = await supabase
      .from("leads")
      .update({
        status: "converted",
        converted_member_id: memberId,
        converted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("studio_id", studioId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    // Log lead activity
    await supabase.from("lead_activities").insert({
      lead_id: id,
      studio_id: studioId,
      activity_type: "converted",
      description: `Lead converted to member`,
      performed_by: user.id,
      metadata: { member_id: memberId },
    });

    // Log to activity_log
    await supabase.from("activity_log").insert({
      studio_id: studioId,
      actor_id: user.id,
      type: "lead_converted",
      subject_type: "lead",
      subject_id: id,
      metadata: { member_id: memberId, email: lead.email },
    });

    return NextResponse.json({
      data: {
        lead: updatedLead,
        member_id: memberId,
      },
    });
  } catch (err) {
    console.error("POST /api/leads/[id]/convert error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
