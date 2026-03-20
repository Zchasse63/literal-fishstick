import Anthropic from "@anthropic-ai/sdk";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RevenueWeek {
  week_start: string; // YYYY-MM-DD
  total_revenue: number; // in cents
  transaction_count: number;
  new_memberships: number;
  cancellations: number;
  drop_in_revenue: number;
  membership_revenue: number;
  credit_pack_revenue: number;
}

export interface RevenueAnomalyInput {
  studio_id: string;
  current_week: RevenueWeek;
  trailing_8_weeks: RevenueWeek[];
}

export interface RevenueAnomalyResult {
  has_anomaly: boolean;
  anomaly_type: "spike" | "drop" | "trend_change" | "none";
  severity: "info" | "warning" | "critical";
  summary: string; // 2-3 sentence explanation
  comparisons: {
    metric: string;
    current: number;
    average: number;
    pct_change: number;
  }[];
  recommendations: string[];
}

// ---------------------------------------------------------------------------
// AI-powered revenue anomaly detection
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are Meridian AI, a revenue analyst for a fitness and wellness studio (sauna & cold plunge). Your job is to compare the current week's revenue data against the trailing 8-week averages and identify anomalies.

An anomaly is any metric that deviates more than 20% from the trailing average. A critical anomaly is a deviation of more than 40%.

Analyze these revenue streams: total revenue, transaction count, new memberships, cancellations, drop-in revenue, membership revenue, and credit pack revenue.

Determine the anomaly_type:
- "spike" if the dominant deviation is a significant increase
- "drop" if the dominant deviation is a significant decrease
- "trend_change" if there is a reversal in the multi-week trend direction
- "none" if no meaningful anomaly is detected

Return your response as a JSON object with exactly these fields:
- "has_anomaly": boolean
- "anomaly_type": one of "spike", "drop", "trend_change", "none"
- "severity": one of "info", "warning", "critical"
- "summary": string (2-3 sentences explaining the finding, be specific with numbers)
- "comparisons": array of { "metric": string, "current": number, "average": number, "pct_change": number } for each metric analyzed
- "recommendations": array of 1-3 actionable recommendation strings

Return ONLY the JSON object. No markdown fences, no extra text.`;

/**
 * Detect revenue anomalies using Claude, with a robust rules-based fallback.
 */
export async function detectRevenueAnomalies(
  input: RevenueAnomalyInput
): Promise<RevenueAnomalyResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return generateRulesBasedAnomalyDetection(input);
  }

  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Analyze revenue anomalies for this studio:\n\nCurrent week:\n${JSON.stringify(input.current_week, null, 2)}\n\nTrailing 8 weeks:\n${JSON.stringify(input.trailing_8_weeks, null, 2)}`,
        },
      ],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Strip markdown fences if present
    const jsonStr = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    const parsed = JSON.parse(jsonStr) as RevenueAnomalyResult;

    // Validate the response shape
    if (
      typeof parsed.has_anomaly !== "boolean" ||
      !["spike", "drop", "trend_change", "none"].includes(
        parsed.anomaly_type
      ) ||
      !["info", "warning", "critical"].includes(parsed.severity) ||
      typeof parsed.summary !== "string" ||
      !Array.isArray(parsed.comparisons) ||
      !Array.isArray(parsed.recommendations)
    ) {
      console.error(
        "Invalid revenue anomaly response shape, falling back to rules-based"
      );
      return generateRulesBasedAnomalyDetection(input);
    }

    return parsed;
  } catch (error) {
    console.error(
      "Anthropic API error for revenue anomaly detection, falling back to rules-based:",
      error
    );
    return generateRulesBasedAnomalyDetection(input);
  }
}

// ---------------------------------------------------------------------------
// Rules-based fallback
// ---------------------------------------------------------------------------

const WARNING_THRESHOLD = 20;
const CRITICAL_THRESHOLD = 40;

interface MetricComparison {
  metric: string;
  current: number;
  average: number;
  pct_change: number;
}

function calculateAverage(weeks: RevenueWeek[], key: keyof RevenueWeek): number {
  if (weeks.length === 0) return 0;
  const sum = weeks.reduce((acc, w) => acc + (w[key] as number), 0);
  return sum / weeks.length;
}

function pctChange(current: number, average: number): number {
  if (average === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - average) / average) * 10000) / 100; // two decimal places
}

function generateRulesBasedAnomalyDetection(
  input: RevenueAnomalyInput
): RevenueAnomalyResult {
  const { current_week, trailing_8_weeks } = input;

  // Calculate 8-week averages and comparisons
  const metrics: { key: keyof RevenueWeek; label: string }[] = [
    { key: "total_revenue", label: "Total Revenue" },
    { key: "transaction_count", label: "Transaction Count" },
    { key: "new_memberships", label: "New Memberships" },
    { key: "cancellations", label: "Cancellations" },
    { key: "drop_in_revenue", label: "Drop-in Revenue" },
    { key: "membership_revenue", label: "Membership Revenue" },
    { key: "credit_pack_revenue", label: "Credit Pack Revenue" },
  ];

  const comparisons: MetricComparison[] = metrics.map(({ key, label }) => {
    const avg = calculateAverage(trailing_8_weeks, key);
    const current = current_week[key] as number;
    return {
      metric: label,
      current,
      average: Math.round(avg * 100) / 100,
      pct_change: pctChange(current, avg),
    };
  });

  // Determine anomalies: flag metrics with >20% deviation
  const anomalousMetrics = comparisons.filter(
    (c) => Math.abs(c.pct_change) > WARNING_THRESHOLD
  );
  const criticalMetrics = comparisons.filter(
    (c) => Math.abs(c.pct_change) > CRITICAL_THRESHOLD
  );

  const hasAnomaly = anomalousMetrics.length > 0;

  // Determine severity
  let severity: RevenueAnomalyResult["severity"] = "info";
  if (criticalMetrics.length > 0) {
    severity = "critical";
  } else if (anomalousMetrics.length > 0) {
    severity = "warning";
  }

  // Determine anomaly type based on the dominant direction
  let anomalyType: RevenueAnomalyResult["anomaly_type"] = "none";
  if (hasAnomaly) {
    const positiveDeviations = anomalousMetrics.filter(
      (c) => c.pct_change > 0
    ).length;
    const negativeDeviations = anomalousMetrics.filter(
      (c) => c.pct_change < 0
    ).length;

    if (positiveDeviations > 0 && negativeDeviations > 0) {
      anomalyType = "trend_change";
    } else if (positiveDeviations > negativeDeviations) {
      anomalyType = "spike";
    } else {
      anomalyType = "drop";
    }
  }

  // Generate summary
  const summary = buildSummary(anomalyType, severity, anomalousMetrics);

  // Generate recommendations
  const recommendations = buildRecommendations(
    anomalyType,
    anomalousMetrics
  );

  return {
    has_anomaly: hasAnomaly,
    anomaly_type: anomalyType,
    severity,
    summary,
    comparisons,
    recommendations,
  };
}

