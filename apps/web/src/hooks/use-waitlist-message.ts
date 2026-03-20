"use client";

import { useState, useCallback } from "react";
import type {
  WaitlistMessageResult,
  WaitlistMessageType,
} from "@/lib/ai/waitlist-messaging";

interface UseWaitlistMessageReturn {
  generate: (
    bookingId: string,
    messageType: WaitlistMessageType
  ) => Promise<void>;
  send: (
    bookingId: string,
    messageType: WaitlistMessageType
  ) => Promise<void>;
  result: WaitlistMessageResult | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * React hook for generating and sending AI-powered waitlist messages.
 *
 * - `generate(bookingId, messageType)` previews the message without sending.
 * - `send(bookingId, messageType)` generates and sends the email in one call.
 */
export function useWaitlistMessage(): UseWaitlistMessageReturn {
  const [result, setResult] = useState<WaitlistMessageResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callEndpoint = useCallback(
    async (
      bookingId: string,
      messageType: WaitlistMessageType,
      shouldSend: boolean
    ) => {
      setIsLoading(true);
      setError(null);
      setResult(null);

      try {
        const response = await fetch("/api/ai/waitlist-message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            booking_id: bookingId,
            message_type: messageType,
            send: shouldSend,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(
            errorData?.error ?? `Request failed with status ${response.status}`
          );
        }

        const data = await response.json();

        setResult({
          subject: data.subject,
          body_html: data.body_html,
          body_text: data.body_text,
          personalization_notes: data.personalization_notes,
        });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Failed to generate waitlist message";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const generate = useCallback(
    async (bookingId: string, messageType: WaitlistMessageType) => {
      await callEndpoint(bookingId, messageType, false);
    },
    [callEndpoint]
  );

  const send = useCallback(
    async (bookingId: string, messageType: WaitlistMessageType) => {
      await callEndpoint(bookingId, messageType, true);
    },
    [callEndpoint]
  );

  return { generate, send, result, isLoading, error };
}
