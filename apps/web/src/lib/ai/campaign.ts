/**
 * AI Campaign — campaign copy generation, subject line suggestions, campaign summaries.
 *
 * Extracted from lib/anthropic.ts (MED-09).
 */
import { getAnthropicClient, AI_MODEL, extractText, withRetry } from "@/lib/ai/client";

// ---------------------------------------------------------------------------
// Campaign Copy
// ---------------------------------------------------------------------------

export interface CampaignCopyRequest {
  campaign_type:
    | "winback"
    | "upsell"
    | "retention"
    | "reactivation"
    | "promotion"
    | "general";
  audience_description: string;
  tone?: "friendly" | "urgent" | "professional" | "casual" | "celebratory";
  key_points?: string[];
  merge_tags?: string[];
  max_length?: number;
}

export interface CampaignCopyResult {
  subject_line: string;
  preview_text: string;
  body_html: string;
  body_text: string;
  suggested_merge_tags: string[];
}

/**
 * Generate AI-powered email campaign copy for the studio.
 * Falls back to rules-based templates if ANTHROPIC_API_KEY is not set.
 */
export async function generateCampaignCopy(
  request: CampaignCopyRequest
): Promise<CampaignCopyResult> {
  const anthropic = getAnthropicClient();
  if (!anthropic) {
    return generateRulesBasedCampaignCopy(request);
  }

  try {
    const userPrompt = [
      `Campaign type: ${request.campaign_type}`,
      `Target audience: ${request.audience_description}`,
      request.tone ? `Tone: ${request.tone}` : null,
      request.key_points?.length
        ? `Key points to include:\n${request.key_points.map((p) => `- ${p}`).join("\n")}`
        : null,
      request.merge_tags?.length
        ? `Available merge tags: ${request.merge_tags.join(", ")}`
        : null,
      request.max_length
        ? `Maximum body length: approximately ${request.max_length} characters`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    const message = await withRetry(() => anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 1500,
      system:
        "You are Meridian AI, writing email campaign copy for a fitness/wellness studio (sauna & cold plunge). Write compelling, on-brand copy. Never generate deceptive, misleading, or clickbait subject lines. All suggestions must be honest and CAN-SPAM compliant. Include merge tags where appropriate (Handlebars syntax like {{first_name}}). Return JSON with fields: subject_line, preview_text, body_html, body_text, suggested_merge_tags. Return ONLY the JSON object, no markdown fences or extra text.",
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    }));

    const text = extractText(message);
    const jsonStr = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    const parsed = JSON.parse(jsonStr) as CampaignCopyResult;

    if (
      !parsed.subject_line ||
      !parsed.preview_text ||
      !parsed.body_html ||
      !parsed.body_text
    ) {
      throw new Error("Incomplete response from AI \u2014 missing required fields");
    }

    return {
      subject_line: parsed.subject_line,
      preview_text: parsed.preview_text,
      body_html: parsed.body_html,
      body_text: parsed.body_text,
      // Coerce to array strictly — Claude occasionally returns this field
      // as a comma-separated string or object, breaking downstream
      // `Array.isArray` checks in the client and tests.
      suggested_merge_tags: Array.isArray(parsed.suggested_merge_tags)
        ? parsed.suggested_merge_tags
        : [],
    };
  } catch (error) {
    console.error(
      "Anthropic API error for campaign copy, falling back to rules-based:",
      error
    );
    return generateRulesBasedCampaignCopy(request);
  }
}

