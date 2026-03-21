import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import QRCode from "qrcode";
import crypto from "crypto";

/**
 * GET /api/qr/member/[id]
 * Generate a QR code PNG for member check-in.
 * The QR code encodes a check-in URL with a short-lived token.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: memberId } = await params;
    const supabase = await createServerClient();

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

    const { data: profile } = await supabase
      .from("profiles")
      .select("studio_id, roles")
      .eq("id", user.id)
      .single();

    const studioId =
      profile?.studio_id ?? "11111111-1111-1111-1111-111111111111";

    // Role check
    const roles: string[] = profile?.roles ?? [];
    if (!roles.some((r: string) => ["owner", "manager"].includes(r))) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    // Verify the member exists
    const { data: member, error: memberError } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("id", memberId)
      .eq("studio_id", studioId)
      .single();

    if (memberError || !member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Generate a short-lived token (24-hour validity)
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Store the token
    const { error: tokenError } = await supabase
      .from("check_in_tokens")
      .insert({
        studio_id: studioId,
        member_id: memberId,
        token,
        expires_at: expiresAt,
      });

    if (tokenError) {
      console.error("Failed to store check-in token:", tokenError);
      return NextResponse.json(
        { error: "Failed to generate check-in code" },
        { status: 500 }
      );
    }

    // Build the check-in URL
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "https://app.meridian.studio";
    const checkInUrl = `${baseUrl}/check-in/${memberId}?token=${token}`;

    // Generate QR code as PNG buffer
    const qrBuffer = await QRCode.toBuffer(checkInUrl, {
      type: "png",
      width: 400,
      margin: 2,
      color: {
        dark: "#0F0F11",
        light: "#FAFAFA",
      },
      errorCorrectionLevel: "M",
    });

    return new NextResponse(new Uint8Array(qrBuffer), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `inline; filename="checkin-${memberId}.png"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err) {
    console.error("GET /api/qr/member/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
