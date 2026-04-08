import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

/**
 * POST /api/classes/[id]/remind
 * Send reminder notifications to attendees of a class.
 * Body: { channel: 'email' | 'sms' | 'both', message?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient();
    const { id: classId } = await params;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: authProfile } = await supabase
      .from("profiles")
      .select("studio_id, roles")
      .eq("id", user.id)
      .single();

    const studioId = authProfile?.studio_id ?? DEFAULT_STUDIO_ID;

    const roles: string[] = authProfile?.roles ?? [];
    if (!roles.some((r: string) => ["owner", "manager", "trainer"].includes(r))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { channel, message } = body as {
      channel?: "email" | "sms" | "both";
      message?: string;
    };

    if (!channel || !["email", "sms", "both"].includes(channel)) {
      return NextResponse.json(
        { error: "channel is required and must be 'email', 'sms', or 'both'" },
        { status: 400 }
      );
    }

    // Fetch the class details
    const { data: cls, error: classError } = await supabase
      .from("classes")
      .select("id, title, starts_at, ends_at, class_type_id, class_types(name)")
      .eq("id", classId)
      .eq("studio_id", studioId)
      .single();

    if (classError || !cls) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    // Fetch attendees (booked members)
    const { data: bookings, error: bookingError } = await supabase
      .from("bookings")
      .select("member_id, members:member_id ( profile_id, profiles:profile_id ( full_name, email, phone ) )")
      .eq("class_id", classId)
      .eq("studio_id", studioId)
      .in("status", ["booked", "confirmed"]);

    if (bookingError) {
      return NextResponse.json({ error: bookingError.message }, { status: 500 });
    }

    const attendees = bookings ?? [];
    let sent = 0;
    let failed = 0;

    const classTitle = (cls as any).class_types?.name ?? cls.title ?? "Class";
    const classTime = new Date(cls.starts_at).toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    const defaultMessage = `Reminder: ${classTitle} is coming up on ${classTime}. See you soon!`;
    const reminderMessage = message || defaultMessage;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // Send emails in parallel (not sequential)
    if (channel === "email" || channel === "both") {
      const emailResults = await Promise.allSettled(
        attendees.map(async (booking) => {
          const profile = (booking as any).members?.profiles;
          if (!profile?.email) return "skip";
          const res = await fetch(`${appUrl}/api/email/send`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: profile.email,
              subject: `Reminder: ${classTitle} — ${classTime}`,
              html: `<p>Hi ${profile.full_name},</p><p>${reminderMessage}</p>`,
              studio_id: studioId,
            }),
          });
          return res.ok ? "sent" : "failed";
        })
      );
      for (const r of emailResults) {
        if (r.status === "fulfilled" && r.value === "sent") sent++;
        else if (r.status === "fulfilled" && r.value === "skip") { /* no email */ }
        else failed++;
      }
    }

    // SMS in parallel
    if (channel === "sms" || channel === "both") {
      const smsResults = await Promise.allSettled(
        attendees.map(async (booking) => {
          const profile = (booking as any).members?.profiles;
          if (!profile?.phone) return "skip";
          const res = await fetch(`${appUrl}/api/sms/send`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ to: profile.phone, body: reminderMessage }),
          });
          return res.ok ? "sent" : "failed";
        })
      );
      for (const r of smsResults) {
        if (r.status === "fulfilled" && r.value === "sent") sent++;
        else if (r.status === "fulfilled" && r.value === "skip") { /* no phone */ }
        else failed++;
      }
    }

    // Log activity
    await supabase.from("activity_log").insert({
      studio_id: studioId,
      actor_id: user.id,
      type: "class_reminder_sent",
      subject_type: "class",
      subject_id: classId,
      metadata: { channel, sent, failed, attendee_count: attendees.length },
    });

    return NextResponse.json({
      data: {
        class_id: classId,
        channel,
        sent,
        failed,
        total_attendees: attendees.length,
      },
    });
  } catch (err) {
    console.error("POST /api/classes/[id]/remind error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
