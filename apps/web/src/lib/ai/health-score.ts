/**
 * AI Health Score — member engagement health scoring.
 *
 * Extracted from lib/anthropic.ts (MED-09).
 */
import { getAnthropicClient, AI_MODEL, extractText } from "@/lib/ai/client";

export interface HealthScoreInput {
  member_id: string;
  full_name: string;
  membership_type: string | null;
  membership_status: string | null;
  join_date: string | null;
  total_visits_30d: number;
  total_visits_90d: number;
  avg_visits_per_week: number;
  days_since_last_visit: number;
  total_spend_90d: number;
  credits_remaining: number;
  credits_expiring_7d: number;
  cancellation_rate: number;
  no_show_rate: number;
}

export interface HealthScoreResult {
  score: number;
  risk_level: "healthy" | "watch" | "at_risk" | "critical";
  narrative: string;
  top_factors: string[];
  recommended_action: string;
}

/**
 * Generate a member health score using Claude, with a robust rules-based fallback.
 */
export async function generateHealthScore(
  input: HealthScoreInput
): Promise<HealthScoreResult> {
  const anthropic = getAnthropicClient();
  if (!anthropic) {
    return generateRulesBasedHealthScore(input);
  }

  try {
    const message = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 600,
      system:
        "You are Meridian AI. Calculate a health score (0-100) for a fitness studio member based on their engagement data. Score meaning: 80-100 healthy, 60-79 watch, 40-59 at_risk, 0-39 critical. Provide a brief narrative explanation and recommended action. Return JSON only with keys: score (number), risk_level (string), narrative (string), top_factors (array of 3 strings), recommended_action (string). No markdown fences.",
      messages: [
        {
          role: "user",
          content: `Calculate health score for this member:\n${JSON.stringify(input, null, 2)}`,
        },
      ],
    });

    const text = extractText(message);
    const jsonStr = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    const parsed = JSON.parse(jsonStr) as HealthScoreResult;

    if (
      typeof parsed.score !== "number" ||
      !["healthy", "watch", "at_risk", "critical"].includes(
        parsed.risk_level
      ) ||
      typeof parsed.narrative !== "string" ||
      !Array.isArray(parsed.top_factors) ||
      typeof parsed.recommended_action !== "string"
    ) {
      console.error(
        "Invalid health score response shape, falling back to rules-based"
      );
      return generateRulesBasedHealthScore(input);
    }

    parsed.score = Math.max(0, Math.min(100, Math.round(parsed.score)));

    return parsed;
  } catch (error) {
    console.error(
      "Anthropic API error for health score, falling back to rules-based:",
      error
    );
    return generateRulesBasedHealthScore(input);
  }
}

function getHealthRiskLevel(
  score: number
): HealthScoreResult["risk_level"] {
  if (score >= 80) return "healthy";
  if (score >= 60) return "watch";
  if (score >= 40) return "at_risk";
  return "critical";
}

function generateRulesBasedHealthScore(
  input: HealthScoreInput
): HealthScoreResult {
  let score = 50;
  const factors: { label: string; impact: number }[] = [];

  // Visit frequency
  if (input.avg_visits_per_week >= 2) {
    score += 20;
    factors.push({ label: "Strong visit frequency (2+/week)", impact: 20 });
  } else if (input.avg_visits_per_week >= 1) {
    score += 10;
    factors.push({
      label: "Moderate visit frequency (1+/week)",
      impact: 10,
    });
  } else if (
    input.avg_visits_per_week < 0.5 &&
    input.avg_visits_per_week > 0
  ) {
    score -= 10;
    factors.push({
      label: "Low visit frequency (<0.5/week)",
      impact: -10,
    });
  } else if (input.avg_visits_per_week === 0) {
    score -= 20;
    factors.push({ label: "No visits recorded", impact: -20 });
  }

  // Recency
  const recencyPenalty = Math.min(
    30,
    Math.floor(input.days_since_last_visit / 7) * 5
  );
  if (recencyPenalty > 0) {
    score -= recencyPenalty;
    factors.push({
      label: `${input.days_since_last_visit} days since last visit`,
      impact: -recencyPenalty,
    });
  }

  // Spend
  if (input.total_spend_90d > 300) {
    score += 10;
    factors.push({ label: "High 90-day spending (>$300)", impact: 10 });
  } else if (input.total_spend_90d > 150) {
    score += 5;
    factors.push({
      label: "Moderate 90-day spending (>$150)",
      impact: 5,
    });
  }

  // Cancellation rate
  if (input.cancellation_rate > 0.3) {
    score -= 10;
    factors.push({
      label: "High cancellation rate (>30%)",
      impact: -10,
    });
  } else if (input.cancellation_rate > 0.15) {
    score -= 5;
    factors.push({
      label: "Elevated cancellation rate (>15%)",
      impact: -5,
    });
  }

  // No-show rate
  if (input.no_show_rate > 0.2) {
    score -= 15;
    factors.push({ label: "High no-show rate (>20%)", impact: -15 });
  } else if (input.no_show_rate > 0.1) {
    score -= 5;
    factors.push({ label: "Elevated no-show rate (>10%)", impact: -5 });
  }

  // Credits expiring
  if (input.credits_expiring_7d > 0) {
    score -= 5;
    factors.push({
      label: `${input.credits_expiring_7d} credits expiring within 7 days`,
      impact: -5,
    });
  }

  // Clamp
  score = Math.max(0, Math.min(100, score));

  // Sort factors by absolute impact descending, take top 3
  factors.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
  const topFactors = factors.slice(0, 3).map((f) => f.label);

  // Fill to 3 if fewer factors
  while (topFactors.length < 3) {
    topFactors.push("Baseline engagement level");
  }

  const riskLevel = getHealthRiskLevel(score);

  // Generate narrative
  let narrative: string;
  if (riskLevel === "healthy") {
    narrative = `${input.full_name} is highly engaged with consistent visit patterns and strong studio commitment. This member is a retention success story.`;
  } else if (riskLevel === "watch") {
    narrative = `${input.full_name} shows moderate engagement but there are early signs that attention may be needed. Monitor visit frequency and spending trends over the next few weeks.`;
  } else if (riskLevel === "at_risk") {
    narrative = `${input.full_name} is showing declining engagement with reduced visits or concerning behavioral patterns. Proactive outreach is recommended before this member churns.`;
  } else {
    narrative = `${input.full_name} is at critical risk of churning. Engagement has dropped significantly and immediate intervention is recommended.`;
  }

  // Generate recommended action
  let recommendedAction: string;
  if (riskLevel === "healthy") {
    recommendedAction =
      "No immediate action needed. Consider for referral program or testimonial.";
  } else if (riskLevel === "watch") {
    recommendedAction =
      "Send a personalized check-in message. Highlight upcoming classes that match their interests.";
  } else if (riskLevel === "at_risk") {
    recommendedAction =
      "Trigger a re-engagement campaign \u2014 offer a complimentary session or schedule a personal outreach call.";
  } else {
    recommendedAction =
      "Immediate personal outreach required. Consider a win-back offer or direct phone call from the studio owner.";
  }

  return {
    score,
    risk_level: riskLevel,
    narrative,
    top_factors: topFactors,
    recommended_action: recommendedAction,
  };
}
