import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

const ALLOWED_ROLES = ["owner", "admin", "manager"];

/**
 * GET /api/content/[id]
 * Fetch a content post with its comments.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient();
    const { id } = await params;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("studio_id")
      .eq("id", user.id)
      .single();

    const studioId =
      profile?.studio_id ?? DEFAULT_STUDIO_ID;

    const { data: post, error: postError } = await supabase
      .from("content_posts")
      .select("*, author:profiles!content_posts_author_id_fkey(id, full_name, email, roles)")
      .eq("id", id)
      .eq("studio_id", studioId)
      .single();

    if (postError || !post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Fetch comments
    const { data: comments } = await supabase
      .from("content_comments")
      .select("*, commenter:profiles!content_comments_author_id_fkey(id, full_name, email)")
      .eq("post_id", id)
      .order("created_at", { ascending: true });

    // Check if current user has liked this post
    const { data: userLike } = await supabase
      .from("content_likes")
      .select("id")
      .eq("post_id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    return NextResponse.json({
      data: {
        ...post,
        comments: comments ?? [],
        user_has_liked: !!userLike,
      },
    });
  } catch (err) {
    console.error("GET /api/content/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/content/[id]
 * Update a content post. Only author or admin/manager can update.
 * Body: { title?, body?, type?, is_published?, is_approved?, media_urls?, tags? }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient();
    const { id } = await params;

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
    const userRoles: string[] = profile?.roles ?? [];
    const isAdmin = userRoles.some((r: string) => ALLOWED_ROLES.includes(r));

    // Fetch existing post
    const { data: existingPost, error: fetchError } = await supabase
      .from("content_posts")
      .select("id, author_id")
      .eq("id", id)
      .eq("studio_id", studioId)
      .single();

    if (fetchError || !existingPost) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Only the author or admin/manager can update
    if (existingPost.author_id !== user.id && !isAdmin) {
      return NextResponse.json(
        { error: "Only the author or an admin can update this post" },
        { status: 403 }
      );
    }

    const body = await request.json();
    // Client-facing field names → real schema columns.
    // `body` → content, `type` → post_type, `media_urls`/`tags` have no
    // dedicated columns (media uses singular image_url, tags are not tracked).
    const FIELD_MAP: Record<string, string> = {
      title: "title",
      body: "content",
      type: "post_type",
      is_published: "is_published",
      image_url: "image_url",
      is_pinned: "is_pinned",
    };
    const allowedFields = Object.keys(FIELD_MAP);
    // Only admins can approve posts
    if (isAdmin) {
      allowedFields.push("is_approved");
      FIELD_MAP.is_approved = "is_approved";
    }

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[FIELD_MAP[field]] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    updates.updated_at = new Date().toISOString();

    const { data: updated, error: updateError } = await supabase
      .from("content_posts")
      .update(updates)
      .eq("id", id)
      .eq("studio_id", studioId)
      .select("*, author:profiles!content_posts_author_id_fkey(id, full_name, email, roles)")
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("PUT /api/content/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/content/[id]
 * Delete a content post. Only author or admin/manager can delete.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient();
    const { id } = await params;

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
    const userRoles: string[] = profile?.roles ?? [];
    const isAdmin = userRoles.some((r: string) => ALLOWED_ROLES.includes(r));

    // Fetch existing post
    const { data: existingPost, error: fetchError } = await supabase
      .from("content_posts")
      .select("id, author_id")
      .eq("id", id)
      .eq("studio_id", studioId)
      .single();

    if (fetchError || !existingPost) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    if (existingPost.author_id !== user.id && !isAdmin) {
      return NextResponse.json(
        { error: "Only the author or an admin can delete this post" },
        { status: 403 }
      );
    }

    // Delete associated likes and comments first
    await supabase.from("content_likes").delete().eq("post_id", id);
    await supabase.from("content_comments").delete().eq("post_id", id);

    const { error: deleteError } = await supabase
      .from("content_posts")
      .delete()
      .eq("id", id)
      .eq("studio_id", studioId);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      );
    }

    // Log activity
    await supabase.from("activity_log").insert({
      studio_id: studioId,
      actor_id: user.id,
      type: "content_deleted",
      subject_type: "content_post",
      subject_id: id,
      metadata: {},
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/content/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
