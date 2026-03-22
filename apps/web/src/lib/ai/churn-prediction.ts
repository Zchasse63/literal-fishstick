import { getAnthropicClient, AI_MODEL, extractText, parseAIJson } from "@/lib/ai/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChurnInput {
  member_id: string;
  full_name: string;
  membership_type: string | null;
  membership_status: string | null;
  join_date: string | null;
  days_since_last_visit: number;
  visit_trend: "increasing" | "stable" | "declining" | "stopped";
  visits_last_30d: number;
  visits_previous_30d: number;
  total_spend_90d: number;
  spend_trend: "increasing" | "stable" | "declining";
  late_cancellations_30d: number;
  no_shows_30d: number;
  credits_remaining: number;
  credits_expiring_soon: boolean;
  engagement_signals: string[]; // e.g., "opened last email", "referred a friend", "purchased merch"
}

export interface ChurnPredictionResult {
  churn_probability: number; // 0-100
  risk_level: "low" | "moderate" | "high" | "critical";
  narrative: string; // 3-5 sentence narrative explaining WHY they're at risk
  contributing_factors: {
    factor: string;
    weight: "high" | "medium" | "low";
  }[];
  recommended_interventions: {
    action: string;
    urgency: "immediate" | "this_week" | "this_month";
  }[];
  retention_playbook: "winback" | "re-engage" | "save" | "nurture";
}

// ---------------------------------------------------------------------------
// AI-powered churn prediction
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are Meridian AI, a churn prediction analyst for a fitness and wellness studio (sauna & cold plunge). Your job is to analyze a member's behavioral data and produce a personalized churn risk assessment.

Write a 3-5 sentence narrative explaining WHY this specific member is at risk (or not). Be data-driven but empathetic — reference their actual visit patterns, spending behavior, and engagement signals. Avoid generic platitudes; ground every observation in the data provided.

Return your response as a JSON object with exactly these fields:
- "churn_probability": number 0-100
- "risk_level": one of "low", "moderate", "high", "critical"
- "narrative": string (3-5 sentences)
- "contributing_factors": array of { "factor": string, "weight": "high" | "medium" | "low" }
- "recommended_interventions": array of { "action": string, "urgency": "immediate" | "this_week" | "this_month" }
- "retention_playbook": one of "winback", "re-engage", "save", "nurture"

Risk level mapping: 0-25 low, 26-50 moderate, 51-75 high, 76-100 critical.
Playbook mapping: critical -> winback, high -> save, moderate -> re-engage, low -> nurture.

Return ONLY the JSON object. No markdown fences, no extra text.`;

/**
 * Predict churn risk for a member using Claude, with a robust rules-based fallback.
 */
export async function predictChurn(
  input: ChurnInput
): Promise<ChurnPredictionResult> {
  const anthropic = getAnthropicClient();
  if (!anthropic) {
    return generateRulesBasedChurnPrediction(input);
  }

  try {
    const message = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Analyze churn risk for this member:\n${JSON.stringify(input, null, 2)}`,
        },
      ],
    });

    const parsed = parseAIJson<ChurnPredictionResult>(extractText(message));

    // Validate the response shape
    if (
      typeof parsed.churn_probability !== "number" ||
      !["low", "moderate", "high", "critical"].includes(parsed.risk_level) ||
      typeof parsed.narrative !== "string" ||
      !Array.isArray(parsed.contributing_factors) ||
      !Array.isArray(parsed.recommended_interventions) ||
      !["winback", "re-engage", "save", "nurture"].includes(
        parsed.retention_playbook
      )
    ) {
      console.error(
        "Invalid churn prediction response shape, falling back to rules-based"
      );
      return generateRulesBasedChurnPrediction(input);
    }

    // Clamp probability to 0-100
    parsed.churn_probability = Math.max(
      0,
      Math.min(100, Math.round(parsed.churn_probability))
    );

    return parsed;
  } catch (error) {
    console.error(
      "Anthropic API error for churn prediction, falling back to rules-based:",
      error
    );
    return generateRulesBasedChurnPrediction(input);
  }
}

// ---------------------------------------------------------------------------
// Rules-based fallback
// ---------------------------------------------------------------------------

function getRiskLevel(
  probability: number
): ChurnPredictionResult["risk_level"] {
  if (probability >= 76) return "critical";
  if (probability >= 51) return "high";
  if (probability >= 26) return "moderate";
  return "low";
}

function getRetentionPlaybook(
  riskLevel: ChurnPredictionResult["risk_level"]
): ChurnPredictionResult["retention_playbook"] {
  switch (riskLevel) {
    case "critical":
      return "winback";
    case "high":
      return "save";
    case "moderate":
      return "re-engage";
    case "low":
      return "nurture";
  }
}

