// TODO: Phase 3 — This AI module is implemented but has no API route wired up yet.
// Create /api/ai/report-narrative/route.ts to expose AI-generated report narratives.
import { getAnthropicClient, AI_MODEL, extractText, parseAIJson, withRetry } from "@/lib/ai/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NotableDataPoint {
  label: string;
  value: string | number;
  context: string; // e.g., "highest this quarter", "down 15% from last month"
}

export interface ReportNarrativeInput {
  report_type:
    | "revenue"
    | "attendance"
    | "membership"
    | "trainer_performance"
    | "marketing"
    | "operations";
  time_period: {
    start: string; // ISO date
    end: string; // ISO date
    label: string; // e.g., "March 2026", "Q1 2026", "Last 30 Days"
  };
  summary_stats: {
    label: string;
    value: number;
    previous_value: number | null;
    unit: string; // e.g., "$", "%", "members", "sessions"
    trend: "up" | "down" | "flat" | null;
  }[];
  notable_data_points: NotableDataPoint[];
  studio_name: string;
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are Meridian AI, a report narrator for a fitness and wellness studio (sauna & cold plunge). Your job is to generate a concise, professional natural language summary of a report's data.

You will receive a report type, time period, summary statistics, and notable data points. Write a 3-5 sentence summary that:
- Opens with the overall trend or headline finding
- References 2-3 specific numbers from the data
- Calls out any notable highs, lows, or changes
- Closes with a forward-looking observation or recommendation

Write in a confident, data-driven tone. Avoid filler phrases like "It's worth noting" or "Interestingly." Be direct and actionable.

Return ONLY the narrative string (plain text, no JSON wrapper, no markdown fences, no quotes around it).`;

// ---------------------------------------------------------------------------
// Generate report narrative
// ---------------------------------------------------------------------------

/**
 * Generate a natural language narrative for a report using Claude.
 */
export async function generateReportNarrative(
  input: ReportNarrativeInput
): Promise<string> {
  const anthropic = getAnthropicClient();
  if (!anthropic) {
    return generateRulesBasedNarrative(input);
  }

  try {

    const message = await withRetry(() => anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Generate a narrative summary for this report:\n${JSON.stringify(input, null, 2)}`,
        },
      ],
    }));

    const text = extractText(message);

    const cleaned = text
      .replace(/^```(?:json)?\s*|\s*```$/g, "")
      .replace(/^["']|["']$/g, "")
      .trim();

    if (!cleaned || cleaned.length < 20) {
      console.error(
        "Report narrative too short, falling back to rules-based"
      );
      return generateRulesBasedNarrative(input);
    }

    return cleaned;
  } catch (error) {
    console.error(
      "Anthropic API error for report narrative, falling back to rules-based:",
      error
    );
    return generateRulesBasedNarrative(input);
  }
}

// ---------------------------------------------------------------------------
// Rules-based fallback
// ---------------------------------------------------------------------------

function formatValue(value: number, unit: string): string {
  if (unit === "$") return `$${value.toLocaleString()}`;
  if (unit === "%") return `${value.toFixed(1)}%`;
  return `${value.toLocaleString()} ${unit}`;
}

function generateRulesBasedNarrative(input: ReportNarrativeInput): string {
  const { report_type, time_period, summary_stats, notable_data_points } =
    input;

  const reportLabel =
    report_type.charAt(0).toUpperCase() +
    report_type.slice(1).replace(/_/g, " ");

  // Find the most significant stat (largest absolute % change)
  const statsWithChange = summary_stats
    .filter((s) => s.previous_value !== null && s.previous_value !== 0)
    .map((s) => ({
      ...s,
      changePct:
        s.previous_value !== null && s.previous_value !== 0
          ? ((s.value - s.previous_value!) / Math.abs(s.previous_value!)) * 100
          : 0,
    }))
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));

  const leadStatWithChange = statsWithChange[0];
  const leadStatFallback = summary_stats[0];

  // Opening sentence — headline finding
  let narrative = "";
  if (leadStatWithChange) {
    const direction = leadStatWithChange.changePct > 0 ? "up" : "down";
    narrative += `${reportLabel} for ${time_period.label}: ${leadStatWithChange.label} is ${direction} ${Math.abs(leadStatWithChange.changePct).toFixed(1)}% to ${formatValue(leadStatWithChange.value, leadStatWithChange.unit)}. `;
  } else if (leadStatFallback) {
    narrative += `${reportLabel} for ${time_period.label}: ${leadStatFallback.label} stands at ${formatValue(leadStatFallback.value, leadStatFallback.unit)}. `;
  }
  const leadStat = leadStatWithChange || leadStatFallback;

  // Second sentence — supporting stats
  const otherStats = summary_stats
    .filter((s) => s !== leadStat)
    .slice(0, 2);
  if (otherStats.length > 0) {
    const parts = otherStats.map((s) => {
      const trendWord =
        s.trend === "up"
          ? "trending up"
          : s.trend === "down"
            ? "trending down"
            : "holding steady";
      return `${s.label} is ${trendWord} at ${formatValue(s.value, s.unit)}`;
    });
    narrative += parts.join(", and ") + ". ";
  }

  // Third sentence — notable data points
  if (notable_data_points.length > 0) {
    const notable = notable_data_points[0];
    narrative += `${notable.label} reached ${notable.value} (${notable.context}). `;
  }

  // Closing sentence — forward-looking
  const overallTrend = summary_stats.filter((s) => s.trend === "up").length;
  const totalStats = summary_stats.filter((s) => s.trend !== null).length;
  if (totalStats > 0 && overallTrend >= totalStats / 2) {
    narrative +=
      "The overall trajectory is positive — maintain current strategies and look for opportunities to accelerate growth.";
  } else if (totalStats > 0) {
    narrative +=
      "Several metrics show room for improvement — review the detailed breakdowns to identify specific areas to address.";
  } else {
    narrative +=
      "Continue monitoring these metrics to identify emerging trends.";
  }

  return narrative;
}