function generateRulesBasedCampaignCopy(
  request: CampaignCopyRequest
): CampaignCopyResult {
  const templates: Record<
    CampaignCopyRequest["campaign_type"],
    CampaignCopyResult
  > = {
    winback: {
      subject_line: "We miss you, {{first_name}}! Come back and sweat with us",
      preview_text:
        "It's been a while \u2014 your sauna spot is waiting.",
      body_html: `<p>Hey {{first_name}},</p>
<p>We noticed it's been a while since your last visit. The sauna is warm, the plunges are cold, and your spot is waiting.</p>
<p>Come back this week and rediscover why you started your wellness journey with us.</p>
<p>See you soon,<br/>The Team</p>`,
      body_text:
        "Hey {{first_name}},\n\nWe noticed it's been a while since your last visit. The sauna is warm, the plunges are cold, and your spot is waiting.\n\nCome back this week and rediscover why you started your wellness journey with us.\n\nSee you soon,\nThe Team",
      suggested_merge_tags: ["{{first_name}}", "{{last_visit_date}}"],
    },
    upsell: {
      subject_line:
        "{{first_name}}, unlock unlimited sessions",
      preview_text:
        "Upgrade your membership and never worry about credits again.",
      body_html: `<p>Hey {{first_name}},</p>
<p>You've been making great progress with your current plan. Ready to take it to the next level?</p>
<p>Upgrade to unlimited and get unrestricted access to all sessions \u2014 sauna, cold plunge, and guided classes.</p>
<p>Upgrade now from your account in just one tap.</p>`,
      body_text:
        "Hey {{first_name}},\n\nYou've been making great progress with your current plan. Ready to take it to the next level?\n\nUpgrade to unlimited and get unrestricted access to all sessions \u2014 sauna, cold plunge, and guided classes.\n\nUpgrade now from your account in just one tap.",
      suggested_merge_tags: [
        "{{first_name}}",
        "{{current_plan}}",
        "{{credits_remaining}}",
      ],
    },
    retention: {
      subject_line: "{{first_name}}, your streak is on fire \ud83d\udd25",
      preview_text: "Keep the momentum going \u2014 book your next session.",
      body_html: `<p>Hey {{first_name}},</p>
<p>You've been showing up consistently, and that's what it's all about. Keep the momentum going!</p>
<p>Your next session is just a tap away. Book now and keep building your wellness routine.</p>`,
      body_text:
        "Hey {{first_name}},\n\nYou've been showing up consistently, and that's what it's all about. Keep the momentum going!\n\nYour next session is just a tap away. Book now and keep building your wellness routine.",
      suggested_merge_tags: [
        "{{first_name}}",
        "{{total_visits}}",
        "{{streak_count}}",
      ],
    },
    reactivation: {
      subject_line:
        "{{first_name}}, your membership is paused \u2014 ready to restart?",
      preview_text: "Reactivate and get back to your routine.",
      body_html: `<p>Hey {{first_name}},</p>
<p>Your membership is currently inactive, but getting back on track is easy.</p>
<p>Reactivate today and pick up right where you left off. Your body and mind will thank you.</p>`,
      body_text:
        "Hey {{first_name}},\n\nYour membership is currently inactive, but getting back on track is easy.\n\nReactivate today and pick up right where you left off. Your body and mind will thank you.",
      suggested_merge_tags: [
        "{{first_name}}",
        "{{membership_status}}",
        "{{last_visit_date}}",
      ],
    },
    promotion: {
      subject_line: "Limited time: Special offer just for you, {{first_name}}",
      preview_text: "Don't miss this exclusive deal on sessions.",
      body_html: `<p>Hey {{first_name}},</p>
<p>We've got something special for you. For a limited time, take advantage of an exclusive offer on our sessions.</p>
<p>Don't wait \u2014 this deal won't last long. Book your spot today!</p>`,
      body_text:
        "Hey {{first_name}},\n\nWe've got something special for you. For a limited time, take advantage of an exclusive offer on our sessions.\n\nDon't wait \u2014 this deal won't last long. Book your spot today!",
      suggested_merge_tags: ["{{first_name}}", "{{offer_details}}"],
    },
    general: {
      subject_line: "What's new at the studio, {{first_name}}",
      preview_text: "Updates, events, and more from your studio.",
      body_html: `<p>Hey {{first_name}},</p>
<p>Here's what's happening at the studio this week. New classes, upcoming events, and more \u2014 we've got a lot in store.</p>
<p>Check the schedule and book your next session!</p>`,
      body_text:
        "Hey {{first_name}},\n\nHere's what's happening at the studio this week. New classes, upcoming events, and more \u2014 we've got a lot in store.\n\nCheck the schedule and book your next session!",
      suggested_merge_tags: ["{{first_name}}"],
    },
  };

  return templates[request.campaign_type] ?? templates.general;
}

