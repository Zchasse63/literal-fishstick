import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * POST /api/content/[id]/comment
 * Add a comment to a content post. Updates comment_count on the post.
 * Body: { body, parent_id? }
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
      .select("studio_id, full_name")
      .eq("id", user.id)
      .single();

    const studioId =
      profile?.studio_id ?? "11111111-1111-1111-1111-111111111111";

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
    const { body: commentBody, parent_id } = requestBody;

    if (!commentBody || !commentBody.trim()) {
      return NextResponse.json(
        { error: "Comment body is required" },
        { status: 400 }
      );
    }

    // If parent_id is provided, verify the parent comment exists
    if (parent_id) {
      const { data: parentComment, error: parentError } = await supabase
        .from("content_comments")
        .select("id")
        .eq("id", parent_id)
        .eq("post_id", id)
        .single();

      if (parentError || !parentComment) {
        return NextResponse.json(
          { error: "Parent comment not found" },
          { status: 404 }
        );
      }
    }

    const { data: comment, error: insertError } = await supabase
      .from("content_comments")
      .insert({
        post_id: id,
        author_id: user.id,
        body: commentBody.trim(),
        parent_id: parent_id ?? null,
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
