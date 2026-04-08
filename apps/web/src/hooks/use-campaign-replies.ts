"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import type { ReplyDraftResult } from "@/lib/ai/auto-reply";
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CampaignReply {
  id: string;
  studio_id: string;
  send_log_id: string;
  member_id: string | null;
  from_email: string;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  received_at: string;
  ai_draft_reply: string | null;
  ai_draft_generated_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  sent_reply_at: string | null;
  status: string;
}

export interface UseCampaignRepliesReturn {
  replies: CampaignReply[];
  pendingCount: number;
  isLoading: boolean;
  error: string | null;
  generateDraft: (replyId: string) => Promise<ReplyDraftResult | null>;
  approveDraft: (
    replyId: string,
    editedReply?: string
  ) => Promise<boolean>;
  dismissReply: (replyId: string) => Promise<boolean>;
  refresh: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STUDIO_ID = DEFAULT_STUDIO_ID;
const POLL_INTERVAL = 60_000; // 60 seconds

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * React hook for managing campaign reply drafts and approvals.
 * Fetches non-dismissed replies, provides draft generation, approval, and dismissal.
 */
export function useCampaignReplies(): UseCampaignRepliesReturn {
  const supabase = createBrowserClient();
  const [replies, setReplies] = useState<CampaignReply[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  // Fetch all non-dismissed replies
  // TODO: The campaign_replies table does not exist yet. Once it is created
  // via a migration, remove the early return below and uncomment the query.
  const fetchReplies = useCallback(async () => {
    // Gracefully return empty until campaign_replies table is created
    if (mountedRef.current) {
      setReplies([]);
      setIsLoading(false);
    }
    return;

    /*
    try {
      const { data, error: queryError } = await supabase
        .from("campaign_replies")
        .select("*")
        .eq("studio_id", STUDIO_ID)
        .neq("status", "dismissed")
        .order("received_at", { ascending: false });

      if (queryError) throw queryError;

      if (mountedRef.current) {
        setReplies((data as CampaignReply[]) ?? []);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        const message =
          err instanceof Error ? err.message : "Failed to fetch replies";
        setError(message);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
    */
  }, [supabase]);

  // Initial fetch + polling
  useEffect(() => {
    mountedRef.current = true;
    fetchReplies();

    const timer = setInterval(fetchReplies, POLL_INTERVAL);

    return () => {
      mountedRef.current = false;
      clearInterval(timer);
    };
  }, [fetchReplies]);

  // Generate a draft for a specific reply
  const generateDraft = useCallback(
    async (replyId: string): Promise<ReplyDraftResult | null> => {
      try {
        const response = await fetch("/api/ai/auto-reply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reply_id: replyId }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(
            errorData?.error ?? `Request failed with status ${response.status}`
          );
        }

        const data = await response.json();

        // Refresh the replies list to pick up the updated record
        await fetchReplies();

        return {
          draft_reply: data.draft_reply,
          tone_analysis: data.tone_analysis,
          suggested_subject: data.suggested_subject,
          requires_human_review: data.requires_human_review,
          confidence: data.confidence,
        };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to generate draft";
        if (mountedRef.current) {
          setError(message);
        }
        return null;
      }
    },
    [fetchReplies]
  );

  // Approve (and optionally edit) a draft, then send it
  const approveDraft = useCallback(
    async (replyId: string, editedReply?: string): Promise<boolean> => {
      try {
        const response = await fetch("/api/ai/auto-reply", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reply_id: replyId,
            edited_reply: editedReply,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(
            errorData?.error ?? `Request failed with status ${response.status}`
          );
        }

        // Refresh the replies list to pick up the updated status
        await fetchReplies();

        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to approve draft";
        if (mountedRef.current) {
          setError(message);
        }
        return false;
      }
    },
    [fetchReplies]
  );

  // Dismiss a reply (update status directly via Supabase)
  // TODO: The campaign_replies table does not exist yet. Once created,
  // uncomment the Supabase query below and remove the early return.
  const dismissReply = useCallback(
    async (replyId: string): Promise<boolean> => {
      // Gracefully no-op until campaign_replies table is created
      if (mountedRef.current) {
        setReplies((prev) => prev.filter((r) => r.id !== replyId));
      }
      return true;

      /*
      try {
        const { error: updateError } = await supabase
          .from("campaign_replies")
          .update({ status: "dismissed" })
          .eq("id", replyId)
          .eq("studio_id", STUDIO_ID);

        if (updateError) throw updateError;

        // Optimistically remove from local state
        if (mountedRef.current) {
          setReplies((prev) => prev.filter((r) => r.id !== replyId));
        }

        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to dismiss reply";
        if (mountedRef.current) {
          setError(message);
        }
        return false;
      }
      */
    },
    [supabase]
  );

  // Compute pending count (replies that haven't been drafted or sent yet)
  const pendingCount = replies.filter(
    (r) => r.status === "received" || r.status === "pending"
  ).length;

  return {
    replies,
    pendingCount,
    isLoading,
    error,
    generateDraft,
    approveDraft,
    dismissReply,
    refresh: fetchReplies,
  };
}