// ---------------------------------------------------------------------------
// Subject Line Suggestions
// ---------------------------------------------------------------------------

export interface SubjectLineContext {
  campaign_type: string;
  audience_description: string;
  tone: string;
  key_points: string[];
}

export interface SubjectLineSuggestion {
  subject_line: string;
  estimated_open_rate_improvement: string;
  rationale: string;
}

/**
 * Generate AI-powered subject line suggestions for email campaigns.
 * Falls back to rules-based suggestions if ANTHROPIC_API_KEY is not set.
 */
export async function suggestSubjectLines(
  context: SubjectLineContext
): Promise<SubjectLineSuggestion[]> {
  const anthropic = getAnthropicClient();
  if (!anthropic) {
    return generateRulesBasedSubjectLines(context);
  }

  try {
    const message = await withRetry(() => anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 800,
      system:
        "You are Meridian AI, an email marketing assistant for a fitness/wellness studio (sauna & cold plunge). Generate exactly 5 email subject line suggestions. Never generate deceptive, misleading, or clickbait subject lines. All suggestions must be honest and CAN-SPAM compliant. Return a JSON array of 5 objects, each with: subject_line (string), estimated_open_rate_improvement (string like '+12%'), rationale (string). Return ONLY the JSON array, no markdown fences or extra text.",
      messages: [
        {
          role: "user",
          content: `Generate 5 subject lines for this campaign:\nCampaign type: ${context.campaign_type}\nAudience: ${context.audience_description}\nTone: ${context.tone}\nKey points: ${context.key_points.join(", ")}`,
        },
      ],
    }));

    const text = extractText(message);
    const jsonStr = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    const parsed = JSON.parse(jsonStr) as SubjectLineSuggestion[];

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error("Invalid response shape");
    }

    return parsed.slice(0, 5);
  } catch (error) {
    console.error(
      "Anthropic API error for subject lines, falling back to rules-based:",
      error
    );
    return generateRulesBasedSubjectLines(context);
  }
}