function generateRulesBasedChurnPrediction(
  input: ChurnInput
): ChurnPredictionResult {
  // --- Calculate churn probability ---
  let probability = 20; // base
  const factors: {
    factor: string;
    weight: "high" | "medium" | "low";
    impact: number;
  }[] = [];

  if (input.visit_trend === "stopped") {
    probability += 30;
    factors.push({
      factor: "Visit activity has completely stopped",
      weight: "high",
      impact: 30,
    });
  } else if (input.visit_trend === "declining") {
    probability += 20;
    factors.push({
      factor: "Visit frequency is declining",
      weight: "high",
      impact: 20,
    });
  }

  if (input.days_since_last_visit > 30) {
    probability += 15;
    factors.push({
      factor: `No visit in ${input.days_since_last_visit} days (over 30 days)`,
      weight: "high",
      impact: 15,
    });
  } else if (input.days_since_last_visit > 14) {
    probability += 10;
    factors.push({
      factor: `No visit in ${input.days_since_last_visit} days (over 14 days)`,
      weight: "medium",
      impact: 10,
    });
  }

  if (input.late_cancellations_30d > 2) {
    probability += 10;
    factors.push({
      factor: `${input.late_cancellations_30d} late cancellations in the last 30 days`,
      weight: "medium",
      impact: 10,
    });
  }

  if (input.no_shows_30d > 1) {
    probability += 10;
    factors.push({
      factor: `${input.no_shows_30d} no-shows in the last 30 days`,
      weight: "medium",
      impact: 10,
    });
  }

  if (input.credits_expiring_soon) {
    probability += 5;
    factors.push({
      factor: "Credits expiring soon with no renewal activity",
      weight: "low",
      impact: 5,
    });
  }

  if (input.engagement_signals.length > 2) {
    probability -= 10;
    factors.push({
      factor: "Active engagement signals (email opens, referrals, purchases)",
      weight: "medium",
      impact: -10,
    });
  }

  if (input.spend_trend === "increasing") {
    probability -= 5;
    factors.push({
      factor: "Spending trend is increasing",
      weight: "low",
      impact: -5,
    });
  }

  // Clamp
  probability = Math.max(0, Math.min(100, probability));

  const riskLevel = getRiskLevel(probability);
  const playbook = getRetentionPlaybook(riskLevel);

  // Sort factors by absolute impact descending
  factors.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

  // --- Generate narrative ---
  const narrative = buildNarrative(input, riskLevel, factors);

  // --- Generate interventions ---
  const interventions = buildInterventions(riskLevel, input);

  return {
    churn_probability: probability,
    risk_level: riskLevel,
    narrative,
    contributing_factors: factors.map(({ factor, weight }) => ({
      factor,
      weight,
    })),
    recommended_interventions: interventions,
    retention_playbook: playbook,
  };
}

function buildNarrative(
  input: ChurnInput,
  riskLevel: ChurnPredictionResult["risk_level"],
  factors: { factor: string; impact: number }[]
): string {
  const name = input.full_name.split(" ")[0]; // first name
  const topNegative = factors.filter((f) => f.impact > 0).slice(0, 2);

  switch (riskLevel) {
    case "critical":
      return (
        `${name} is at critical risk of churning. ` +
        `They haven't visited in ${input.days_since_last_visit} days and their visit trend has ${input.visit_trend === "stopped" ? "completely stopped" : "been declining steadily"}. ` +
        (topNegative.length > 1
          ? `Key concerns include ${topNegative[0].factor.toLowerCase()} and ${topNegative[1].factor.toLowerCase()}. `
          : "") +
        `Immediate personal outreach is strongly recommended before this member disengages entirely.`
      );

    case "high":
      return (
        `${name} is showing significant warning signs of disengagement. ` +
        `Their visits have dropped from ${input.visits_previous_30d} in the prior 30-day period to ${input.visits_last_30d} recently. ` +
        (input.late_cancellations_30d > 0 || input.no_shows_30d > 0
          ? `There have been ${input.late_cancellations_30d} late cancellation(s) and ${input.no_shows_30d} no-show(s) in the last month, which often precedes churn. `
          : "") +
        `A proactive save attempt this week could prevent losing this member.`
      );

    case "moderate":
      return (
        `${name} is showing early signs that warrant monitoring. ` +
        `Visit frequency has shifted from ${input.visits_previous_30d} to ${input.visits_last_30d} sessions in the last 30 days. ` +
        (input.engagement_signals.length > 0
          ? `On the positive side, they've shown engagement through ${input.engagement_signals.slice(0, 2).join(" and ")}. `
          : `No recent engagement signals have been detected, which adds to the concern. `) +
        `A light-touch re-engagement within the month should help maintain their connection to the studio.`
      );

    case "low":
      return (
        `${name} appears to be a stable, engaged member with low churn risk. ` +
        `They've maintained ${input.visits_last_30d} visit(s) in the last 30 days` +
        (input.spend_trend === "increasing"
          ? " and their spending is trending upward. "
          : ". ") +
        `Continue nurturing this relationship through regular communication and recognition.`
      );
  }
}

function buildInterventions(
  riskLevel: ChurnPredictionResult["risk_level"],
  input: ChurnInput
): ChurnPredictionResult["recommended_interventions"] {
  switch (riskLevel) {
    case "critical":
      return [
        {
          action:
            "Personal phone call or direct message from studio owner/manager",
          urgency: "immediate",
        },
        {
          action:
            "Offer a complimentary session or special win-back incentive",
          urgency: "immediate",
        },
        {
          action:
            "Review membership plan — consider offering a pause instead of cancellation",
          urgency: "this_week",
        },
      ];

    case "high":
      return [
        {
          action: "Send a personalized email with a special offer or class recommendation",
          urgency: "immediate",
        },
        {
          action:
            input.credits_remaining > 0
              ? `Remind them about their ${input.credits_remaining} unused credits before they expire`
              : "Suggest a class pack or trial offer to re-establish the habit",
          urgency: "this_week",
        },
        {
          action:
            "Schedule a check-in to understand any barriers to visiting",
          urgency: "this_week",
        },
      ];

    case "moderate":
      return [
        {
          action:
            "Send a friendly check-in email highlighting new classes or upcoming events",
          urgency: "this_week",
        },
        {
          action:
            "Add to a re-engagement automation campaign if not already enrolled",
          urgency: "this_week",
        },
        {
          action:
            "Monitor visit frequency over the next two weeks for further decline",
          urgency: "this_month",
        },
      ];

    case "low":
      return [
        {
          action:
            "Include in referral program outreach — engaged members are the best advocates",
          urgency: "this_month",
        },
        {
          action:
            "Consider for membership upgrade suggestion if on a limited plan",
          urgency: "this_month",
        },
      ];
  }
}
