import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
  generateCampaignCopy,
  CampaignCopyRequest,
} from "@/lib/anthropic";

const VALID_CAMPAIGN_TYPES = [
  "winback",
  "upsell",
  "retention",
  "reactivation",
  "promotion",
  "general",
] as const;

const VALID_TONES = ["friendly", "urgent", "professional", "casual"] as const;

/**
 * POST /api/ai/campaign-copy
 * Generate AI-powered email campaign copy.
 * Caches results in ai_cache table with 24-hour expiry.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();

    // Authenticate
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate request body
    let body: CampaignCopyRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    if (
      !body.campaign_type ||
      !VALID_CAMPAIGN_TYPES.includes(body.campaign_type)
    ) {
      return NextResponse.json(
        {
          error: `Invalid campaign_type. Must be one of: ${VALID_CAMPAIGN_TYPES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    if (!body.audience_description || body.audience_description.trim() === "") {
      return NextResponse.json(
        { error: "audience_description is required" },
        { status: 400 }
      );
    }

    if (
      body.tone &&
      !VALID_TONES.includes(body.tone as (typeof VALID_TONES)[number])
    ) {
      return NextResponse.json(
        { error: `Invalid tone. Must be one of: ${VALID_TONES.join(", ")}` },
        { status: 400 }
      );
    }

    // Build a cache key from the request parameters
    const cacheKey = JSON.stringify({
      campaign_type: body.campaign_type,
      audience_description: body.audience_description,
      tone: body.tone ?? null,
      key_points: body.key_points ?? [],
      merge_tags: body.merge_tags ?? [],
      max_length: body.max_length ?? null,
    });

    // Check for a cached result from the last 24 hours
    const { data: cached } = await supabase
      .from("ai_cache")
      .select("result, created_at")
      .eq("cache_type", "campaign_copy")
      .eq("cache_key", cacheKey)
      .gte(
        "created_at",
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      )
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached) {
      return NextResponse.json({
        ...cached.result,
        cached: true,
        generated_at: cached.created_at,
      });
    }

    // Generate fresh campaign copy
    const result = await generateCampaignCopy(body);
    const generatedAt = new Date().toISOString();

    // Cache the result (best-effort — don't fail if ai_cache table doesn't exist yet)
    await supabase
      .from("ai_cache")
      .insert({
        cache_type: "campaign_copy",
        cache_key: cacheKey,
        result,
        created_at: generatedAt,
      })
      .then(
        () => {
          /* cached successfully */
        },
        () => {
          /* Table may not exist yet — that's fine */
        }
      );

    return NextResponse.json({
      ...result,
      cached: false,
      generated_at: generatedAt,
    });
  } catch (err) {
    console.error("POST /api/ai/campaign-copy error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
