import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { translateToSQL, NLSearchResult } from "@/lib/ai/nl-search";
import { requireRole } from "@/lib/auth/require-role";
import { rateLimit } from "@/lib/rate-limit";

// ---------------------------------------------------------------------------
// POST /api/ai/search
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // Auth + role check
    const auth = await requireRole(["owner", "manager"]);
    if (auth.error) return auth.error;
    const { user, studioId } = auth;

    // Rate limit: 20 requests per minute per user
    const rl = await rateLimit(`ai:${user.id}`, 20, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const body = await request.json();
    const query: string | undefined = body.query;

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

    // Translate natural language to SQL
    const translated = await translateToSQL({
      query: query.trim(),
      studio_id: studioId!,
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
