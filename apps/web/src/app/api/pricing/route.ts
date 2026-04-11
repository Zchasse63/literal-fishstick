import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";

/**
 * GET /api/pricing
 * Calculate price breakdown for a booking with optional discount/promo.
 *
 * Query params:
 *   class_id  — Meridian class UUID (required)
 *   member_id — Meridian member UUID (required)
 *   discount_id — Glofox discount _id (optional, mutually exclusive with promo_code)
 *   promo_code  — Promo code string (optional, mutually exclusive with discount_id)
 */
export async function GET(request: NextRequest) {
  const auth = await requireRole(["owner", "manager"]);
  if (auth.error) return auth.error;
  const { supabase, studioId } = auth;

  const { searchParams } = request.nextUrl;
  const classId = searchParams.get("class_id");
  const memberId = searchParams.get("member_id");
  const discountId = searchParams.get("discount_id");
  const promoCode = searchParams.get("promo_code");

  if (!classId || !memberId) {
    return NextResponse.json(
      { error: "class_id and member_id are required" },
      { status: 400 },
    );
  }

  // Enforce mutual exclusivity: discount_id and promo_code cannot both be set
  if (discountId && promoCode) {
    return NextResponse.json(
      { error: "discount_id and promo_code are mutually exclusive — provide one or neither" },
      { status: 400 },
    );
  }

  // Fetch class with membership plan pricing
  const { data: classData, error: classError } = await supabase
    .from("classes")
    .select("id, title, studio_id, class_type_id, class_types(name, default_price)")
    .eq("id", classId)
    .eq("studio_id", studioId)
    .single();

  if (classError || !classData) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  // Fetch member to check membership status (for member discounts).
  // `members` has no membership_plan_id column; member_discount_active is
  // the denormalized flag that drives the 10% discount.
  const { data: member } = await supabase
    .from("members")
    .select("id, membership_status, member_discount_active")
    .eq("id", memberId)
    .eq("studio_id", studioId)
    .single();

  if (!member) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  // Get studio tax configuration
  const { data: taxConfig } = await supabase
    .from("tax_configurations")
    .select("rate, name")
    .eq("studio_id", studioId)
    .eq("is_default", true)
    .eq("active", true)
    .maybeSingle();

  const taxRate = taxConfig?.rate ?? 0;

  // Get base price from class type
  // Supabase returns the FK relation; may be object or array depending on cardinality
  const classTypeRaw = classData.class_types as unknown;
  const classType = Array.isArray(classTypeRaw)
    ? (classTypeRaw[0] as { name: string; default_price: number } | undefined)
    : (classTypeRaw as { name: string; default_price: number } | null);
  const basePrice = classType?.default_price ?? 0; // In cents

  // Calculate discount
  let discountAmount = 0;
  let discountName: string | null = null;

  if (discountId) {
    // Look up the discount from our synced discounts table (if exists)
    const { data: discount } = await supabase
      .from("discounts")
      .select("name, rate_type, rate_value")
      .eq("glofox_id", discountId)
      .eq("studio_id", studioId)
      .maybeSingle();

    if (discount) {
      discountName = discount.name;
      if (discount.rate_type === "percentage") {
        discountAmount = Math.round(basePrice * (discount.rate_value / 100));
      } else {
        // Fixed amount (stored in dollars, convert to cents)
        discountAmount = Math.round(discount.rate_value * 100);
      }
    }
  } else if (promoCode) {
    // Validate promo code against the promo_codes table. This is the
    // canonical source: it holds discount_type + discount_value and may
    // optionally be tied to a trainer for attribution.
    const { data: promo } = await supabase
      .from("promo_codes")
      .select("id, code, discount_type, discount_value, active")
      .eq("code", promoCode.toUpperCase())
      .eq("studio_id", studioId)
      .eq("active", true)
      .maybeSingle();

    if (promo && promo.discount_value != null) {
      if (promo.discount_type === "percent") {
        discountAmount = Math.round(basePrice * (Number(promo.discount_value) / 100));
      } else if (promo.discount_type === "fixed") {
        // discount_value for fixed is in dollars — convert to cents
        discountAmount = Math.round(Number(promo.discount_value) * 100);
      }
      discountName = `Promo: ${promoCode.toUpperCase()}`;
    }
  }

  // Apply 10% member discount on top if active recurring member.
  // member_discount_active is the denormalized flag set by the subscription
  // manager — no need to check plan id separately.
  let memberDiscountAmount = 0;
  if (member.membership_status === "active" && member.member_discount_active) {
    memberDiscountAmount = Math.round((basePrice - discountAmount) * 0.10);
  }

  const subtotal = basePrice;
  const totalDiscount = discountAmount + memberDiscountAmount;
  const afterDiscount = Math.max(0, subtotal - totalDiscount);
  const taxAmount = Math.round(afterDiscount * Number(taxRate));
  const total = afterDiscount + taxAmount;

  return NextResponse.json({
    data: {
      class_id: classId,
      member_id: memberId,
      subtotal,
      discount_amount: totalDiscount,
      discount_name: discountName,
      member_discount_applied: memberDiscountAmount > 0,
      member_discount_amount: memberDiscountAmount,
      tax_rate: Number(taxRate),
      tax_name: taxConfig?.name ?? null,
      tax_amount: taxAmount,
      total,
      currency: "usd",
    },
  });
}
