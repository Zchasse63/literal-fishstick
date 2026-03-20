import Anthropic from "@anthropic-ai/sdk";

// ─── Types ───────────────────────────────────────────────────

export interface WaitlistMemberContext {
  member_name: string;
  member_email: string;
  class_title: string;
  class_date: string; // formatted date
  class_time: string; // formatted time
  position_in_waitlist: number;
  member_visit_count: number;
  membership_type: string | null;
  has_been_waitlisted_before: boolean;
}

export interface WaitlistMessageResult {
  subject: string;
  body_html: string;
  body_text: string;
  personalization_notes: string; // why this message was personalized this way
}

export type WaitlistMessageType = "promoted" | "still_waiting" | "class_full";

// ─── Rules-Based Fallback Templates ─────────────────────────

function generateRulesBasedMessage(
  context: WaitlistMemberContext,
  messageType: WaitlistMessageType
): WaitlistMessageResult {
  const { member_name, class_title, class_date, class_time, position_in_waitlist } = context;

  switch (messageType) {
    case "promoted":
      return {
        subject: `You're in! Spot confirmed for ${class_title}`,
        body_html: `<p>Great news, ${member_name}!</p>
<p>A spot opened up in <strong>${class_title}</strong> on ${class_date} at ${class_time}. You're in!</p>
<p>We'll see you there. No action needed — your booking is confirmed.</p>
<p>— The Team</p>`,
        body_text: `Great news, ${member_name}!\n\nA spot opened up in ${class_title} on ${class_date} at ${class_time}. You're in!\n\nWe'll see you there. No action needed — your booking is confirmed.\n\n— The Team`,
        personalization_notes: "Rules-based fallback: standard promotion notification.",
      };

    case "still_waiting":
      return {
        subject: `Waitlist update for ${class_title}`,
        body_html: `<p>Hey ${member_name},</p>
<p>You're currently <strong>#${position_in_waitlist}</strong> on the waitlist for <strong>${class_title}</strong> on ${class_date} at ${class_time}.</p>
<p>We'll notify you immediately if a spot opens up. Hang tight!</p>
<p>— The Team</p>`,
        body_text: `Hey ${member_name},\n\nYou're currently #${position_in_waitlist} on the waitlist for ${class_title} on ${class_date} at ${class_time}.\n\nWe'll notify you immediately if a spot opens up. Hang tight!\n\n— The Team`,
        personalization_notes: "Rules-based fallback: standard waitlist position update.",
      };

    case "class_full":
      return {
        subject: `${class_title} on ${class_date} is fully booked`,
        body_html: `<p>Hey ${member_name},</p>
<p><strong>${class_title}</strong> on ${class_date} at ${class_time} is fully booked and the waitlist has closed.</p>
<p>Check the schedule for similar upcoming sessions — we'd love to see you at the next one.</p>
<p>— The Team</p>`,
        body_text: `Hey ${member_name},\n\n${class_title} on ${class_date} at ${class_time} is fully booked and the waitlist has closed.\n\nCheck the schedule for similar upcoming sessions — we'd love to see you at the next one.\n\n— The Team`,
        personalization_notes: "Rules-based fallback: standard class-full notification.",
      };
  }
}

// ─── AI-Powered Message Generation ──────────────────────────

const SYSTEM_PROMPT = `You are Meridian AI, writing personalized waitlist notifications for a fitness and wellness studio (sauna & cold plunge sessions).

Guidelines:
- Match tone to the member's relationship with the studio: frequent visitors (10+ visits) get a warmer, casual tone; newer members (fewer visits) get a more welcoming, encouraging tone.
- Keep it brief — these are transactional notifications, not marketing emails.
- Use the member's first name (extract from the full name provided).
- Do not use excessive exclamation marks or emojis.
- Include relevant details: class name, date, time, and waitlist position where applicable.
- For "class_full" messages, suggest checking the schedule for alternatives.
- For "promoted" messages, confirm their spot clearly.
- For "still_waiting" messages, reassure them they'll be notified.

Return your response as a JSON object with exactly these keys:
- "subject": email subject line
- "body_html": HTML email body (use <p>, <strong> tags, keep it simple)
- "body_text": plain text version of the body
- "personalization_notes": brief explanation of why you personalized the message this way

Return ONLY the JSON object, no markdown fences or extra text.`;

/**
 * Generate a personalized waitlist notification message using Claude,
 * with a rules-based fallback when the Anthropic API key is unavailable.
 */
export async function generateWaitlistMessage(
  context: WaitlistMemberContext,
  messageType: WaitlistMessageType
): Promise<WaitlistMessageResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return generateRulesBasedMessage(context, messageType);
  }

  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const userPrompt = [
      `Message type: ${messageType}`,
      `Member name: ${context.member_name}`,
      `Class: ${context.class_title}`,
      `Date: ${context.class_date}`,
      `Time: ${context.class_time}`,
      `Waitlist position: ${context.position_in_waitlist}`,
      `Total studio visits: ${context.member_visit_count}`,
      `Membership type: ${context.membership_type ?? "none"}`,
      `Has been waitlisted before: ${context.has_been_waitlisted_before ? "yes" : "no"}`,
    ].join("\n");

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Parse JSON from response, stripping any markdown fences if present
    const jsonStr = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    const parsed = JSON.parse(jsonStr) as WaitlistMessageResult;

    // Validate required fields
    if (!parsed.subject || !parsed.body_html || !parsed.body_text) {
      throw new Error(
        "Incomplete response from AI — missing required fields"
      );
    }

    return {
      subject: parsed.subject,
      body_html: parsed.body_html,
      body_text: parsed.body_text,
      personalization_notes: parsed.personalization_notes ?? "",
    };
  } catch (error) {
    console.error(
      "Anthropic API error for waitlist message, falling back to rules-based:",
      error
    );
    return generateRulesBasedMessage(context, messageType);
  }
}
