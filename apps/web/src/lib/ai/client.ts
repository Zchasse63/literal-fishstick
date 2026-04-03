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
