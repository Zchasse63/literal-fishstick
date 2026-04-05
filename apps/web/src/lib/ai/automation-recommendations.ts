/**
 * AI Automation Recommendations — suggest marketing automations for studios.
 *
 * Extracted from lib/anthropic.ts (MED-09).
 */
import { getAnthropicClient, AI_MODEL, extractText, withRetry } from "@/lib/ai/client";

export interface AutomationRecommendationInput {
  active_members: number;
  at_risk_members: number;
  new_members_30d: number;
  avg_visits_per_week: number;
  churn_rate_30d: number;
  active_automations: string[];
  revenue_mtd: number;
}

export interface AutomationRecommendation {
  name: string;
  trigger_type: string;
  description: string;
  estimated_impact: string;
  priority: "high" | "medium" | "low";
}

/**
 * Recommend marketing automations based on studio data and current automation state.
 * Falls back to rules-based recommendations if ANTHROPIC_API_KEY is not set.
 */
export async function recommendAutomations(
  studioData: AutomationRecommendationInput
): Promise<AutomationRecommendation[]> {
  const anthropic = getAnthropicClient();
  if (!anthropic) {
    return generateRulesBasedAutomationRecommendations(studioData);
  }

  try {
    const message = await withRetry(() => anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 800,
      system:
        "You are Meridian AI. Recommend marketing automations for a fitness/wellness studio based on their metrics and current automation setup. Prioritize automations that address the biggest gaps. Return a JSON array of objects with: name (string), trigger_type (string like 'event-based', 'time-based', 'threshold-based'), description (string), estimated_impact (string describing expected outcome), priority ('high' | 'medium' | 'low'). Return ONLY the JSON array, no markdown fences.",
      messages: [
        {
          role: "user",
          content: `Recommend automations for this studio:\n${JSON.stringify(studioData, null, 2)}`,
        },
      ],
    }));

    const text = extractText(message);
    const jsonStr = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    const parsed = JSON.parse(jsonStr) as AutomationRecommendation[];

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error("Invalid automation recommendations response shape");
    }

    return parsed;
  } catch (error) {
    console.error(
      "Anthropic API error for automation recommendations, falling back to rules-based:",
      error
    );
    return generateRulesBasedAutomationRecommendations(studioData);
  }
}

function generateRulesBasedAutomationRecommendations(
  studioData: AutomationRecommendationInput
): AutomationRecommendation[] {
  const recommendations: AutomationRecommendation[] = [];
  const activeSet = new Set(
    studioData.active_automations.map((a) => a.toLowerCase())
  );

  // Core 4 automations -- recommend any that aren't active
  if (!activeSet.has("welcome series") && !activeSet.has("welcome")) {
    recommendations.push({
      name: "Welcome Series",
      trigger_type: "event-based",
      description:
        "Automatically send a 3-email welcome sequence when a new member joins. Includes studio intro, first visit tips, and a check-in after their first week.",
      estimated_impact: `With ${studioData.new_members_30d} new members in the last 30 days, a welcome series can improve first-month retention by 15-25%.`,
      priority: "high",
    });
  }

  if (!activeSet.has("win-back") && !activeSet.has("winback") && !activeSet.has("re-engagement")) {
    const urgency = studioData.at_risk_members > studioData.active_members * 0.1 ? "high" : "medium";
    recommendations.push({
      name: "Win-Back Campaign",
      trigger_type: "threshold-based",
      description:
        "Trigger a re-engagement email when a member hasn't visited in 14+ days. Escalate to a personal outreach task at 30+ days.",
      estimated_impact: `${studioData.at_risk_members} members are currently at risk. Win-back automations typically recover 10-15% of lapsed members.`,
      priority: urgency,
    });
  }

  if (!activeSet.has("failed payment") && !activeSet.has("dunning") && !activeSet.has("payment recovery")) {
    recommendations.push({
      name: "Failed Payment Recovery",
      trigger_type: "event-based",
      description:
        "Send an automated email when a recurring payment fails. Follow up at 3, 7, and 14 days with escalating urgency. Pause membership after 14 days.",
      estimated_impact:
        "Automated dunning recovers 30-50% of failed payments that would otherwise churn. Protects recurring revenue.",
      priority: "high",
    });
  }

  if (!activeSet.has("churn prevention") && !activeSet.has("churn")) {
    const urgency = studioData.churn_rate_30d > 0.05 ? "high" : "medium";
    recommendations.push({
      name: "Churn Prevention",
      trigger_type: "threshold-based",
      description:
        "Monitor member health scores and trigger personalized outreach when a member's score drops below 40. Include special offers or personal check-ins.",
      estimated_impact: `Current 30-day churn rate is ${(studioData.churn_rate_30d * 100).toFixed(1)}%. Proactive churn prevention can reduce churn by 20-30%.`,
      priority: urgency,
    });
  }

  // Additional recommendations based on studio data
  if (recommendations.length < 3) {
    if (!activeSet.has("milestone") && !activeSet.has("celebration")) {
      recommendations.push({
        name: "Milestone Celebrations",
        trigger_type: "threshold-based",
        description:
          "Automatically congratulate members at key milestones: 10th visit, 50th visit, 1-year anniversary. Include a small reward or social share prompt.",
        estimated_impact:
          "Milestone emails have 2-3x higher engagement than standard campaigns and reinforce long-term commitment.",
        priority: "low",
      });
    }

    if (!activeSet.has("referral") && !activeSet.has("refer a friend")) {
      recommendations.push({
        name: "Referral Prompt",
        trigger_type: "time-based",
        description:
          "Send a referral prompt to highly engaged members (health score 80+) after their 5th visit. Include a shareable link or promo code.",
        estimated_impact:
          "Referred members have 25% higher retention. Automating referral asks at peak engagement maximizes conversion.",
        priority: "medium",
      });
    }
  }

  return recommendations;
}
