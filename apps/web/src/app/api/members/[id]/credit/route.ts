import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_STUDIO_ID } from '@/lib/constants'
import { rateLimit } from '@/lib/rate-limit'

/**
 * POST /api/members/[id]/credit
 *
 * Issue a wallet credit to a member. Admin only.
 * Body: { amount: number, reason: string, reference_id?: string }
 *
 * The `amount` is in DOLLARS (e.g. 25.50). Internally the wallet_transactions
 * and members.wallet_balance columns store cents as integers — the route
 * converts at the boundary.
 *
 * This does NOT touch Stripe — wallet credits are an internal ledger that
 * can be redeemed against future purchases. Creates a row in
 * `wallet_transactions` with a positive amount and bumps the denormalized
 * `members.wallet_balance`.
 *
 * For negative adjustments (debits), pass a negative amount. The route
 * enforces non-zero values and caps debits at current balance so wallets
 * can't go negative.
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: authProfile } = await supabase
      .from("profiles")
      .select("studio_id, roles")
      .eq("id", user.id)
      .single();

    const studioId = authProfile?.studio_id ?? DEFAULT_STUDIO_ID;

    // Role check — owner/manager only
    const roles: string[] = authProfile?.roles ?? [];
    if (!roles.some((r: string) => ["owner", "manager"].includes(r))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Rate limit: 30 credit adjustments per minute per user. Wallet credits
    // are free to issue but a compromised account could mass-credit and then
    // drain via bookings.
    const rl = await rateLimit(`stripe-credit:${user.id}`, 30, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again in a minute." },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { amount, reason, reference_id } = body as {
      amount?: number;
      reason?: string;
      reference_id?: string;
    };

    if (typeof amount !== "number" || !Number.isFinite(amount) || amount === 0) {
      return NextResponse.json(
        { error: "amount must be a non-zero number (in dollars)" },
        { status: 400 }
      );
    }

    if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
      return NextResponse.json(
        { error: "reason is required" },
        { status: 400 }
      );
    }

    // Convert dollar amount → integer cents. Round to avoid floating-point
    // drift (e.g. 25.5 * 100 = 2550 not 2549.9999).
    const amountCents = Math.round(amount * 100);

    // Fetch member — match by profile_id (consistent with other member routes)
    const { data: member, error: memberError } = await supabase
      .from("members")
      .select("id, profile_id, wallet_balance")
      .eq("profile_id", memberId)
      .eq("studio_id", studioId)
      .maybeSingle();

    if (memberError || !member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const currentBalanceCents = Number(member.wallet_balance ?? 0);

    // Guard against debits that would overdraw the wallet
    if (amountCents < 0 && Math.abs(amountCents) > currentBalanceCents) {
      return NextResponse.json(
        {
          error: `Debit amount ($${Math.abs(amount)}) exceeds current wallet balance ($${currentBalanceCents / 100})`,
        },
        { status: 409 }
      );
    }

    const newBalanceCents = currentBalanceCents + amountCents;

    // ─── Insert wallet_transactions row ──────────────────────
    // wallet_transactions.type CHECK allows:
    //   gift_card_redemption, purchase, refund, adjustment, gift_card_purchase
    // Admin-issued credits/debits map to 'adjustment' (the sign of amount
    // distinguishes them). Description records the human-readable reason.
    const { data: walletTx, error: insertError } = await supabase
      .from("wallet_transactions")
      .insert({
        member_id: member.id,
        studio_id: studioId,
        amount: amountCents,
        type: "adjustment",
        description: reason.trim(),
        reference_id: reference_id ?? null,
        balance_after: newBalanceCents,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // ─── Update denormalized balance on members row ──────────
    const { error: balanceError } = await supabase
      .from("members")
      .update({
        wallet_balance: newBalanceCents,
        updated_at: new Date().toISOString(),
      })
      .eq("id", member.id)
      .eq("studio_id", studioId);

    if (balanceError) {
      console.error(
        "POST /api/members/[id]/credit: wallet_balance update failed",
        balanceError.message
      );
    }

    // ─── Activity log ────────────────────────────────────────
    const { error: activityError } = await supabase.from("activity_log").insert({
      studio_id: studioId,
      actor_id: user.id,
      type: amountCents > 0 ? "credit_issued" : "credit_debited",
      subject_type: "profile",
      subject_id: memberId,
      description:
        amountCents > 0
          ? `Wallet credit of $${amount} issued: ${reason}`
          : `Wallet debit of $${Math.abs(amount)} applied: ${reason}`,
      metadata: {
        amount_cents: amountCents,
        balance_before_cents: currentBalanceCents,
        balance_after_cents: newBalanceCents,
        reason,
        reference_id: reference_id ?? null,
        wallet_transaction_id: walletTx.id,
      },
    });

    if (activityError) {
      console.error(
        "POST /api/members/[id]/credit: activity_log insert failed:",
        activityError.message
      );
    }

    // Return dollars (client-friendly) alongside the raw row which has cents.
    return NextResponse.json({
      data: {
        wallet_transaction: walletTx,
        member_id: memberId,
        amount,
        amount_cents: amountCents,
        balance_before: currentBalanceCents / 100,
        balance_after: newBalanceCents / 100,
      },
    });
  } catch (err) {
    console.error("POST /api/members/[id]/credit error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
