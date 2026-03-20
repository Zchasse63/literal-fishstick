/**
 * POST /api/webhooks/twilio
 *
 * Receives Twilio delivery status callbacks and inbound SMS webhooks.
 * Validates the Twilio request signature when TWILIO_AUTH_TOKEN is set.
 * Logs delivery status updates to console (extend to DB as needed).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSMSProvider } from '@/lib/sms';

export async function POST(request: NextRequest) {
  // ── Validate Twilio Signature ────────────────────────────────
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (authToken) {
    try {
      // Dynamic import to avoid bundling twilio in non-SMS builds
      const { validateRequest } = await import('twilio');

      const twilioSignature = request.headers.get('x-twilio-signature') ?? '';
      const url = request.url;
      const body = await request.clone().text();

      // Parse form-encoded body into params object
      const params: Record<string, string> = {};
      const searchParams = new URLSearchParams(body);
      searchParams.forEach((value, key) => {
        params[key] = value;
      });

      const isValid = validateRequest(authToken, twilioSignature, url, params);

      if (!isValid) {
        console.warn('[webhook:twilio] Invalid signature — rejecting request');
        return NextResponse.json(
          { error: 'Invalid Twilio signature' },
          { status: 403 },
        );
      }
    } catch (err) {
      console.error('[webhook:twilio] Signature validation error:', err);
      return NextResponse.json(
        { error: 'Signature validation failed' },
        { status: 500 },
      );
    }
  }

  // ── Parse Webhook Payload ────────────────────────────────────
  try {
    const contentType = request.headers.get('content-type') ?? '';
    let payload: Record<string, string>;

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await request.text();
      const searchParams = new URLSearchParams(text);
      payload = Object.fromEntries(searchParams.entries());
    } else {
      payload = await request.json();
    }

    // Use the SMS provider to normalize the webhook
    const provider = createSMSProvider();
    const result = await provider.handleWebhook(payload);

    console.log(
      `[webhook:twilio] ${result.event} — message=${result.provider_message_id} to=${result.to}`,
    );

    // Return 200 to acknowledge receipt (Twilio expects this)
    return NextResponse.json({ received: true, event: result.event });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[webhook:twilio] Failed to process webhook:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
