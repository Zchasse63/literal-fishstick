import { getAnthropicClient, AI_MODEL, extractText, parseAIJson } from "@/lib/ai/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlanSnapshot {
  plan_id: string;
  plan_name: string;
  current_price: number;
  subscriber_count: number;
  mrr_contribution: number;
}

export interface PriceChange {
  plan_id: string;
  plan_name: string;
  current_price: number;
  proposed_price: number;
}

export interface RevenueMonth {
  month: string; // YYYY-MM
  total_revenue: number;
  membership_revenue: number;
}

export interface PricingScenarioInput {
  studio_id: string;
  plans: PlanSnapshot[];
  proposed_changes: PriceChange[];
  revenue_history: RevenueMonth[]; // 12 months
}

export interface SensitivityPoint {
  label: string; // e.g., "-20%", "-10%", "proposed", "+10%", "+20%"
  price_multiplier: number;
  projected_mrr: number;
  projected_churn_pct: number;
}

export interface PricingAnalysis {
  monthly_revenue_delta: number;
  monthly_revenue_delta_pct: number;
  projected_mrr: number;
  projected_annual_revenue: number;
  churn_risk_increase_pct: number;
  churn_risk_level: "low" | "moderate" | "high";
  upgrade_predictions: {
    plan_name: string;
    expected_upgrades: number;
    expected_downgrades: number;
  }[];
  narrative: string; // 3-5 sentences
  sensitivity: SensitivityPoint[];
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are Meridian AI, a pricing strategist for a fitness and wellness studio (sauna & cold plunge). Analyze a proposed pricing change scenario and project its revenue impact.

You will receive:
- Current plan details with prices and subscriber counts
- Proposed price changes
- 12-month revenue history for trend context

Return your response as a JSON object with exactly these fields:
- "monthly_revenue_delta": number (projected monthly revenue change in dollars, positive or negative)
- "monthly_revenue_delta_pct": number (percentage change)
- "projected_mrr": number (projected new MRR after changes settle)
- "projected_annual_revenue": number (projected annual based on new MRR)
- "churn_risk_increase_pct": number (estimated percentage point increase in churn due to price change)
- "churn_risk_level": one of "low", "moderate", "high"
- "upgrade_predictions": array of { "plan_name": string, "expected_upgrades": number, "expected_downgrades": number } for each affected plan
- "narrative": string (3-5 sentences analyzing the pricing scenario with specific numbers and reasoning)
- "sensitivity": array of 5 objects with { "label": string, "price_multiplier": number, "projected_mrr": number, "projected_churn_pct": number } for -20%, -10%, proposed, +10%, +20% price points

Be realistic about churn elasticity in fitness studios — price increases over 15% typically see 5-10% churn. Factor in the revenue history trend when projecting.

Return ONLY the JSON object. No markdown fences, no extra text.`;

// ---------------------------------------------------------------------------
// Analyze pricing scenario
// ---------------------------------------------------------------------------

/**
 * Analyze a pricing scenario using Claude, with a rules-based fallback.
 */
export async function analyzePricingScenario(
  scenario: PricingScenarioInput
): Promise<PricingAnalysis> {
  const anthropic = getAnthropicClient();
  if (!anthropic) {
    return generateRulesBasedAnalysis(scenario);
  }

  try {

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Analyze this pricing scenario:\n${JSON.stringify(scenario, null, 2)}`,
        },
      ],
    });

    const text = extractText(message);

    const jsonStr = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    let parsed: PricingAnalysis;
    try {
      parsed = JSON.parse(jsonStr) as PricingAnalysis;
    } catch (parseError) {
      console.error("Failed to parse pricing analysis JSON, falling back to rules-based:", parseError);
      return generateRulesBasedAnalysis(scenario);
    }

    // Validate shape
    if (
      typeof parsed.monthly_revenue_delta !== "number" ||
      typeof parsed.projected_mrr !== "number" ||
      typeof parsed.narrative !== "string" ||
      !Array.isArray(parsed.sensitivity) ||
      !["low", "moderate", "high"].includes(parsed.churn_risk_level)
    ) {
      console.error(
        "Invalid pricing analysis response shape, falling back to rules-based"
      );
      return generateRulesBasedAnalysis(scenario);
    }

    return parsed;
  } catch (error) {
    console.error(
      "Anthropic API error for pricing analysis, falling back to rules-based:",
      error
    );
    return generateRulesBasedAnalysis(scenario);
  }
}

// ---------------------------------------------------------------------------
// Rules-based fallback
// ---------------------------------------------------------------------------

