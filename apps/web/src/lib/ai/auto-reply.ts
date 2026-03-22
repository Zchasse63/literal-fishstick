import { getAnthropicClient, AI_MODEL, extractText, parseAIJson } from "@/lib/ai/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReplyDraftInput {
  original_campaign_subject: string;
  original_campaign_body: string;
  member_name: string;
  member_email: string;
  reply_subject: string;
  reply_body: string;
  member_context?: {
    membership_type: string | null;
    visits_last_30d: number;
    credits_remaining: number;
  };
  studio_name: string;
  owner_name: string;
}

export interface ReplyDraftResult {
  draft_reply: string;
  tone_analysis:
    | "positive"
    | "neutral"
    | "negative"
    | "question"
    | "complaint";
  suggested_subject: string;
  requires_human_review: boolean;
  confidence: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_TONES: ReplyDraftResult["tone_analysis"][] = [
  "positive",
  "neutral",
  "negative",
  "question",
  "complaint",
];

// ---------------------------------------------------------------------------
// Rules-based fallback
// ---------------------------------------------------------------------------

function classifyTone(body: string): ReplyDraftResult["tone_analysis"] {
  const lower = body.toLowerCase();

  // Complaint signals
  const complaintWords = [
    "disappointed",
    "terrible",
    "awful",
    "unacceptable",
    "worst",
    "horrible",
    "refund",
    "complaint",
    "furious",
    "disgusted",
    "rip off",
    "scam",
  ];
  if (complaintWords.some((w) => lower.includes(w))) return "complaint";

  // Negative signals
  const negativeWords = [
    "cancel",
    "unhappy",
    "frustrated",
    "issue",
    "problem",
    "not working",
    "broken",
    "wrong",
    "annoyed",
    "upset",
  ];
  if (negativeWords.some((w) => lower.includes(w))) return "negative";

  // Question signals
  if (
    lower.includes("?") ||
    lower.startsWith("how") ||
    lower.startsWith("what") ||
    lower.startsWith("when") ||
    lower.startsWith("where") ||
    lower.startsWith("can i") ||
    lower.startsWith("do you") ||
    lower.startsWith("is there")
  ) {
    return "question";
  }

  // Positive signals
  const positiveWords = [
    "love",
    "great",
    "amazing",
    "awesome",
    "thank",
    "thanks",
    "wonderful",
    "excellent",
    "fantastic",
    "appreciate",
    "enjoyed",
    "best",
  ];
  if (positiveWords.some((w) => lower.includes(w))) return "positive";

  return "neutral";
}

function generateRulesBasedDraft(input: ReplyDraftInput): ReplyDraftResult {
  const tone = classifyTone(input.reply_body);
  const firstName = input.member_name.split(" ")[0] || input.member_name;

  const templates: Record<ReplyDraftResult["tone_analysis"], string> = {
    positive: `Hi ${firstName},\n\nThank you so much for the kind words! It means the world to us to hear feedback like yours.\n\nWe love having you as part of our community. If there's ever anything we can do to make your experience even better, don't hesitate to reach out.\n\nSee you at the studio soon!\n\nWarmly,\n${input.owner_name}`,

    neutral: `Hi ${firstName},\n\nThank you for getting back to us! We appreciate you taking the time to reply.\n\nIf you have any questions or need anything at all, we're always here to help.\n\nLooking forward to seeing you at your next session!\n\nBest,\n${input.owner_name}`,

    negative: `Hi ${firstName},\n\nThank you for sharing your thoughts with us. We take all feedback seriously, and I want you to know that we hear you.\n\nI'd love to chat more about this so we can make things right. Would you be open to a quick call or stopping by the studio so we can discuss?\n\nWe value you as a member and want to ensure your experience is nothing short of excellent.\n\nSincerely,\n${input.owner_name}`,

    question: `Hi ${firstName},\n\nGreat question! Thank you for reaching out.\n\nI'd be happy to help with this. Let me look into the details and get back to you shortly with a complete answer.\n\nIn the meantime, feel free to check our schedule and book your next session anytime.\n\nBest,\n${input.owner_name}`,

    complaint: `Hi ${firstName},\n\nThank you for bringing this to our attention, and I sincerely apologize for the experience. This isn't the standard we hold ourselves to.\n\nI'd like to personally address your concern. Could we schedule a time to speak, either by phone or in person at the studio? I want to make sure we resolve this to your satisfaction.\n\nYour experience matters deeply to us, and we're committed to making this right.\n\nSincerely,\n${input.owner_name}`,
  };

  const requiresReview = tone === "complaint" || tone === "negative";
  const confidence = tone === "neutral" ? 50 : 65;

  return {
    draft_reply: templates[tone],
    tone_analysis: tone,
    suggested_subject: `Re: ${input.reply_subject.replace(/^Re:\s*/i, "")}`,
    requires_human_review: requiresReview || confidence < 70,
    confidence,
  };
}

// ---------------------------------------------------------------------------
// AI-powered draft generation
// ---------------------------------------------------------------------------

/**
 * Generate an AI-drafted reply to a campaign response on behalf of the studio owner.
 * Falls back to rules-based templates if ANTHROPIC_API_KEY is not set or the API call fails.
 */
export async function generateReplyDraft(
  input: ReplyDraftInput
): Promise<ReplyDraftResult> {
  const anthropic = getAnthropicClient();
  if (!anthropic) {
    return generateRulesBasedDraft(input);
  }

  try {

    const memberContextBlock = input.member_context
      ? `\nMember context:\n- Membership: ${input.member_context.membership_type ?? "None"}\n- Visits in last 30 days: ${input.member_context.visits_last_30d}\n- Credits remaining: ${input.member_context.credits_remaining}`
      : "";

    const message = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 800,
      system: `You are drafting a reply on behalf of ${input.owner_name} at ${input.studio_name}. Match their voice: warm, professional, knowledgeable about fitness/wellness/sauna. The reply should feel personal, not automated. For complaints, acknowledge the concern and offer to discuss further. For questions about scheduling/pricing, provide helpful answers. Always end with an invitation to book or visit. Return JSON only with these exact keys: draft_reply (string, plain text), tone_analysis (one of: positive, neutral, negative, question, complaint), suggested_subject (string), requires_human_review (boolean — true for complaints, cancellation requests, or if you are unsure), confidence (number 0-100). No markdown fences.`,
      messages: [
        {
          role: "user",
          content: `Original campaign email:\nSubject: ${input.original_campaign_subject}\nBody: ${input.original_campaign_body}\n\nMember reply from ${input.member_name} (${input.member_email}):\nSubject: ${input.reply_subject}\nBody: ${input.reply_body}${memberContextBlock}`,
        },
      ],
    });

    const text = extractText(message);

    // Strip markdown fences if present
    const jsonStr = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    const parsed = JSON.parse(jsonStr) as ReplyDraftResult;

    // Validate response shape
    if (
      typeof parsed.draft_reply !== "string" ||
      !VALID_TONES.includes(parsed.tone_analysis) ||
      typeof parsed.suggested_subject !== "string" ||
      typeof parsed.requires_human_review !== "boolean" ||
      typeof parsed.confidence !== "number"
    ) {
      console.error(
        "Invalid auto-reply response shape, falling back to rules-based"
      );
      return generateRulesBasedDraft(input);
    }

    // Clamp confidence to 0-100
    parsed.confidence = Math.max(0, Math.min(100, Math.round(parsed.confidence)));

    // Force human review for complaints, cancellation mentions, or low confidence
    if (
      parsed.tone_analysis === "complaint" ||
      parsed.confidence < 70 ||
      input.reply_body.toLowerCase().includes("cancel")
    ) {
      parsed.requires_human_review = true;
    }

    return parsed;
  } catch (error) {
    console.error(
      "Anthropic API error for auto-reply, falling back to rules-based:",
      error
    );
    return generateRulesBasedDraft(input);
  }
}
