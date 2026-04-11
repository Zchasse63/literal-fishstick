import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_STUDIO_ID } from '@/lib/constants'
import { refundPayment, isStripeConfigured } from '@/lib/stripe'
import { rateLimit } from '@/lib/rate-limit'

/**
 * POST /api/transactions/[id]/refund
 *
 * Refund a transaction via Stripe. Admin only.
 * Body: { amount?: number, reason?: 'duplicate'|'fraudulent'|'requested_by_customer', note?: string }
 *
 * - `amount` is in dollars. When omitted, the full transaction amount is refunded.
 * - Creates a new `transactions` row with type='refund' and negative amount
 *   so the revenue module totals reconcile.
 * - When STRIPE_SECRET_KEY is not set, uses dry-run mode (no real API call,
 *   but the DB refund row is still written — useful for dev/test).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient();
    const { id: transactionId } = await params;

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

    // Rate limit: 20 refunds per minute per user. Bulk refund abuse is a
    // real attack vector since refunds trigger real Stripe mutations.
    const rl = await rateLimit(`stripe-refund:${user.id}`, 20, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again in a minute." },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { amount, reason, note = null } = body as {
      amount?: number;
      reason?: "duplicate" | "fraudulent" | "requested_by_customer";
      note?: string | null;
    };

    if (amount !== undefined && (typeof amount !== "number" || amount <= 0)) {
      return NextResponse.json(
        { error: "amount must be a positive number in dollars" },
        { status: 400 }
      );
    }

    // Fetch the original transaction
    const { data: original, error: txError } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .eq("studio_id", studioId)
      .maybeSingle();

    if (txError || !original) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    if (original.type === "refund" || (original.amount ?? 0) < 0) {
      return NextResponse.json(
        { error: "Cannot refund a refund transaction" },
        { status: 409 }
      );
    }

    if (original.status !== "completed") {
      return NextResponse.json(
        { error: `Cannot refund a transaction with status "${original.status}"` },
        { status: 409 }
      );
    }

    // Determine refund amount — default to full original
    const fullAmount = Number(original.amount ?? 0);
    const refundDollars = amount ?? fullAmount;

    if (refundDollars > fullAmount) {
      return NextResponse.json(
        {
          error: `Refund amount ($${refundDollars}) exceeds original transaction amount ($${fullAmount})`,
        },
        { status: 400 }
      );
    }

    // Check existing refunds so partials don't overshoot the original
    const { data: existingRefunds } = await supabase
      .from("transactions")
      .select("amount")
      .eq("studio_id", studioId)
      .eq("reference_id", transactionId)
      .eq("type", "refund");

    const alreadyRefunded = (existingRefunds ?? []).reduce(
      (sum, t) => sum + Math.abs(Number(t.amount ?? 0)),
      0
    );

    if (alreadyRefunded + refundDollars > fullAmount) {
      const available = Math.max(0, fullAmount - alreadyRefunded);
      return NextResponse.json(
        {
          error: `Refund amount exceeds available balance. Already refunded: $${alreadyRefunded}, available: $${available}`,
        },
        { status: 409 }
      );
    }

    // ─── Stripe Refund ───────────────────────────────────────
    let stripeResult: { id: string; dry_run: boolean; error: string | null } = {
      id: "",
      dry_run: !isStripeConfigured(),
      error: null,
    };

    if (original.stripe_payment_intent_id) {
      const result = await refundPayment(
        original.stripe_payment_intent_id,
        Math.round(refundDollars * 100),
        reason
      );
      stripeResult = {
        id: result.id,
        dry_run: result.dry_run,
        error: result.error,
      };

      if (result.error) {
        return NextResponse.json(
          { error: `Stripe refund failed: ${result.error}` },
          { status: 502 }
        );
      }
    }

    // ─── Create Refund Transaction Row ───────────────────────
    const nowIso = new Date().toISOString();
    const { data: refundTx, error: insertError } = await supabase
      .from("transactions")
      .insert({
        studio_id: studioId,
        member_id: original.member_id,
        type: "refund",
        amount: -Math.abs(refundDollars),
        currency: original.currency ?? "usd",
        status: "completed",
        description: note
          ? `Refund: ${note}`
          : `Refund for transaction ${transactionId}`,
        stripe_payment_intent_id: original.stripe_payment_intent_id,
        payment_method: original.payment_method,
        reference_id: transactionId,
        created_at: nowIso,
        sold_by_profile_id: user.id,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // ─── Activity Log ────────────────────────────────────────
    await supabase.from("activity_log").insert({
      studio_id: studioId,
      actor_id: user.id,
      type: "refund_issued",
      subject_type: "transaction",
      subject_id: transactionId,
      description: `Refund of $${refundDollars} issued (reason: ${reason ?? "requested_by_customer"})`,
      metadata: {
        original_transaction_id: transactionId,
        refund_transaction_id: refundTx.id,
        amount: refundDollars,
        reason: reason ?? "requested_by_customer",
        note,
        stripe_refund_id: stripeResult.id,
        stripe_dry_run: stripeResult.dry_run,
      },
    });

    return NextResponse.json({
      data: {
        refund_transaction: refundTx,
        original_transaction_id: transactionId,
        amount_refunded: refundDollars,
        total_refunded: alreadyRefunded + refundDollars,
        remaining_refundable: Math.max(
          0,
          fullAmount - alreadyRefunded - refundDollars
        ),
        stripe: {
          refund_id: stripeResult.id,
          dry_run: stripeResult.dry_run,
          error: stripeResult.error,
        },
      },
    });
  } catch (err) {
    console.error("POST /api/transactions/[id]/refund error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
