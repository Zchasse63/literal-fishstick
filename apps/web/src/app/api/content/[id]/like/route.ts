import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

/**
 * POST /api/content/[id]/like
 * Toggle like on a content post: insert or delete from content_likes,
 * update like_count on content_posts.
 */
export async function POST(
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

    // Role check
    const roles: string[] = profile?.roles ?? [];
    if (!roles.some((r: string) => ["owner", "manager"].includes(r))) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    // Verify post exists
    const { data: post, error: postError } = await supabase
      .from("content_posts")
      .select("id, like_count")
      .eq("id", id)
      .eq("studio_id", studioId)
      .single();

    if (postError || !post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Check if user already liked
    const { data: existingLike } = await supabase
      .from("content_likes")
      .select("id")
      .eq("post_id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    let liked: boolean;
    let newCount: number;

    if (existingLike) {
      // Unlike — remove the like
      await supabase
        .from("content_likes")
        .delete()
        .eq("id", existingLike.id);

      newCount = Math.max(0, (post.like_count ?? 0) - 1);
      liked = false;
    } else {
      // Like — add the like
      await supabase.from("content_likes").insert({
        post_id: id,
        user_id: user.id,
        studio_id: studioId,
      });

      newCount = (post.like_count ?? 0) + 1;
      liked = true;
    }

    // Update like_count on the post
    await supabase
      .from("content_posts")
      .update({ like_count: newCount, updated_at: new Date().toISOString() })
      .eq("id", id);

    return NextResponse.json({
      data: {
        liked,
        like_count: newCount,
      },
    });
  } catch (err) {
    console.error("POST /api/content/[id]/like error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
