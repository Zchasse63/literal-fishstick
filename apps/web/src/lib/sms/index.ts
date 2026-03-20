export type {
  SMSProvider,
  SMSOptions,
  SMSResult,
  SMSMessage,
  SMSBatchResult,
  SMSWebhookResult,
  SMSWebhookEventType,
} from './types';

import type {
  SMSProvider,
  SMSOptions,
  SMSResult,
  SMSMessage,
  SMSBatchResult,
  SMSWebhookResult,
} from './types';

// ---------------------------------------------------------------------------
// Stub Provider — logs to console, returns mock successes
// ---------------------------------------------------------------------------
// Used until a real SMS provider is selected. All campaign and automation
// code can call sendSMS / sendBatch without changes when a real provider
// is swapped in.

class StubProvider implements SMSProvider {
  readonly name = 'stub';

  async sendSMS(options: SMSOptions): Promise<SMSResult> {
    const id = `stub_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    console.log(
      `[SMS:stub] sendSMS to=${options.to} studio=${options.studio_id} body="${options.body.slice(0, 80)}${options.body.length > 80 ? '...' : ''}"`,
    );
    return {
      success: true,
      provider_message_id: id,
      segments: Math.ceil(options.body.length / 160),
    };
  }

  async sendBatch(messages: SMSMessage[]): Promise<SMSBatchResult> {
    console.log(`[SMS:stub] sendBatch count=${messages.length}`);
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
    }
    const sent = results.filter((r) => r.success).length;
    return {
      total: messages.length,
      sent,
      failed: messages.length - sent,
      results,
    };
  }

  async handleWebhook(_payload: unknown): Promise<SMSWebhookResult> {
    console.log('[SMS:stub] handleWebhook called — no-op in stub mode');
    return {
      event: 'delivered',
      provider_message_id: 'stub_webhook',
      to: '',
      from: null,
      body: null,
      timestamp: new Date().toISOString(),
      metadata: null,
      raw: _payload,
    };
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
// Reads SMS_PROVIDER env var to determine which adapter to instantiate.
// For now only 'stub' is implemented. When a real provider is added, import
// its class here and add a case.

export function createSMSProvider(): SMSProvider {
  const provider = process.env.SMS_PROVIDER ?? 'stub';

  switch (provider) {
    case 'stub':
      return new StubProvider();
    case 'twilio': {
      // Dynamic import to avoid loading Twilio SDK when not needed
      const { TwilioProvider } = require('./providers/twilio') as {
        TwilioProvider: new () => SMSProvider;
      };
      return new TwilioProvider();
    }
    // Future providers:
    // case 'messagebird':
    //   return new MessageBirdProvider();
    default:
      console.warn(
        `[SMS] Unknown SMS_PROVIDER "${provider}", falling back to stub`,
      );
      return new StubProvider();
  }
}

// Convenience: default singleton instance
export const sms = createSMSProvider();
