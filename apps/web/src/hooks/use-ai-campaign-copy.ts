"use client";

import { useState, useCallback } from "react";
import type {
  CampaignCopyRequest,
  CampaignCopyResult,
} from "@/lib/anthropic";

interface UseAICampaignCopyReturn {
  generate: (request: CampaignCopyRequest) => Promise<void>;
  result: CampaignCopyResult | null;
  isLoading: boolean;
  error: string | null;
  reset: () => void;
}

/**
 * React hook for generating AI-powered campaign copy.
 * Calls the /api/ai/campaign-copy endpoint and manages loading/error state.
 */
export function useAICampaignCopy(): UseAICampaignCopyReturn {
  const [result, setResult] = useState<CampaignCopyResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (request: CampaignCopyRequest) => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/ai/campaign-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.error ?? `Request failed with status ${response.status}`
        );
      }

      const data = await response.json();

      setResult({
        subject_line: data.subject_line,
        preview_text: data.preview_text,
        body_html: data.body_html,
        body_text: data.body_text,
        suggested_merge_tags: data.suggested_merge_tags,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to generate campaign copy";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return { generate, result, isLoading, error, reset };
}