function generateRulesBasedSubjectLines(
  context: SubjectLineContext
): SubjectLineSuggestion[] {
  const templates: Record<string, SubjectLineSuggestion[]> = {
    winback: [
      { subject_line: "We miss you, {{first_name}} \u2014 your spot is waiting", estimated_open_rate_improvement: "+8%", rationale: "Personalization with name and emotional appeal" },
      { subject_line: "It's been a while \u2014 ready to sweat again?", estimated_open_rate_improvement: "+5%", rationale: "Casual re-engagement with question format" },
      { subject_line: "Come back and feel the difference this week", estimated_open_rate_improvement: "+4%", rationale: "Action-oriented with time urgency" },
      { subject_line: "Your wellness routine is calling, {{first_name}}", estimated_open_rate_improvement: "+6%", rationale: "Personalized with identity-based framing" },
      { subject_line: "The sauna is warm \u2014 we saved your spot", estimated_open_rate_improvement: "+7%", rationale: "Warm imagery with exclusivity feel" },
    ],
    upsell: [
      { subject_line: "Ready for unlimited, {{first_name}}?", estimated_open_rate_improvement: "+10%", rationale: "Direct value proposition with personalization" },
      { subject_line: "Upgrade your plan \u2014 more sessions, more results", estimated_open_rate_improvement: "+6%", rationale: "Benefit-focused upgrade prompt" },
      { subject_line: "You're outgrowing your current plan (that's a good thing)", estimated_open_rate_improvement: "+9%", rationale: "Positive framing of usage growth" },
      { subject_line: "Unlock unlimited access to every session", estimated_open_rate_improvement: "+7%", rationale: "Clear value statement with action verb" },
      { subject_line: "{{first_name}}, your next level is waiting", estimated_open_rate_improvement: "+5%", rationale: "Aspirational language with personalization" },
    ],
    retention: [
      { subject_line: "Keep your streak alive, {{first_name}}", estimated_open_rate_improvement: "+11%", rationale: "Streak psychology with personalization" },
      { subject_line: "You've been crushing it \u2014 don't stop now", estimated_open_rate_improvement: "+8%", rationale: "Positive reinforcement with momentum" },
      { subject_line: "Your next session is just a tap away", estimated_open_rate_improvement: "+5%", rationale: "Low-friction action-oriented" },
      { subject_line: "{{first_name}}, book your next sweat session", estimated_open_rate_improvement: "+6%", rationale: "Personalized direct call-to-action" },
      { subject_line: "Great things happen when you show up consistently", estimated_open_rate_improvement: "+4%", rationale: "Motivational consistency message" },
    ],
    promotion: [
      { subject_line: "Special offer: limited spots available this week", estimated_open_rate_improvement: "+12%", rationale: "Scarcity without being deceptive" },
      { subject_line: "{{first_name}}, an exclusive offer just for you", estimated_open_rate_improvement: "+9%", rationale: "Personalized exclusivity" },
      { subject_line: "This week only \u2014 save on your favorite sessions", estimated_open_rate_improvement: "+7%", rationale: "Time-bound with value clarity" },
      { subject_line: "Your studio has a treat for you, {{first_name}}", estimated_open_rate_improvement: "+6%", rationale: "Warm, gift-like framing" },
      { subject_line: "Don't miss this \u2014 new member pricing for upgrades", estimated_open_rate_improvement: "+8%", rationale: "Clear offer with urgency" },
    ],
  };

  const defaultLines: SubjectLineSuggestion[] = [
    { subject_line: "What's new at the studio this week, {{first_name}}", estimated_open_rate_improvement: "+5%", rationale: "Personalized curiosity-driven subject" },
    { subject_line: "Your weekly wellness update is here", estimated_open_rate_improvement: "+3%", rationale: "Consistent newsletter-style format" },
    { subject_line: "New sessions, events, and more \u2014 check it out", estimated_open_rate_improvement: "+4%", rationale: "Multi-value teaser" },
    { subject_line: "{{first_name}}, here's what's happening this week", estimated_open_rate_improvement: "+6%", rationale: "Personalized with timely relevance" },
    { subject_line: "Fresh schedule just dropped \u2014 book your spot", estimated_open_rate_improvement: "+7%", rationale: "Action-oriented with freshness" },
  ];

  return templates[context.campaign_type] ?? defaultLines;
}

// ---------------------------------------------------------------------------
// Campaign Summary
// ---------------------------------------------------------------------------

export interface CampaignSummaryInput {
  campaign_name: string;
  channel: string;
  sent_count: number;
  delivered_count: number;
  open_count: number;
  click_count: number;
  bounce_count: number;
  unsubscribe_count: number;
  conversion_count: number;
  revenue_attributed: number;
  segment_name: string;
  sent_at: string;
}

export interface CampaignSummaryResult {
  summary: string;
  highlights: string[];
  concerns: string[];
  recommendation: string;
}

/**
 * Generate an AI-powered post-campaign summary with performance analysis.
 * Falls back to rules-based templates if ANTHROPIC_API_KEY is not set.
 */
export async function summarizeCampaign(
  data: CampaignSummaryInput
): Promise<CampaignSummaryResult> {
  const anthropic = getAnthropicClient();
  if (!anthropic) {
    return generateRulesBasedCampaignSummary(data);
  }

  try {
    const message = await withRetry(() => anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 600,
      system:
        "You are Meridian AI. Summarize the performance of an email/SMS campaign for a fitness/wellness studio. Be data-driven and actionable. Return JSON with: summary (2-3 sentence overview), highlights (array of positive takeaways), concerns (array of issues to watch), recommendation (single actionable next step). Return ONLY the JSON object, no markdown fences.",
      messages: [
        {
          role: "user",
          content: `Summarize this campaign's performance:\n${JSON.stringify(data, null, 2)}`,
        },
      ],
    }));

    const text = extractText(message);
    const jsonStr = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    const parsed = JSON.parse(jsonStr) as CampaignSummaryResult;

    if (
      typeof parsed.summary !== "string" ||
      !Array.isArray(parsed.highlights) ||
      !Array.isArray(parsed.concerns) ||
      typeof parsed.recommendation !== "string"
    ) {
      throw new Error("Invalid campaign summary response shape");
    }

    return parsed;
  } catch (error) {
    console.error(
      "Anthropic API error for campaign summary, falling back to rules-based:",
      error
    );
    return generateRulesBasedCampaignSummary(data);
  }
}

