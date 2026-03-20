/**
 * Twilio SMS Provider for Meridian
 *
 * Implements the SMSProvider interface using the Twilio REST API.
 * Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER
 * environment variables.
 */
import twilio from 'twilio';
import type {
  SMSProvider,
  SMSOptions,
  SMSResult,
  SMSMessage,
  SMSBatchResult,
  SMSWebhookResult,
  SMSWebhookEventType,
} from '../types';

export class TwilioProvider implements SMSProvider {
  readonly name = 'twilio';

  private client: ReturnType<typeof twilio>;
  private fromNumber: string;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !phoneNumber) {
      throw new Error(
        'Missing required Twilio environment variables: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER',
      );
    }

    this.client = twilio(accountSid, authToken);
    this.fromNumber = phoneNumber;
  }

  async sendSMS(options: SMSOptions): Promise<SMSResult> {
    try {
      const message = await this.client.messages.create({
        to: options.to,
        from: options.from ?? this.fromNumber,
        body: options.body,
        statusCallback: process.env.TWILIO_STATUS_CALLBACK_URL ?? undefined,
      });

      return {
        success: true,
        provider_message_id: message.sid,
        segments: message.numSegments ? parseInt(message.numSegments, 10) : 1,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown Twilio error';
      console.error(`[SMS:twilio] Failed to send to ${options.to}:`, errorMessage);
      return {
        success: false,
        provider_message_id: null,
        error: errorMessage,
        segments: 0,
      };
    }
  }

  async sendBatch(messages: SMSMessage[]): Promise<SMSBatchResult> {
    const results: SMSResult[] = [];

    for (const msg of messages) {
      const result = await this.sendSMS({
        to: msg.to,
        body: msg.body,
        from: msg.from,
        studio_id: msg.studio_id,
        metadata: msg.metadata,
      });
      results.push(result);

      // Small delay between messages to avoid rate limits
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const sent = results.filter((r) => r.success).length;
    return {
      total: messages.length,
      sent,
      failed: messages.length - sent,
      results,
    };
  }

  async handleWebhook(payload: unknown): Promise<SMSWebhookResult> {
    const data = payload as Record<string, string>;

    const statusMap: Record<string, SMSWebhookEventType> = {
      delivered: 'delivered',
      undelivered: 'failed',
      failed: 'failed',
      sent: 'delivered',
      received: 'replied',
    };

    const twilioStatus = (data.MessageStatus ?? data.SmsStatus ?? '').toLowerCase();
    const event: SMSWebhookEventType = statusMap[twilioStatus] ?? 'delivered';

    // Check for opt-out keywords (Twilio Advanced Opt-Out)
    const body = data.Body ?? '';
    const optOutKeywords = ['stop', 'unsubscribe', 'cancel', 'end', 'quit'];
    const isOptOut = optOutKeywords.includes(body.trim().toLowerCase());

    return {
      event: isOptOut ? 'opted_out' : event,
      provider_message_id: data.MessageSid ?? data.SmsSid ?? '',
      to: data.To ?? '',
      from: data.From ?? null,
      body: data.Body ?? null,
      timestamp: new Date().toISOString(),
      metadata: null,
      raw: payload,
    };
  }
}