function generateRulesBasedAnalysis(
  scenario: PricingScenarioInput
): PricingAnalysis {
  const currentMRR = scenario.plans.reduce(
    (sum, p) => sum + p.mrr_contribution,
    0
  );

  // Calculate new MRR based on proposed changes
  let projectedMRR = currentMRR;
  const upgradePredictions: PricingAnalysis["upgrade_predictions"] = [];

  for (const change of scenario.proposed_changes) {
    const plan = scenario.plans.find((p) => p.plan_id === change.plan_id);
    if (!plan) continue;

    const priceDelta = change.proposed_price - change.current_price;
    const pctChange =
      change.current_price > 0
        ? (priceDelta / change.current_price) * 100
        : 0;

    // Estimate churn: 2% churn increase per 10% price increase
    const estimatedChurnPct = Math.max(0, (pctChange / 10) * 2);
    const estimatedChurnedSubs = Math.round(
      plan.subscriber_count * (estimatedChurnPct / 100)
    );
    const remainingSubs = plan.subscriber_count - estimatedChurnedSubs;

    // Revenue from remaining subscribers at new price
    const oldContribution = plan.mrr_contribution;
    const newContribution = remainingSubs * change.proposed_price;
    projectedMRR += newContribution - oldContribution;

    // Estimate downgrades for price increases, upgrades for decreases
    const downgrades =
      pctChange > 0 ? Math.round(plan.subscriber_count * 0.03) : 0;
    const upgrades =
      pctChange < 0 ? Math.round(plan.subscriber_count * 0.02) : 0;

    upgradePredictions.push({
      plan_name: change.plan_name,
      expected_upgrades: upgrades,
      expected_downgrades: downgrades,
    });
  }

  const monthlyDelta = projectedMRR - currentMRR;
  const monthlyDeltaPct =
    currentMRR > 0 ? (monthlyDelta / currentMRR) * 100 : 0;

  // Overall churn risk
  const avgPriceChangePct =
    scenario.proposed_changes.length > 0
      ? scenario.proposed_changes.reduce((sum, c) => {
          return (
            sum +
            (c.current_price > 0
              ? ((c.proposed_price - c.current_price) / c.current_price) * 100
              : 0)
          );
        }, 0) / scenario.proposed_changes.length
      : 0;

  const churnRiskIncrease = Math.max(0, (avgPriceChangePct / 10) * 2);
  const churnRiskLevel: PricingAnalysis["churn_risk_level"] =
    churnRiskIncrease > 6 ? "high" : churnRiskIncrease > 3 ? "moderate" : "low";

  // Build sensitivity analysis at -20%, -10%, proposed, +10%, +20%
  const sensitivityMultipliers = [
    { label: "-20%", mult: 0.8 },
    { label: "-10%", mult: 0.9 },
    { label: "proposed", mult: 1.0 },
    { label: "+10%", mult: 1.1 },
    { label: "+20%", mult: 1.2 },
  ];

  const sensitivity: SensitivityPoint[] = sensitivityMultipliers.map(
    ({ label, mult }) => {
      let sensMRR = currentMRR;
      for (const change of scenario.proposed_changes) {
        const plan = scenario.plans.find((p) => p.plan_id === change.plan_id);
        if (!plan) continue;

        const adjustedNewPrice =
          change.current_price +
          (change.proposed_price - change.current_price) * mult;
        const pctChange =
          change.current_price > 0
            ? ((adjustedNewPrice - change.current_price) / change.current_price) *
              100
            : 0;
        const sensChurnPct = Math.max(0, (pctChange / 10) * 2);
        const remainingSubs = Math.round(
          plan.subscriber_count * (1 - sensChurnPct / 100)
        );
        sensMRR +=
          remainingSubs * adjustedNewPrice - plan.mrr_contribution;
      }

      const sensAvgChurn =
        Math.max(0, (avgPriceChangePct * mult) / 10) * 2;

      return {
        label,
        price_multiplier: mult,
        projected_mrr: Math.round(sensMRR * 100) / 100,
        projected_churn_pct:
          Math.round(sensAvgChurn * 100) / 100,
      };
    }
  );

  // Build narrative
  const direction = monthlyDelta >= 0 ? "increase" : "decrease";
  const narrative =
    `The proposed pricing changes would ${direction} MRR by $${Math.abs(Math.round(monthlyDelta)).toLocaleString()} (${monthlyDeltaPct >= 0 ? "+" : ""}${monthlyDeltaPct.toFixed(1)}%), ` +
    `bringing projected MRR to $${Math.round(projectedMRR).toLocaleString()}. ` +
    `Based on standard fitness industry elasticity, we estimate a ${churnRiskIncrease.toFixed(1)} percentage point increase in churn risk. ` +
    `${churnRiskLevel === "high" ? "This is a significant churn risk — consider phasing the increase over 2-3 months." : churnRiskLevel === "moderate" ? "Monitor member feedback closely after implementation." : "Churn impact should be minimal at this price point."} ` +
    `Projected annual revenue at the new pricing would be approximately $${Math.round(projectedMRR * 12).toLocaleString()}.`;

  return {
    monthly_revenue_delta: Math.round(monthlyDelta * 100) / 100,
    monthly_revenue_delta_pct: Math.round(monthlyDeltaPct * 100) / 100,
    projected_mrr: Math.round(projectedMRR * 100) / 100,
    projected_annual_revenue: Math.round(projectedMRR * 12 * 100) / 100,
    churn_risk_increase_pct: Math.round(churnRiskIncrease * 100) / 100,
    churn_risk_level: churnRiskLevel,
    upgrade_predictions: upgradePredictions,
    narrative,
    sensitivity,
  };
}
