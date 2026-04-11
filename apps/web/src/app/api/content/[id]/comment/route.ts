import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

/**
 * POST /api/content/[id]/comment
 * Add a comment to a content post. Updates comment_count on the post.
 * Body: { body }
 *
 * NOTE: `content_comments` does not support reply-threading — there is no
 * `parent_id` column in the schema. Any parent_id in the request body is
 * silently ignored.
 */
export async function POST(
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
      .select("studio_id, full_name, roles")
      .eq("id", user.id)
      .single();

    const studioId =
      profile?.studio_id ?? DEFAULT_STUDIO_ID;

    // Role check — admin-only for now (Phase 5 will open to members)
    const roles: string[] = profile?.roles ?? [];
    if (!roles.some((r: string) => ["owner", "manager"].includes(r))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify post exists
    const { data: post, error: postError } = await supabase
      .from("content_posts")
      .select("id, comment_count")
      .eq("id", id)
      .eq("studio_id", studioId)
      .single();

    if (postError || !post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const requestBody = await request.json();
    const { body: commentBody } = requestBody;

    if (!commentBody || !commentBody.trim()) {
      return NextResponse.json(
        { error: "Comment body is required" },
        { status: 400 }
      );
    }

    const { data: comment, error: insertError } = await supabase
      .from("content_comments")
      .insert({
        post_id: id,
        author_id: user.id,
        content: commentBody.trim(),
        studio_id: studioId,
      })
      .select("*, commenter:profiles!content_comments_author_id_fkey(id, full_name, email)")
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    // Update comment_count on the post
    const newCount = (post.comment_count ?? 0) + 1;
    await supabase
      .from("content_posts")
      .update({ comment_count: newCount, updated_at: new Date().toISOString() })
      .eq("id", id);

    return NextResponse.json({ data: comment }, { status: 201 });
  } catch (err) {
    console.error("POST /api/content/[id]/comment error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
