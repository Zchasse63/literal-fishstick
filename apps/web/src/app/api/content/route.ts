import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

const ALLOWED_ROLES = ["owner", "admin", "manager"];
// Roles that produce auto-approved posts. Must include 'owner' since
// the content_posts.author_role CHECK constraint only allows
// ['owner','manager','trainer','member'].
const STAFF_ROLES = ["owner", "admin", "manager", "trainer", "staff"];
// Valid author_role values per content_posts CHECK constraint
// (extended in T27/B14 migration to include admin + staff).
const VALID_AUTHOR_ROLES = ["owner", "admin", "manager", "trainer", "staff"];
// Valid post_type values per content_posts CHECK constraint.
const VALID_POST_TYPES = new Set([
  "update",
  "event",
  "class_promo",
  "tip",
  "poll",
  "announcement",
]);
const PAGE_SIZE = 20;

/**
 * GET /api/content
 * List content posts with cursor-based pagination.
 * Query params: type, author_role, is_published, cursor, limit
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { searchParams } = request.nextUrl;

    const type = searchParams.get("type");
    const authorRole = searchParams.get("author_role");
    const isPublished = searchParams.get("is_published");
    const cursor = searchParams.get("cursor"); // ISO timestamp for cursor-based pagination
    const limit = Math.min(parseInt(searchParams.get("limit") ?? String(PAGE_SIZE), 10), 50);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("studio_id, roles")
      .eq("id", user.id)
      .single();

    const studioId =
      profile?.studio_id ?? DEFAULT_STUDIO_ID;

    let query = supabase
      .from("content_posts")
      .select("*, author:profiles!content_posts_author_id_fkey(id, full_name, email, roles)")
      .eq("studio_id", studioId)
      .order("created_at", { ascending: false })
      .limit(limit + 1); // Fetch one extra to determine if there's a next page

    if (type) {
      query = query.eq("post_type", type);
    }

    if (authorRole) {
      query = query.eq("author_role", authorRole);
    }

    if (isPublished !== null && isPublished !== undefined && isPublished !== "") {
      query = query.eq("is_published", isPublished === "true");
    }

    if (cursor) {
      query = query.lt("created_at", cursor);
    }

    const { data: posts, error } = await query;

    if (error) {
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    const allPosts = posts ?? [];
    const hasMore = allPosts.length > limit;
    const returnedPosts = hasMore ? allPosts.slice(0, limit) : allPosts;
    const nextCursor = hasMore && returnedPosts.length > 0
      ? returnedPosts[returnedPosts.length - 1].created_at
      : null;

    return NextResponse.json({
      data: returnedPosts,
      pagination: {
        has_more: hasMore,
        next_cursor: nextCursor,
      },
    });
  } catch (err) {
    console.error("GET /api/content error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/content
 * Create a content post. Staff posts are auto-approved.
 * Body: { title, body, type?, is_published?, media_urls?, tags? }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("studio_id, roles, full_name")
      .eq("id", user.id)
      .single();

    const studioId =
      profile?.studio_id ?? DEFAULT_STUDIO_ID;
    const userRoles: string[] = profile?.roles ?? [];

    const body = await request.json();
    const { title, body: postBody, type, is_published, image_url } = body;

    if (!title || !postBody) {
      return NextResponse.json(
        { error: "title and body are required" },
        { status: 400 }
      );
    }

    // Determine author role (highest privilege) — constrained to the
    // values allowed by the content_posts.author_role CHECK constraint.
    let authorRole = "member";
    for (const role of VALID_AUTHOR_ROLES) {
      if (userRoles.includes(role)) {
        authorRole = role;
        break;
      }
    }

    // Staff posts are auto-approved; member posts need moderation
    const isStaff = userRoles.some((r: string) => STAFF_ROLES.includes(r));
    const isApproved = isStaff;

    // Sanitize post_type against the CHECK constraint; unknown types fall
    // back to the default 'update'.
    const safePostType = type && VALID_POST_TYPES.has(type) ? type : "update";

    const { data: post, error: insertError } = await supabase
      .from("content_posts")
      .insert({
        studio_id: studioId,
        author_id: user.id,
        author_role: authorRole,
        title,
        content: postBody,
        post_type: safePostType,
        is_published: is_published ?? true,
        is_approved: isApproved,
        image_url: image_url ?? null,
        like_count: 0,
        comment_count: 0,
      })
      .select("*, author:profiles!content_posts_author_id_fkey(id, full_name, email, roles)")
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    // Log activity
    // Tier 5.4 fix: capture-and-log + description
    const { error: activityError } = await supabase.from("activity_log").insert({
      studio_id: studioId,
      actor_id: user.id,
      type: "content_post_created",
      subject_type: "content_post",
      subject_id: post.id,
      description: `Content post created: ${title}`,
      metadata: { title, post_type: type ?? "update", author_role: authorRole },
    });

    if (activityError) {
      console.error(
        "POST /api/content: activity_log insert failed",
        activityError.message
      );
    }

    return NextResponse.json({ data: post }, { status: 201 });
  } catch (err) {
    console.error("POST /api/content error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
