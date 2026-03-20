// ---------------------------------------------------------------------------
// SMS Abstraction Types — Provider-Agnostic
// ---------------------------------------------------------------------------
// Meridian stubs SMS for Phase 2. The provider will be decided later (Twilio,
// MessageBird, Vonage, etc.). This interface ensures all campaign and
// automation code programs against a stable contract.

export interface SMSOptions {
  to: string; // E.164 format, e.g. "+14155551234"
  body: string;
  from?: string; // override sender ID / number
  studio_id: string;
  metadata?: Record<string, string>; // passed through to provider for webhook correlation
}

export interface SMSResult {
  success: boolean;
  provider_message_id: string | null;
  error?: string;
  segments: number; // number of SMS segments the message was split into
}

export interface SMSMessage {
  to: string;
  body: string;
  from?: string;
  studio_id: string;
  metadata?: Record<string, string>;
}

export interface SMSBatchResult {
  total: number;
  sent: number;
  failed: number;
  results: SMSResult[];
}

export type SMSWebhookEventType =
  | 'delivered'
  | 'failed'
  | 'bounced'
  | 'opted_out'
  | 'replied';

export interface SMSWebhookResult {
  event: SMSWebhookEventType;
  provider_message_id: string;
  to: string;
  from: string | null;
  body: string | null; // populated for 'replied' events
  timestamp: string;
  metadata: Record<string, string> | null;
  raw: unknown; // raw provider payload for debugging
}

/**
 * Provider interface — every SMS provider adapter must implement this.
 */
export interface SMSProvider {
  readonly name: string;

  /** Send a single SMS message. */
  sendSMS(options: SMSOptions): Promise<SMSResult>;

  /** Send a batch of SMS messages. */
  sendBatch(messages: SMSMessage[]): Promise<SMSBatchResult>;

  /** Parse an incoming webhook from the provider into a normalized result. */
  handleWebhook(payload: unknown): Promise<SMSWebhookResult>;
}
