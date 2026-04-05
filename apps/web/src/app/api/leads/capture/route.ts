import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { normalizePhone } from '@/lib/validation'

/**
 * POST /api/leads/capture
 * PUBLIC endpoint — no auth required.
 * Accept lead capture form submissions from external sources.
 *
 * Body: { first_name, last_name, email, phone?, source?, studio_token, honeypot? }
 *
 * studio_token is used to identify the studio (maps to a row in studio_settings or studios table).
 * The honeypot field should be empty — if filled, the request is likely a bot.
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limit: 10 requests per minute per IP
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const rl = await rateLimit(`leads-capture:${ip}`, 10, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const supabase = await createServerClient();

    const body = await request.json();
    const { first_name, last_name, email, phone, source, studio_token, honeypot } = body;

    // Honeypot check — if this hidden field has a value, it's likely a bot
    if (honeypot) {
      // Return 200 to not reveal the check to the bot
      return NextResponse.json({ success: true });
    }

    // Validate required fields
    if (!first_name || !last_name || !email || !studio_token) {
      return NextResponse.json(
        { error: "first_name, last_name, email, and studio_token are required" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Validate studio_token — look up the studio
    const { data: studio, error: studioError } = await supabase
      .from("studios")
      .select("id")
      .eq("public_token", studio_token)
      .single();

    if (studioError || !studio) {
      return NextResponse.json(
        { error: "Invalid studio_token" },
        { status: 403 }
      );
    }

    const studioId = studio.id;

    // Deduplicate by email within the studio
    const { data: existingLead } = await supabase
      .from("leads")
      .select("id")
      .eq("email", email)
      .eq("studio_id", studioId)
      .maybeSingle();

    if (existingLead) {
      // Update existing lead with new info and log activity
      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      // Update fields if provided and different
      if (first_name) updates.first_name = first_name;
      if (last_name) updates.last_name = last_name;
      if (phone) updates.phone = normalizePhone(phone);

      await supabase
        .from("leads")
        .update(updates)
        .eq("id", existingLead.id)
        .eq("studio_id", studioId);

      // Log form_submitted activity
      await supabase.from("lead_activities").insert({
        lead_id: existingLead.id,
        studio_id: studioId,
        activity_type: "form_submitted",
        description: `Lead re-submitted capture form from ${source ?? "unknown"} source`,
        metadata: {
          source: source ?? "website",
          ip: request.headers.get("x-forwarded-for") ?? "unknown",
          user_agent: request.headers.get("user-agent") ?? "unknown",
        },
      });

      return NextResponse.json({
        data: { id: existingLead.id, deduplicated: true },
      });
    }

    // Create new lead
    const { data: lead, error: insertError } = await supabase
      .from("leads")
      .insert({
        studio_id: studioId,
        first_name,
        last_name,
        email,
        phone: normalizePhone(phone) ?? null,
        source: source ?? "website",
        status: "new",
        score: 0,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    // Log initial activity
    await supabase.from("lead_activities").insert({
      lead_id: lead.id,
      studio_id: studioId,
      activity_type: "form_submitted",
      description: `Lead captured from ${source ?? "website"} form`,
      metadata: {
        source: source ?? "website",
        ip: request.headers.get("x-forwarded-for") ?? "unknown",
        user_agent: request.headers.get("user-agent") ?? "unknown",
      },
    });

    return NextResponse.json({ data: { id: lead.id } }, { status: 201 });
  } catch (err) {
    console.error("POST /api/leads/capture error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
