"use client";

import { useState, useCallback, useRef } from "react";
import type { NLSearchResult } from "@/lib/anthropic";
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

const DEBOUNCE_MS = 300;
const MAX_HISTORY = 5;

export interface SearchHistoryEntry {
  query: string;
  timestamp: number;
  result_type: NLSearchResult["result_type"];
}

export function useAISearch() {
  const [results, setResults] = useState<Record<string, unknown>[] | null>(
    null
  );
  const [sql, setSql] = useState<string>("");
  const [explanation, setExplanation] = useState<string>("");
  const [resultType, setResultType] =
    useState<NLSearchResult["result_type"]>("other");
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<SearchHistoryEntry[]>([]);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const executeSearch = useCallback(
    async (query: string, studioId: string = DEFAULT_STUDIO_ID) => {
      // Cancel any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsSearching(true);
      setError(null);

      try {
        const response = await fetch("/api/ai/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, studio_id: studioId }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          throw new Error(
            errBody.error || `Request failed with status ${response.status}`
          );
        }

        const data: NLSearchResult = await response.json();

        if (data.error) {
          setError(data.error);
        }

        setSql(data.sql ?? "");
        setExplanation(data.explanation ?? "");
        setResultType(data.result_type ?? "other");
        setResults(data.data ?? null);

        // Add to history (most recent first, capped at MAX_HISTORY)
        setHistory((prev) => {
          const entry: SearchHistoryEntry = {
            query,
            timestamp: Date.now(),
            result_type: data.result_type ?? "other",
          };
          const updated = [entry, ...prev.filter((h) => h.query !== query)];
          return updated.slice(0, MAX_HISTORY);
        });
      } catch (err) {
        // Ignore aborted requests
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        const message =
          err instanceof Error ? err.message : "Search failed.";
        setError(message);
        setResults(null);
        setSql("");
        setExplanation("");
        setResultType("other");
      } finally {
        setIsSearching(false);
      }
    },
    []
  );

  const search = useCallback(
    (query: string, studioId?: string) => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      if (!query.trim()) {
        setResults(null);
        setSql("");
        setExplanation("");
        setResultType("other");
        setError(null);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);

      debounceTimer.current = setTimeout(() => {
        executeSearch(query.trim(), studioId);
      }, DEBOUNCE_MS);
    },
    [executeSearch]
  );

  const clearResults = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    setResults(null);
    setSql("");
    setExplanation("");
    setResultType("other");
    setError(null);
    setIsSearching(false);
  }, []);

  return {
    search,
    results,
    sql,
    explanation,
    resultType,
    isSearching,
    error,
    history,
    clearResults,
  };
}
