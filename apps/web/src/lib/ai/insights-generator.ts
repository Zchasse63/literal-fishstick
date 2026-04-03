import { getAnthropicClient, AI_MODEL, extractText, parseAIJson } from "@/lib/ai/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClassMetrics {
  class_name: string;
  avg_fill_rate: number; // 0-100
  total_bookings: number;
  trend: "increasing" | "stable" | "declining";
}

export interface StudioMetricsContext {
  studio_id: string;
  period_start: string; // ISO date
  period_end: string; // ISO date
  revenue_current_30d: number;
  revenue_previous_30d: number;
  revenue_trend: "increasing" | "stable" | "declining";
  new_members_30d: number;
  churned_members_30d: number;
  total_active_members: number;
  churn_rate_pct: number;
  avg_class_fill_rate: number; // 0-100
  top_classes: ClassMetrics[];
  bottom_classes: ClassMetrics[];
  avg_revenue_per_member: number;
  outstanding_payments: number;
  merch_revenue_30d: number;
  drop_in_revenue_30d: number;
}

export interface AIInsight {
  fingerprint: string;
  title: string;
  summary: string;
  recommended_action: string;
  action_url: string;
  urgency: "low" | "medium" | "high" | "critical";
  insight_type:
    | "revenue"
    | "churn"
    | "engagement"
    | "scheduling"
    | "growth"
    | "operational";
}

// ---------------------------------------------------------------------------
// Fingerprint helper
// ---------------------------------------------------------------------------

function generateFingerprint(type: string, key: string): string {
  const str = `${type}:${key}`.toLowerCase().replace(/\s+/g, "_");
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return `ins_${Math.abs(hash).toString(36)}`;
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are Meridian AI, an insights analyst for a fitness and wellness studio (sauna & cold plunge). Your job is to analyze a 30-day metrics snapshot and generate 3-8 prioritized, actionable insights.

Each insight must be specific, data-driven, and tied to a concrete recommended action. Avoid vague advice — reference actual numbers and trends from the data provided.

Return your response as a JSON array of insight objects, each with exactly these fields:
- "fingerprint": a short deterministic string combining the insight_type and the key metric value that triggered it (e.g., "churn_rate_7.2" or "fill_rate_low_45"). This is used for dedup.
- "title": a concise headline (under 60 characters)
- "summary": 2-3 sentence explanation grounded in the data
- "recommended_action": a specific next step the studio should take
- "action_url": a relative URL to the relevant Meridian page (e.g., "/members?segment=at-risk", "/schedule", "/revenue/pricing", "/marketing/campaigns")
- "urgency": one of "low", "medium", "high", "critical"
- "insight_type": one of "revenue", "churn", "engagement", "scheduling", "growth", "operational"

Sort by urgency descending (critical first). Return ONLY the JSON array. No markdown fences, no extra text.`;

// ---------------------------------------------------------------------------
// Generate insights from studio metrics
// ---------------------------------------------------------------------------

/**
 * Generate prioritized AI insights from a studio metrics snapshot.
 */
export async function generateInsights(
  context: StudioMetricsContext
): Promise<AIInsight[]> {
  const anthropic = getAnthropicClient();
  if (!anthropic) {
    return generateRulesBasedInsights(context);
  }

  try {

    const message = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Generate insights from this studio metrics snapshot:\n${JSON.stringify(context, null, 2)}`,
        },
      ],
    });

    const text = extractText(message);

    const jsonStr = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    let parsed: AIInsight[];
    try {
      parsed = JSON.parse(jsonStr) as AIInsight[];
    } catch (parseError) {
      console.error("Failed to parse AI insights JSON, falling back to rules-based:", parseError);
      return generateRulesBasedInsights(context);
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      console.error(
        "Invalid insights response shape, falling back to rules-based"
      );
      return generateRulesBasedInsights(context);
    }

    // Validate each insight has required fields
    for (const insight of parsed) {
      if (
        typeof insight.fingerprint !== "string" ||
        typeof insight.title !== "string" ||
        typeof insight.summary !== "string" ||
        typeof insight.recommended_action !== "string" ||
        typeof insight.action_url !== "string" ||
        !["low", "medium", "high", "critical"].includes(insight.urgency) ||
        ![
          "revenue",
          "churn",
          "engagement",
          "scheduling",
          "growth",
          "operational",
        ].includes(insight.insight_type)
      ) {
        console.error(
          "Malformed insight detected, falling back to rules-based"
        );
        return generateRulesBasedInsights(context);
      }
    }

    return parsed;
  } catch (error) {
    console.error(
      "Anthropic API error for insights generation, falling back to rules-based:",
      error
    );
    return generateRulesBasedInsights(context);
  }
}

// ---------------------------------------------------------------------------
// Rules-based fallback
// ---------------------------------------------------------------------------

