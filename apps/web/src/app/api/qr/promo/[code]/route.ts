import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import QRCode from "qrcode";

/**
 * GET /api/qr/promo/[code]
 * Generate a QR code PNG for a trainer's promo code.
 * The QR code encodes a join URL with the promo code.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
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
      .select("studio_id")
      .eq("id", user.id)
      .single();

    const studioId =
      profile?.studio_id ?? "11111111-1111-1111-1111-111111111111";

    // Verify the promo code exists
    const { data: promoCode, error: promoError } = await supabase
      .from("promo_codes")
      .select("id, code, trainer_id, active")
      .eq("code", code)
      .eq("studio_id", studioId)
      .single();

    if (promoError || !promoCode) {
      return NextResponse.json(
        { error: "Promo code not found" },
        { status: 404 }
      );
    }

    if (!promoCode.active) {
      return NextResponse.json(
        { error: "Promo code is no longer active" },
        { status: 400 }
      );
    }

    // Build the join URL
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "https://app.meridian.studio";
    const joinUrl = `${baseUrl}/join?promo=${encodeURIComponent(code)}`;

    // Generate QR code as PNG buffer
    const qrBuffer = await QRCode.toBuffer(joinUrl, {
      type: "png",
      width: 400,
      margin: 2,
      color: {
        dark: "#4F46E5", // Meridian indigo
        light: "#FAFAFA",
      },
      errorCorrectionLevel: "M",
    });

    return new NextResponse(new Uint8Array(qrBuffer), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `inline; filename="promo-${code}.png"`,
        "Cache-Control": "public, max-age=3600", // promo QRs can be cached
      },
    });
  } catch (err) {
    console.error("GET /api/qr/promo/[code] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
