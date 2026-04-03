/**
 * AI Recommendations — scheduling, pricing, retention, and general recommendations.
 *
 * Extracted from lib/anthropic.ts (MED-09).
 */
import { getAnthropicClient, AI_MODEL, extractText } from "@/lib/ai/client";

export interface RecommendationContext {
  type: "scheduling" | "pricing" | "retention" | "general";
  metrics: Record<string, unknown>;
}

/**
 * Generate AI-powered recommendations based on type.
 * Falls back to rules-based recommendations if ANTHROPIC_API_KEY is not set.
 */
export async function generateRecommendations(
  context: RecommendationContext
): Promise<string[]> {
  const anthropic = getAnthropicClient();
  if (!anthropic) {
    return generateRulesBasedRecommendations(context);
  }

  try {
    const systemPrompts: Record<string, string> = {
      scheduling:
        "You are Meridian AI. Analyze class scheduling data and provide 3-5 actionable recommendations to optimize the schedule. Focus on capacity utilization, popular time slots, and underperforming classes.",
      pricing:
        "You are Meridian AI. Analyze pricing and revenue data and provide 3-5 actionable recommendations to optimize pricing strategy. Focus on membership conversion, credit pack usage, and revenue per member.",
      retention:
        "You are Meridian AI. Analyze member retention data and provide 3-5 actionable recommendations to reduce churn. Focus on at-risk members, engagement patterns, and re-engagement strategies.",
      general:
        "You are Meridian AI. Analyze the studio's overall metrics and provide 3-5 actionable recommendations to improve operations. Cover scheduling, revenue, retention, and growth.",
    };

    const message = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 800,
      system: `${systemPrompts[context.type]} Return each recommendation as a separate line starting with a number and period (e.g. "1. "). Be specific and data-driven.`,
      messages: [
        {
          role: "user",
          content: `Generate recommendations based on this data:\n${JSON.stringify(context.metrics, null, 2)}`,
        },
      ],
    });

    const text = extractText(message);
    return text
      .split("\n")
      .filter((line) => /^\d+\./.test(line.trim()))
      .map((line) => line.trim());
  } catch (error) {
    console.error("Anthropic API error, falling back to rules-based:", error);
    return generateRulesBasedRecommendations(context);
  }
}

function generateRulesBasedRecommendations(
  context: RecommendationContext
): string[] {
  const recommendations: string[] = [];

  switch (context.type) {
    case "scheduling":
      recommendations.push(
        "1. Review classes with less than 50% capacity utilization \u2014 consider adjusting time slots or consolidating.",
        "2. Analyze peak booking times and ensure adequate staffing during high-demand periods.",
        "3. Consider adding a waitlist threshold alert to automatically open new class slots."
      );
      break;
    case "pricing":
      recommendations.push(
        "1. Compare revenue per member across membership tiers to identify the most profitable plans.",
        "2. Review credit pack expiration rates \u2014 high expiry rates may indicate pricing or communication issues.",
        "3. Consider introducing a limited-time upgrade promotion for members on lower-tier plans."
      );
      break;
    case "retention":
      recommendations.push(
        "1. Reach out to members who haven't checked in within 14 days with a personalized message.",
        "2. Identify members whose credit packs are expiring soon and send renewal reminders.",
        "3. Track first-month retention rate \u2014 the first 30 days are critical for long-term engagement.",
        "4. Consider implementing a referral bonus program to incentivize member advocacy."
      );
      break;
    case "general":
      recommendations.push(
        "1. Monitor daily capacity utilization trends to optimize class scheduling.",
        "2. Review at-risk member segments weekly and trigger automated re-engagement campaigns.",
        "3. Track trainer performance metrics to identify coaching and scheduling opportunities.",
        "4. Analyze revenue per class to identify your most and least profitable time slots."
      );
      break;
  }

  return recommendations;
}