function generateRulesBasedInsights(
  context: StudioMetricsContext
): AIInsight[] {
  const insights: AIInsight[] = [];

  // Churn rate check
  if (context.churn_rate_pct > 5) {
    insights.push({
      fingerprint: generateFingerprint(
        "churn",
        `rate_${context.churn_rate_pct.toFixed(1)}`
      ),
      title: "Churn rate is above healthy threshold",
      summary: `Your 30-day churn rate is ${context.churn_rate_pct.toFixed(1)}%, which exceeds the 5% benchmark. You lost ${context.churned_members_30d} members this period. This trend needs immediate attention to protect recurring revenue.`,
      recommended_action:
        "Review at-risk member segments and launch a targeted retention campaign.",
      action_url: "/members?segment=at-risk",
      urgency: context.churn_rate_pct > 10 ? "critical" : "high",
      insight_type: "churn",
    });
  }

  // Fill rate check
  if (context.avg_class_fill_rate < 60) {
    insights.push({
      fingerprint: generateFingerprint(
        "scheduling",
        `fill_rate_${Math.round(context.avg_class_fill_rate)}`
      ),
      title: "Average class fill rate needs improvement",
      summary: `Classes are averaging ${Math.round(context.avg_class_fill_rate)}% fill rate over the last 30 days. Nearly ${Math.round(100 - context.avg_class_fill_rate)}% of capacity is going unused. Consider adjusting your schedule or running promotions for underperforming time slots.`,
      recommended_action:
        "Review bottom-performing classes and consider consolidating or promoting them.",
      action_url: "/schedule",
      urgency: context.avg_class_fill_rate < 40 ? "high" : "medium",
      insight_type: "scheduling",
    });
  }

  // Revenue decline
  if (context.revenue_trend === "declining") {
    const delta = context.revenue_current_30d - context.revenue_previous_30d;
    const pctChange =
      context.revenue_previous_30d > 0
        ? ((delta / context.revenue_previous_30d) * 100).toFixed(1)
        : "N/A";
    insights.push({
      fingerprint: generateFingerprint("revenue", `declining_${pctChange}`),
      title: "Revenue is trending downward",
      summary: `Revenue dropped from $${context.revenue_previous_30d.toLocaleString()} to $${context.revenue_current_30d.toLocaleString()} (${pctChange}% change). This may be seasonal or could indicate pricing or retention issues that need investigation.`,
      recommended_action:
        "Analyze revenue breakdown by source (memberships, drop-ins, merch) to identify the primary driver of the decline.",
      action_url: "/revenue",
      urgency: "high",
      insight_type: "revenue",
    });
  }

  // Growth opportunity
  if (context.new_members_30d > context.churned_members_30d * 1.5) {
    insights.push({
      fingerprint: generateFingerprint(
        "growth",
        `positive_${context.new_members_30d}`
      ),
      title: "Strong new member acquisition",
      summary: `You added ${context.new_members_30d} new members against ${context.churned_members_30d} churned — a healthy growth ratio. Focus on onboarding these new members well to ensure they stick past the 30-day mark.`,
      recommended_action:
        "Ensure new member onboarding automation is active and consider a welcome campaign.",
      action_url: "/marketing/campaigns",
      urgency: "low",
      insight_type: "growth",
    });
  }

  // Outstanding payments
  if (context.outstanding_payments > 500) {
    insights.push({
      fingerprint: generateFingerprint(
        "operational",
        `outstanding_${Math.round(context.outstanding_payments)}`
      ),
      title: "Outstanding payments require attention",
      summary: `There are $${context.outstanding_payments.toLocaleString()} in outstanding payments. Unresolved payment issues can lead to involuntary churn and revenue leakage.`,
      recommended_action:
        "Review failed payments and trigger dunning sequences for overdue accounts.",
      action_url: "/revenue/transactions?status=failed",
      urgency: context.outstanding_payments > 2000 ? "high" : "medium",
      insight_type: "operational",
    });
  }

  // Ensure at least 3 insights
  if (insights.length < 3) {
    if (!insights.find((i) => i.insight_type === "engagement")) {
      insights.push({
        fingerprint: generateFingerprint(
          "engagement",
          `arpm_${context.avg_revenue_per_member.toFixed(0)}`
        ),
        title: "Review average revenue per member",
        summary: `Your ARPM is $${context.avg_revenue_per_member.toFixed(2)} across ${context.total_active_members} active members. Look for opportunities to increase this through merch, class packs, or membership upgrades.`,
        recommended_action:
          "Identify members on lower-tier plans who could benefit from an upgrade offer.",
        action_url: "/revenue/pricing",
        urgency: "low",
        insight_type: "engagement",
      });
    }
    if (insights.length < 3) {
      insights.push({
        fingerprint: generateFingerprint(
          "revenue",
          `merch_${context.merch_revenue_30d.toFixed(0)}`
        ),
        title: "Merchandise revenue snapshot",
        summary: `Merch brought in $${context.merch_revenue_30d.toLocaleString()} over the last 30 days. ${context.merch_revenue_30d < 200 ? "This is relatively low — consider promoting retail items to your active member base." : "Keep promoting popular items and consider expanding your product line."}`,
        recommended_action:
          "Feature top-selling merch in your next email campaign.",
        action_url: "/marketing/content",
        urgency: "low",
        insight_type: "revenue",
      });
    }
  }

  // Sort by urgency
  const urgencyOrder: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  insights.sort(
    (a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
  );

  return insights;
}
