/**
 * Shared Anthropic client — singleton instance for all AI modules.
 *
 * Every AI feature (briefings, churn prediction, health scores, booking patterns,
 * campaign copy, etc.) should import `getAnthropicClient` from here instead of
 * instantiating `new Anthropic()` inline.
 */
import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

/**
 * Return a lazily-initialised Anthropic client, or `null` when the API key
 * is not configured (callers should fall back to rules-based logic).
 */
export function getAnthropicClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) {
    return null;
  }

  if (!_client) {
    _client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: 30_000, // 30s timeout for all API calls
    });
  }

  return _client;
}

/**
 * The model identifier used across all Meridian AI features.
 * Centralised here so a model upgrade only requires a one-line change.
 */
export const AI_MODEL = "claude-sonnet-4-6" as const;

/**
 * Extract the text content from an Anthropic message response.
 *
 * Returns an empty string if the first content block is not text.
 */
export function extractText(message: Anthropic.Message): string {
  return message.content[0]?.type === "text" ? message.content[0].text : "";
}

/**
 * Parse a JSON response from Claude, stripping markdown fences if present.
 *
 * Returns the parsed object or throws if the response is not valid JSON.
 */
export function parseAIJson<T>(text: string): T {
  const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  return JSON.parse(cleaned) as T;
}

// ---------------------------------------------------------------------------
// Retry wrapper for Anthropic API calls
// ---------------------------------------------------------------------------

const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1000;
const RETRYABLE_STATUS_CODES = [429, 529];

/**
 * Check if an error is a retryable Anthropic API error (429 rate-limited
 * or 529 overloaded).
 */
function isRetryableError(err: unknown): boolean {
  if (err && typeof err === "object") {
    // The Anthropic SDK throws APIError instances with a `status` property
    const status = (err as { status?: number }).status;
    if (status && RETRYABLE_STATUS_CODES.includes(status)) {
      return true;
    }
    // Also check for error message patterns as a fallback
    const message = (err as { message?: string }).message ?? "";
    if (message.includes("rate_limit") || message.includes("overloaded")) {
      return true;
    }
  }
  return false;
}

/**
 * Execute an Anthropic API call with automatic retry on 429/529 errors.
 *
 * Uses exponential backoff: 1s, 2s, 4s (by default).
 *
 * Usage:
 * ```ts
 * const message = await withRetry(() =>
 *   anthropic.messages.create({ model: AI_MODEL, ... })
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = RETRY_MAX_ATTEMPTS
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (!isRetryableError(err) || attempt >= maxAttempts - 1) {
        throw err;
      }

      const delayMs = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
      console.warn(
        `[Anthropic] Retryable error (attempt ${attempt + 1}/${maxAttempts}), retrying in ${delayMs}ms...`,
        (err as { status?: number }).status ?? (err as { message?: string }).message
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  // Should not reach here, but satisfy TypeScript
  throw lastError;
}
