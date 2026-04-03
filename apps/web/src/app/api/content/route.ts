import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const ALLOWED_ROLES = ["owner", "admin", "manager"];
const STAFF_ROLES = ["admin", "manager", "trainer", "staff"];
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
      profile?.studio_id ?? "11111111-1111-1111-1111-111111111111";

    let query = supabase
      .from("content_posts")
      .select("*, author:profiles!content_posts_author_id_fkey(id, full_name, email, roles)")
      .eq("studio_id", studioId)
      .order("created_at", { ascending: false })
      .limit(limit + 1); // Fetch one extra to determine if there's a next page

    if (type) {
      query = query.eq("type", type);
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
      profile?.studio_id ?? "11111111-1111-1111-1111-111111111111";
    const userRoles: string[] = profile?.roles ?? [];

    const body = await request.json();
    const { title, body: postBody, type, is_published, media_urls, tags } = body;

    if (!title || !postBody) {
      return NextResponse.json(
        { error: "title and body are required" },
        { status: 400 }
      );
    }

    // Determine author role (highest privilege)
    let authorRole = "member";
    for (const role of ["admin", "manager", "trainer", "staff"]) {
      if (userRoles.includes(role)) {
        authorRole = role;
        break;
      }
    }

    // Staff posts are auto-approved; member posts need moderation
    const isStaff = userRoles.some((r: string) => STAFF_ROLES.includes(r));
    const isApproved = isStaff;

    const { data: post, error: insertError } = await supabase
      .from("content_posts")
      .insert({
        studio_id: studioId,
        author_id: user.id,
        author_role: authorRole,
        title,
        body: postBody,
        type: type ?? "post",
        is_published: is_published ?? true,
        is_approved: isApproved,
        media_urls: media_urls ?? [],
        tags: tags ?? [],
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
    await supabase.from("activity_log").insert({
      studio_id: studioId,
      actor_id: user.id,
      type: "content_created",
      subject_type: "content_post",
      subject_id: post.id,
      metadata: { title, type: type ?? "post", author_role: authorRole },
    });

    return NextResponse.json({ data: post }, { status: 201 });
  } catch (err) {
    console.error("POST /api/content error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
