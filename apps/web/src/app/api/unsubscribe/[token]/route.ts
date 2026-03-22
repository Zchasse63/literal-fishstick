import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import crypto from "crypto";

// Require a real secret — no insecure fallback allowed
function getUnsubscribeSecret(): string {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) {
    throw new Error('UNSUBSCRIBE_SECRET env var is required');
  }
  return secret;
}

// Token format: `${memberId}:${studioId}:${timestamp}:${hmac}`
// HMAC payload: `${memberId}:${studioId}:${timestamp}`

function parseToken(token: string): {
  memberId: string;
  studioId: string;
  timestamp: string;
  hmac: string;
} | null {
  const parts = token.split(":");
  // UUID format: 8-4-4-4-12 = 5 parts per UUID, so memberId has 5 segments,
  // studioId has 5 segments, timestamp is 1, hmac is 1
  // But we join with ":" so we need to handle UUID colons.
  // Actually, UUIDs use hyphens not colons. So format is:
  // memberId:studioId:timestamp:hmac (4 colon-separated segments)
  if (parts.length !== 4) {
    return null;
  }

  return {
    memberId: parts[0],
    studioId: parts[1],
    timestamp: parts[2],
    hmac: parts[3],
  };
}

function verifyHmac(memberId: string, studioId: string, timestamp: string, hmac: string): boolean {
  const payload = `${memberId}:${studioId}:${timestamp}`;
  const expected = crypto
    .createHmac("sha256", getUnsubscribeSecret())
    .update(payload)
    .digest("hex");

  // Timing-safe comparison
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(hmac, "hex"));
  } catch {
    return false;
  }
}

/**
 * GET /api/unsubscribe/[token]
 * Validate HMAC token and return member info for confirmation page.
 * PUBLIC endpoint — no auth required.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const parsed = parseToken(token);
    if (!parsed) {
      return NextResponse.json(
        { error: "Invalid unsubscribe token" },
        { status: 400 }
      );
    }

    const { memberId, studioId, timestamp, hmac } = parsed;

    // Verify HMAC
    if (!verifyHmac(memberId, studioId, timestamp, hmac)) {
      return NextResponse.json(
        { error: "Invalid or tampered unsubscribe token" },
        { status: 403 }
      );
    }

    // Token is valid — fetch member info
    const supabase = await createServerClient();

    const { data: member, error: memberError } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("id", memberId)
      .eq("studio_id", studioId)
      .single();

    if (memberError || !member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Check current preference status
    const { data: preferences } = await supabase
      .from("email_preferences")
      .select("marketing_email, unsubscribed_at")
      .eq("member_id", memberId)
      .eq("studio_id", studioId)
      .maybeSingle();

    return NextResponse.json({
      data: {
        member_id: member.id,
        email: member.email,
        full_name: member.full_name,
        already_unsubscribed: preferences?.marketing_email === false,
        unsubscribed_at: preferences?.unsubscribed_at ?? null,
      },
    });
  } catch (err) {
    console.error("GET /api/unsubscribe/[token] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/unsubscribe/[token]
 * Process unsubscribe: set marketing_email=false, set unsubscribed_at.
 * Idempotent — returns success if already unsubscribed.
 * PUBLIC endpoint — no auth required.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const parsed = parseToken(token);
    if (!parsed) {
      return NextResponse.json(
        { error: "Invalid unsubscribe token" },
        { status: 400 }
      );
    }

    const { memberId, studioId, timestamp, hmac } = parsed;

    // Verify HMAC
    if (!verifyHmac(memberId, studioId, timestamp, hmac)) {
      return NextResponse.json(
        { error: "Invalid or tampered unsubscribe token" },
        { status: 403 }
      );
    }

    const supabase = await createServerClient();

    // Verify member exists
    const { data: member, error: memberError } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("id", memberId)
      .eq("studio_id", studioId)
      .single();

    if (memberError || !member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();

    // Check if preferences exist
    const { data: existing } = await supabase
      .from("email_preferences")
      .select("id, marketing_email, unsubscribed_at")
      .eq("member_id", memberId)
      .eq("studio_id", studioId)
      .maybeSingle();

    if (existing) {
      // Already unsubscribed — idempotent
      if (existing.marketing_email === false) {
        return NextResponse.json({
          data: {
            success: true,
            already_unsubscribed: true,
            unsubscribed_at: existing.unsubscribed_at,
          },
        });
      }

      // Update preferences
      await supabase
        .from("email_preferences")
        .update({
          marketing_email: false,
          unsubscribed_at: now,
          updated_at: now,
        })
        .eq("member_id", memberId)
        .eq("studio_id", studioId);
    } else {
      // Create preferences with marketing_email=false
      await supabase.from("email_preferences").insert({
        member_id: memberId,
        studio_id: studioId,
        marketing_email: false,
        transactional_email: true,
        booking_confirmations: true,
        booking_reminders: true,
        membership_updates: true,
        promotions: false,
        newsletter: false,
        community_updates: true,
        unsubscribed_at: now,
      });
    }

    // Log activity
    await supabase.from("activity_log").insert({
      studio_id: studioId,
      actor_id: memberId,
      action: "member_unsubscribed",
      entity_type: "email_preferences",
      entity_id: memberId,
      metadata: { email: member.email, method: "unsubscribe_link" },
    });

    return NextResponse.json({
      data: {
        success: true,
        already_unsubscribed: false,
        unsubscribed_at: now,
      },
    });
  } catch (err) {
    console.error("POST /api/unsubscribe/[token] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
