import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { translateToSQL, NLSearchResult } from "@/lib/anthropic";

const DEFAULT_STUDIO_ID = "11111111-1111-1111-1111-111111111111";

// ---------------------------------------------------------------------------
// Simple in-memory rate limiter: max 10 queries per minute per studio
// ---------------------------------------------------------------------------

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(studioId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(studioId);

  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(studioId, { count: 1, resetAt: now + 60_000 });
    return false;
  }

  if (entry.count >= 10) {
    return true;
  }

  entry.count += 1;
  return false;
}

// ---------------------------------------------------------------------------
// POST /api/ai/search
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const query: string | undefined = body.query;
    const studioId: string = body.studio_id || DEFAULT_STUDIO_ID;

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return NextResponse.json(
        { error: "A non-empty 'query' string is required." },
        { status: 400 }
      );
    }

    if (query.trim().length > 500) {
      return NextResponse.json(
        { error: "Query must be 500 characters or fewer." },
        { status: 400 }
      );
    }

    // Rate limiting
    if (isRateLimited(studioId)) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Maximum 10 queries per minute." },
        { status: 429 }
      );
    }

    // Translate natural language to SQL
    const translated = await translateToSQL({
      query: query.trim(),
      studio_id: studioId,
    });

    // If translation itself failed, return early with the error
    if (translated.error || !translated.sql) {
      const result: NLSearchResult = {
        sql: translated.sql,
        explanation: translated.explanation,
        result_type: translated.result_type,
        data: null,
        error: translated.error,
      };
      return NextResponse.json(result);
    }

    // Execute the SQL via Supabase RPC
    let data: Record<string, unknown>[] | null = null;
    let execError: string | null = null;

    try {
      const supabase = await createServerClient();
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "execute_readonly_sql",
        { query_text: translated.sql }
      );

      if (rpcError) {
        execError = rpcError.message;
      } else {
        data = rpcData as Record<string, unknown>[];
      }
    } catch (err) {
      execError =
        err instanceof Error ? err.message : "SQL execution failed.";
    }

    const result: NLSearchResult = {
      sql: translated.sql,
      explanation: translated.explanation,
      result_type: translated.result_type,
      data,
      error: execError,
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("POST /api/ai/search error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