function buildSummary(
  anomalyType: RevenueAnomalyResult["anomaly_type"],
  severity: RevenueAnomalyResult["severity"],
  anomalousMetrics: MetricComparison[]
): string {
  if (anomalyType === "none") {
    return "Revenue metrics are within normal ranges this week. All key indicators are tracking close to the 8-week trailing average with no significant deviations detected.";
  }

  const topMetric = anomalousMetrics.reduce((max, m) =>
    Math.abs(m.pct_change) > Math.abs(max.pct_change) ? m : max
  );

  const direction = topMetric.pct_change > 0 ? "increase" : "decrease";
  const absChange = Math.abs(topMetric.pct_change);

  switch (anomalyType) {
    case "spike":
      return (
        `Revenue is trending significantly above average this week. ` +
        `${topMetric.metric} saw a ${absChange.toFixed(1)}% ${direction} compared to the 8-week average. ` +
        (severity === "critical"
          ? `This is a critical deviation that warrants investigation into the underlying driver.`
          : `Monitor whether this is a one-time event or the start of a positive trend.`)
      );

    case "drop":
      return (
        `Revenue is trending below average this week. ` +
        `${topMetric.metric} dropped ${absChange.toFixed(1)}% compared to the 8-week average. ` +
        (severity === "critical"
          ? `This is a significant decline that requires immediate attention to understand the cause.`
          : `Keep an eye on this metric over the next 1-2 weeks to determine if it's a temporary dip.`)
      );

    case "trend_change":
      return (
        `Mixed signals detected in this week's revenue data. ` +
        `Some metrics are up while others are down — ${topMetric.metric} shifted ${absChange.toFixed(1)}% ${direction}. ` +
        `This pattern often indicates a change in the revenue mix that may reflect shifting member behavior.`
      );

    default:
      return "Revenue metrics are within normal ranges this week.";
  }
}

function buildRecommendations(
  anomalyType: RevenueAnomalyResult["anomaly_type"],
  anomalousMetrics: MetricComparison[]
): string[] {
  if (anomalyType === "none") {
    return [
      "No action required — revenue is tracking within expected ranges.",
    ];
  }

  const recommendations: string[] = [];

  // Check for cancellation spikes
  const cancellationMetric = anomalousMetrics.find(
    (m) => m.metric === "Cancellations" && m.pct_change > 0
  );
  if (cancellationMetric) {
    recommendations.push(
      `Cancellations are up ${Math.abs(cancellationMetric.pct_change).toFixed(1)}% — review recent cancellation reasons and consider a targeted retention campaign.`
    );
  }

  // Check for membership revenue changes
  const membershipMetric = anomalousMetrics.find(
    (m) => m.metric === "Membership Revenue"
  );
  if (membershipMetric && membershipMetric.pct_change < -WARNING_THRESHOLD) {
    recommendations.push(
      "Membership revenue is declining — check for failed payment retries in Stripe and review the dunning sequence."
    );
  } else if (membershipMetric && membershipMetric.pct_change > WARNING_THRESHOLD) {
    recommendations.push(
      "Membership revenue is above average — identify what drove this (new sign-ups vs. upgrades) and consider doubling down on that channel."
    );
  }

  // Check for drop-in changes
  const dropInMetric = anomalousMetrics.find(
    (m) => m.metric === "Drop-in Revenue"
  );
  if (dropInMetric && dropInMetric.pct_change < -WARNING_THRESHOLD) {
    recommendations.push(
      "Drop-in revenue is down — consider a promotional offer or social media push to drive walk-in traffic."
    );
  }

  // General recommendations based on type
  if (anomalyType === "spike" && recommendations.length === 0) {
    recommendations.push(
      "Revenue is up — identify the specific driver (new memberships, events, merch) to replicate this success."
    );
  }

  if (anomalyType === "drop" && recommendations.length === 0) {
    recommendations.push(
      "Revenue decline detected — review booking trends, marketing campaign performance, and check for any operational issues."
    );
  }

  if (anomalyType === "trend_change") {
    recommendations.push(
      "Revenue mix is shifting — review the balance between membership, drop-in, and credit pack revenue to ensure the business model remains healthy."
    );
  }

  // Ensure at least one recommendation
  if (recommendations.length === 0) {
    recommendations.push(
      "Monitor this trend over the next week and prepare to take action if the deviation continues."
    );
  }

  return recommendations.slice(0, 3);
}
