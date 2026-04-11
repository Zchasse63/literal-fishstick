import { NextResponse } from "next/server";
import {
  generateCampaignCopy,
  CampaignCopyRequest,
} from "@/lib/ai/campaign";
import { requireRole } from "@/lib/auth/require-role";
import { rateLimit } from "@/lib/rate-limit";

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
    const auth = await requireRole(["owner", "manager"]);
    if (auth.error) return auth.error;
    const { user, supabase, studioId } = auth;

    // Rate limit: 20 requests per minute per user
    const rl = await rateLimit(`ai:${user.id}`, 20, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
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
      .eq("studio_id", studioId)
      .eq("cache_type", "campaign_copy")
      .eq("cache_key", cacheKey)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached) {
      return NextResponse.json({
        ...(cached.result as Record<string, unknown>),
        cached: true,
        generated_at: cached.created_at,
      });
    }

    // Generate fresh campaign copy
    const result = await generateCampaignCopy(body);
    const generatedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Cache the result (best-effort — upsert on the (studio_id, cache_key) unique constraint).
    await supabase
      .from("ai_cache")
      .upsert(
        {
          studio_id: studioId,
          cache_type: "campaign_copy",
          cache_key: cacheKey,
          result: result as unknown as Record<string, unknown>,
          expires_at: expiresAt,
        },
        { onConflict: "studio_id,cache_key" }
      )
      .then(
        () => {
          /* cached successfully */
        },
        (err) => {
          console.error("campaign-copy cache upsert failed:", err);
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
