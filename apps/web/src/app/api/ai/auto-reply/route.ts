import { NextResponse } from "next/server";
import { sendTransactionalEmail } from "@/lib/resend";
import {
  generateReplyDraft,
  type ReplyDraftInput,
} from "@/lib/ai/auto-reply";
import { requireRole } from "@/lib/auth/require-role";
import { rateLimit } from "@/lib/rate-limit";
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

const STUDIO_ID = DEFAULT_STUDIO_ID;

// ---------------------------------------------------------------------------
// POST /api/ai/auto-reply — Generate a draft reply for a campaign reply
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const auth = await requireRole(["owner", "manager"]);
    if (auth.error) return auth.error;
    const { user, supabase } = auth;

    // Rate limit: 20 requests per minute per user
    const rl = rateLimit(`ai:${user.id}`, 20, 60_000);
    if (!rl.success) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    // Parse body
    let body: { reply_id: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    if (!body.reply_id) {
      return NextResponse.json(
        { error: "reply_id is required" },
        { status: 400 }
      );
    }

    // Fetch the campaign reply record
    const { data: reply, error: replyError } = await supabase
      .from("campaign_replies")
      .select("*")
      .eq("id", body.reply_id)
      .eq("studio_id", STUDIO_ID)
      .maybeSingle();

    if (replyError) {
      console.error("Error fetching campaign reply:", replyError);
      return NextResponse.json(
        { error: "Failed to fetch campaign reply" },
        { status: 500 }
      );
    }

    if (!reply) {
      return NextResponse.json(
        { error: "Campaign reply not found" },
        { status: 404 }
      );
    }

    // Fetch the linked send log to get the original campaign context
    const { data: sendLog, error: sendLogError } = await supabase
      .from("email_send_log")
      .select("id, campaign_id, member_id, subject, body_html, body_text")
      .eq("id", reply.send_log_id)
      .maybeSingle();

    if (sendLogError || !sendLog) {
      console.error("Error fetching send log:", sendLogError);
      return NextResponse.json(
        { error: "Original email send log not found" },
        { status: 404 }
      );
    }

    // Fetch member profile data
    const { data: member } = await supabase
      .from("members")
      .select(
        "id, membership_tier, credits_remaining, profiles:profile_id ( full_name, email )"
      )
      .eq("id", reply.member_id)
      .eq("studio_id", STUDIO_ID)
      .maybeSingle();

    // Fetch member visit count for the last 30 days
    let visitsLast30d = 0;
    if (reply.member_id) {
      const thirtyDaysAgo = new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000
      ).toISOString();

      const { count } = await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("member_id", reply.member_id)
        .eq("studio_id", STUDIO_ID)
        .not("checked_in_at", "is", null)
        .gte("checked_in_at", thirtyDaysAgo);

      visitsLast30d = count ?? 0;
    }

    // Fetch studio settings for studio name and owner name
    const { data: studioSettings } = await supabase
      .from("studio_settings")
      .select("name")
      .eq("studio_id", STUDIO_ID)
      .maybeSingle();

    // Extract profile from nested join (Supabase returns single-object joins
    // as an array with one element or as an object depending on the relationship)
    const rawProfile = member?.profiles as unknown;
    const profile = Array.isArray(rawProfile)
      ? (rawProfile[0] as { full_name: string; email: string } | undefined) ?? null
      : (rawProfile as { full_name: string; email: string } | null);

    const memberName =
      profile?.full_name ?? reply.from_email.split("@")[0] ?? "Member";

    // Build the input for the AI draft generator
    const draftInput: ReplyDraftInput = {
      original_campaign_subject: sendLog.subject ?? "",
      original_campaign_body: sendLog.body_text ?? sendLog.body_html ?? "",
      member_name: memberName,
      member_email: reply.from_email,
      reply_subject: reply.subject ?? "",
      reply_body: reply.body_text ?? "",
      member_context: member
        ? {
            membership_type: member.membership_tier ?? null,
            visits_last_30d: visitsLast30d,
            credits_remaining: member.credits_remaining ?? 0,
          }
        : undefined,
      studio_name: studioSettings?.name ?? "The Studio",
      owner_name: "The Team",
    };

    // Generate the draft
    const result = await generateReplyDraft(draftInput);
    const now = new Date().toISOString();

    // Update the campaign_replies record with the draft
    const { error: updateError } = await supabase
      .from("campaign_replies")
      .update({
        ai_draft_reply: result.draft_reply,
        ai_draft_generated_at: now,
        status: "draft_ready",
      })
      .eq("id", body.reply_id)
      .eq("studio_id", STUDIO_ID);

    if (updateError) {
      console.error("Error updating campaign reply with draft:", updateError);
      return NextResponse.json(
        { error: "Failed to save draft" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ...result,
      reply_id: body.reply_id,
      generated_at: now,
    });
  } catch (err) {
    console.error("POST /api/ai/auto-reply error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PUT /api/ai/auto-reply — Approve and send a drafted reply
// ---------------------------------------------------------------------------

export async function PUT(request: Request) {
  try {
    const auth = await requireRole(["owner", "manager"]);
    if (auth.error) return auth.error;
    const { user, supabase } = auth;

    // Rate limit: 20 requests per minute per user
    const rl = rateLimit(`ai:${user.id}`, 20, 60_000);
    if (!rl.success) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    // Parse body
    let body: { reply_id: string; edited_reply?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    if (!body.reply_id) {
      return NextResponse.json(
        { error: "reply_id is required" },
        { status: 400 }
      );
    }

    // Fetch the campaign reply
    const { data: reply, error: replyError } = await supabase
      .from("campaign_replies")
      .select("*")
      .eq("id", body.reply_id)
      .eq("studio_id", STUDIO_ID)
      .maybeSingle();

    if (replyError) {
      console.error("Error fetching campaign reply:", replyError);
      return NextResponse.json(
        { error: "Failed to fetch campaign reply" },
        { status: 500 }
      );
    }

    if (!reply) {
      return NextResponse.json(
        { error: "Campaign reply not found" },
        { status: 404 }
      );
    }

    // Determine the reply text to send
    const replyText = body.edited_reply ?? reply.ai_draft_reply;

    if (!replyText) {
      return NextResponse.json(
        {
          error:
            "No draft reply available. Generate a draft first or provide edited_reply.",
        },
        { status: 400 }
      );
    }

    // Build the subject line
    const replySubject = reply.subject?.startsWith("Re:")
      ? reply.subject
      : `Re: ${reply.subject ?? "Your message"}`;

    // Convert plain text reply to simple HTML
    const replyHtml = replyText
      .split("\n")
      .map((line: string) => (line.trim() === "" ? "<br/>" : `<p>${line}</p>`))
      .join("\n");

    // Send via Resend
    const sendResult = await sendTransactionalEmail(
      reply.from_email,
      replySubject,
      replyHtml,
      {
        tags: [
          { name: "type", value: "campaign_reply" },
          { name: "reply_id", value: body.reply_id },
        ],
      }
    );

    if (sendResult.error) {
      console.error("Failed to send reply email:", sendResult.error);
      return NextResponse.json(
        { error: `Failed to send email: ${sendResult.error}` },
        { status: 500 }
      );
    }

    // Update the campaign_replies record
    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("campaign_replies")
      .update({
        ai_draft_reply: replyText,
        approved_at: now,
        approved_by: user.id,
        sent_reply_at: now,
        status: "sent",
      })
      .eq("id", body.reply_id)
      .eq("studio_id", STUDIO_ID);

    if (updateError) {
      console.error("Error updating campaign reply status:", updateError);
      // Email was sent but DB update failed — log but still return success
      // since the email is already delivered
      return NextResponse.json({
        success: true,
        reply_id: body.reply_id,
        sent_at: now,
        warning: "Email sent but failed to update database record",
        email_id: sendResult.id,
      });
    }

    return NextResponse.json({
      success: true,
      reply_id: body.reply_id,
      sent_at: now,
      email_id: sendResult.id,
      dry_run: sendResult.dryRun,
    });
  } catch (err) {
    console.error("PUT /api/ai/auto-reply error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
