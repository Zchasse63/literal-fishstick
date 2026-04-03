/**
 * AI Lead Scoring — score leads based on engagement data.
 *
 * Extracted from lib/anthropic.ts (MED-09).
 */
import { getAnthropicClient, AI_MODEL, extractText } from "@/lib/ai/client";

export interface LeadScoreInput {
  lead_id: string;
  first_name: string;
  email: string;
  phone: string | null;
  source: string;
  days_since_created: number;
  activity_count_7d: number;
  activity_count_30d: number;
  emails_opened: number;
  emails_clicked: number;
  trial_booked: boolean;
  source_detail: string | null;
}

export interface LeadScoreResult {
  score: number;
  factors: string[];
  recommended_action: string;
  priority: "hot" | "warm" | "cold";
}

/**
 * Score a lead using AI analysis of their engagement data.
 * Falls back to rules-based scoring if ANTHROPIC_API_KEY is not set.
 */
export async function scoreLead(
  leadData: LeadScoreInput
): Promise<LeadScoreResult> {
  const anthropic = getAnthropicClient();
  if (!anthropic) {
    return generateRulesBasedLeadScore(leadData);
  }

  try {
    const message = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 600,
      system:
        "You are Meridian AI. Score a lead (0-100) for a fitness/wellness studio based on their engagement data. Score meaning: 70-100 hot (ready to convert), 40-69 warm (engaged but needs nurturing), 0-39 cold (low engagement). Return JSON with: score (number 0-100), factors (array of strings explaining key scoring factors), recommended_action (string with specific next step), priority ('hot' | 'warm' | 'cold'). Return ONLY the JSON object, no markdown fences.",
      messages: [
        {
          role: "user",
          content: `Score this lead:\n${JSON.stringify(leadData, null, 2)}`,
        },
      ],
    });

    const text = extractText(message);
    const jsonStr = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    const parsed = JSON.parse(jsonStr) as LeadScoreResult;

    if (
      typeof parsed.score !== "number" ||
      !Array.isArray(parsed.factors) ||
      !["hot", "warm", "cold"].includes(parsed.priority)
    ) {
      throw new Error("Invalid lead score response shape");
    }

    parsed.score = Math.max(0, Math.min(100, Math.round(parsed.score)));

    return parsed;
  } catch (error) {
    console.error(
      "Anthropic API error for lead scoring, falling back to rules-based:",
      error
    );
    return generateRulesBasedLeadScore(leadData);
  }
}

function generateRulesBasedLeadScore(
  leadData: LeadScoreInput
): LeadScoreResult {
  let score = 30;
  const factors: string[] = [];

  // Source weight
  const highValueSources = ["referral", "google", "instagram"];
  const mediumValueSources = ["website", "walk-in", "event"];
  if (highValueSources.includes(leadData.source.toLowerCase())) {
    score += 15;
    factors.push(`High-value source: ${leadData.source}`);
  } else if (mediumValueSources.includes(leadData.source.toLowerCase())) {
    score += 8;
    factors.push(`Medium-value source: ${leadData.source}`);
  }

  // Activity weight
  if (leadData.activity_count_7d >= 3) {
    score += 20;
    factors.push(`High recent activity: ${leadData.activity_count_7d} actions in 7 days`);
  } else if (leadData.activity_count_7d >= 1) {
    score += 10;
    factors.push(`Some recent activity: ${leadData.activity_count_7d} actions in 7 days`);
  }

  if (leadData.activity_count_30d >= 5) {
    score += 10;
    factors.push(`Strong 30-day engagement: ${leadData.activity_count_30d} actions`);
  }

  // Email engagement weight
  if (leadData.emails_clicked > 0) {
    score += 15;
    factors.push(`Email click-through: ${leadData.emails_clicked} clicks`);
  } else if (leadData.emails_opened > 0) {
    score += 5;
    factors.push(`Email opens: ${leadData.emails_opened} opened`);
  }

  // Trial booked is a strong signal
  if (leadData.trial_booked) {
    score += 20;
    factors.push("Trial session booked \u2014 high intent");
  }

  // Phone provided
  if (leadData.phone) {
    score += 5;
    factors.push("Phone number provided");
  }

  // Recency decay
  if (leadData.days_since_created > 30) {
    score -= 10;
    factors.push(`Lead aging: ${leadData.days_since_created} days old`);
  } else if (leadData.days_since_created > 14) {
    score -= 5;
    factors.push(`Lead created ${leadData.days_since_created} days ago`);
  }

  score = Math.max(0, Math.min(100, score));

  const priority: LeadScoreResult["priority"] =
    score >= 70 ? "hot" : score >= 40 ? "warm" : "cold";

  let recommendedAction: string;
  if (priority === "hot") {
    recommendedAction =
      "Reach out directly \u2014 this lead is ready to convert. Offer a trial session or membership consultation.";
  } else if (priority === "warm") {
    recommendedAction =
      "Nurture with targeted content. Send a personalized email highlighting class options and member benefits.";
  } else {
    recommendedAction =
      "Add to drip campaign. Monitor for engagement signals before personal outreach.";
  }

  return { score, factors, recommended_action: recommendedAction, priority };
}