function generateRulesBasedCampaignSummary(
  data: CampaignSummaryInput
): CampaignSummaryResult {
  const openRate =
    data.delivered_count > 0
      ? ((data.open_count / data.delivered_count) * 100).toFixed(1)
      : "0.0";
  const clickRate =
    data.delivered_count > 0
      ? ((data.click_count / data.delivered_count) * 100).toFixed(1)
      : "0.0";
  const bounceRate =
    data.sent_count > 0
      ? ((data.bounce_count / data.sent_count) * 100).toFixed(1)
      : "0.0";
  const conversionRate =
    data.click_count > 0
      ? ((data.conversion_count / data.click_count) * 100).toFixed(1)
      : "0.0";
  const deliveryRate =
    data.sent_count > 0
      ? ((data.delivered_count / data.sent_count) * 100).toFixed(1)
      : "0.0";

  const summary = `"${data.campaign_name}" was sent to ${data.sent_count.toLocaleString()} recipients in the "${data.segment_name}" segment via ${data.channel}. It achieved a ${openRate}% open rate and ${clickRate}% click rate, generating ${data.conversion_count} conversions and $${data.revenue_attributed.toLocaleString()} in attributed revenue.`;

  const highlights: string[] = [];
  const concerns: string[] = [];

  if (parseFloat(openRate) >= 25) {
    highlights.push(`Strong open rate of ${openRate}% (above 25% benchmark)`);
  }
  if (parseFloat(clickRate) >= 3) {
    highlights.push(`Solid click rate of ${clickRate}% (above 3% benchmark)`);
  }
  if (data.conversion_count > 0) {
    highlights.push(
      `${data.conversion_count} conversions with ${conversionRate}% click-to-conversion rate`
    );
  }
  if (data.revenue_attributed > 0) {
    highlights.push(
      `$${data.revenue_attributed.toLocaleString()} revenue attributed`
    );
  }
  if (parseFloat(deliveryRate) >= 98) {
    highlights.push(`Excellent delivery rate of ${deliveryRate}%`);
  }

  if (parseFloat(openRate) < 15) {
    concerns.push(
      `Open rate of ${openRate}% is below the 15% minimum threshold \u2014 consider testing subject lines`
    );
  }
  if (parseFloat(bounceRate) > 3) {
    concerns.push(
      `Bounce rate of ${bounceRate}% exceeds 3% \u2014 review list hygiene`
    );
  }
  if (data.unsubscribe_count > 0) {
    const unsubRate =
      data.delivered_count > 0
        ? ((data.unsubscribe_count / data.delivered_count) * 100).toFixed(2)
        : "0.00";
    concerns.push(
      `${data.unsubscribe_count} unsubscribes (${unsubRate}%) \u2014 monitor content relevance`
    );
  }
  if (parseFloat(clickRate) < 1 && parseFloat(openRate) >= 15) {
    concerns.push(
      `Low click rate (${clickRate}%) despite decent opens \u2014 improve CTA placement or copy`
    );
  }

  if (highlights.length === 0) {
    highlights.push("Campaign delivered successfully");
  }
  if (concerns.length === 0) {
    concerns.push("No significant concerns detected");
  }

  let recommendation: string;
  if (parseFloat(openRate) < 15) {
    recommendation =
      "A/B test subject lines on the next campaign to improve open rates. Try personalization or urgency-based subjects.";
  } else if (parseFloat(clickRate) < 1) {
    recommendation =
      "Focus on improving click-through rates. Test different CTA button copy, placement, and offer clarity.";
  } else if (data.conversion_count === 0 && data.click_count > 0) {
    recommendation =
      "Clicks are happening but not converting. Review the landing page experience and simplify the conversion path.";
  } else {
    recommendation =
      "Campaign performed well. Replicate this approach for the next send and consider expanding the segment.";
  }

  return { summary, highlights, concerns, recommendation };
}
