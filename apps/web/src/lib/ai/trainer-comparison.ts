// TODO: Phase 3 — This AI module is implemented but has no API route wired up yet.
// Create /api/ai/trainer-comparison/route.ts to expose team performance comparison.
import { getAnthropicClient, AI_MODEL, extractText, parseAIJson } from "@/lib/ai/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TrainerComparisonInput {
  trainer_id: string;
  name: string;
  total_classes_30d: number;
  avg_attendance: number;
  avg_fill_rate: number; // 0-100
  bonus_hit_rate: number; // 0-100 — % of classes exceeding bonus threshold
  revenue_attributed: number;
  avg_rating: number | null; // 1-5, null if no ratings yet
  top_class_type: string | null; // e.g., "Guided Breathwork", "Open Sauna"
  retention_rate: number; // 0-100 — % of their regular attendees who remain active
}

export interface StandoutPerformer {
  trainer_name: string;
  category: string; // e.g., "Highest fill rate", "Best retention"
  metric_value: string; // formatted value
  narrative: string; // 1-2 sentences
}

export interface DevelopmentArea {
  trainer_name: string;
  area: string;
  current_value: string;
  benchmark: string;
  suggestion: string;
}

export interface SchedulingSuggestion {
  suggestion: string;
  rationale: string;
  affected_trainers: string[];
}

export interface TeamInsight {
  team_narrative: string; // 3-5 sentences on the team overall
  standout_performers: StandoutPerformer[];
  areas_to_develop: DevelopmentArea[];
  scheduling_suggestions: SchedulingSuggestion[];
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are Meridian AI, a trainer performance analyst for a fitness and wellness studio (sauna & cold plunge). Analyze a team of trainers' metrics and provide actionable team insights.

You will receive an array of trainer metrics. Analyze the team holistically and generate:

Return a JSON object with exactly these fields:
- "team_narrative": string (3-5 sentences summarizing the team's overall performance, key trends, and how trainers compare to each other. Reference specific numbers.)
- "standout_performers": array of { "trainer_name": string, "category": string, "metric_value": string, "narrative": string } — highlight 1-3 trainers who excel in specific areas
- "areas_to_develop": array of { "trainer_name": string, "area": string, "current_value": string, "benchmark": string, "suggestion": string } — identify 1-3 areas where specific trainers could improve
- "scheduling_suggestions": array of { "suggestion": string, "rationale": string, "affected_trainers": string[] } — 1-3 scheduling optimizations based on the data

Be constructive, not punitive. Frame development areas as growth opportunities. Reference actual numbers from the data.

Return ONLY the JSON object. No markdown fences, no extra text.`;

// ---------------------------------------------------------------------------
// Compare trainers
// ---------------------------------------------------------------------------

/**
 * Compare trainer performance and generate team insights using Claude.
 */
export async function compareTrainers(
  trainers: TrainerComparisonInput[]
): Promise<TeamInsight> {
  const anthropic = getAnthropicClient();
  if (!anthropic) {
    return generateRulesBasedComparison(trainers);
  }

  try {

    const message = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Compare these trainers and generate team insights:\n${JSON.stringify(trainers, null, 2)}`,
        },
      ],
    });

    const text = extractText(message);

    const jsonStr = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    let parsed: TeamInsight;
    try {
      parsed = JSON.parse(jsonStr) as TeamInsight;
    } catch (parseError) {
      console.error("Failed to parse trainer comparison JSON, falling back to rules-based:", parseError);
      return generateRulesBasedComparison(trainers);
    }

    // Validate shape
    if (
      typeof parsed.team_narrative !== "string" ||
      !Array.isArray(parsed.standout_performers) ||
      !Array.isArray(parsed.areas_to_develop) ||
      !Array.isArray(parsed.scheduling_suggestions)
    ) {
      console.error(
        "Invalid trainer comparison response shape, falling back to rules-based"
      );
      return generateRulesBasedComparison(trainers);
    }

    return parsed;
  } catch (error) {
    console.error(
      "Anthropic API error for trainer comparison, falling back to rules-based:",
      error
    );
    return generateRulesBasedComparison(trainers);
  }
}

// ---------------------------------------------------------------------------
// Rules-based fallback
// ---------------------------------------------------------------------------

function generateRulesBasedComparison(
  trainers: TrainerComparisonInput[]
): TeamInsight {
  if (trainers.length === 0) {
    return {
      team_narrative: "No trainer data available for comparison.",
      standout_performers: [],
      areas_to_develop: [],
      scheduling_suggestions: [],
    };
  }

  // Sort by different metrics
  const byAttendance = [...trainers].sort(
    (a, b) => b.avg_attendance - a.avg_attendance
  );
  const byFillRate = [...trainers].sort(
    (a, b) => b.avg_fill_rate - a.avg_fill_rate
  );
  const byBonusRate = [...trainers].sort(
    (a, b) => b.bonus_hit_rate - a.bonus_hit_rate
  );
  const byRetention = [...trainers].sort(
    (a, b) => b.retention_rate - a.retention_rate
  );

  // Team averages
  const avgFillRate =
    trainers.reduce((sum, t) => sum + t.avg_fill_rate, 0) / trainers.length;
  const avgAttendance =
    trainers.reduce((sum, t) => sum + t.avg_attendance, 0) / trainers.length;
  const avgBonusRate =
    trainers.reduce((sum, t) => sum + t.bonus_hit_rate, 0) / trainers.length;
  const totalRevenue = trainers.reduce(
    (sum, t) => sum + t.revenue_attributed,
    0
  );

  // Team narrative
  const topTrainer = byAttendance[0];
  const bottomTrainer = byAttendance[byAttendance.length - 1];
  const teamNarrative =
    `The training team averaged a ${avgFillRate.toFixed(0)}% fill rate across ${trainers.length} trainers over the last 30 days, with ${avgAttendance.toFixed(1)} average attendance per class. ` +
    `${topTrainer.name} leads in attendance with ${topTrainer.avg_attendance.toFixed(1)} per class, while the team collectively generated $${totalRevenue.toLocaleString()} in attributed revenue. ` +
    `Bonus threshold hit rate averages ${avgBonusRate.toFixed(0)}% across the team. ` +
    `${byAttendance.length > 1 && bottomTrainer.avg_fill_rate < avgFillRate * 0.8 ? `${bottomTrainer.name} is underperforming relative to the team average and may benefit from schedule adjustments or coaching.` : "Performance is relatively consistent across the team."}`;

  // Standout performers
  const standouts: StandoutPerformer[] = [];

  standouts.push({
    trainer_name: byFillRate[0].name,
    category: "Highest fill rate",
    metric_value: `${byFillRate[0].avg_fill_rate.toFixed(0)}%`,
    narrative: `${byFillRate[0].name} consistently fills ${byFillRate[0].avg_fill_rate.toFixed(0)}% of available spots across ${byFillRate[0].total_classes_30d} classes this month.`,
  });

  if (byBonusRate[0].bonus_hit_rate > 50) {
    standouts.push({
      trainer_name: byBonusRate[0].name,
      category: "Best bonus hit rate",
      metric_value: `${byBonusRate[0].bonus_hit_rate.toFixed(0)}%`,
      narrative: `${byBonusRate[0].name} exceeded the bonus threshold in ${byBonusRate[0].bonus_hit_rate.toFixed(0)}% of their classes, demonstrating strong drawing power.`,
    });
  }

  if (byRetention[0].retention_rate > 80) {
    standouts.push({
      trainer_name: byRetention[0].name,
      category: "Best member retention",
      metric_value: `${byRetention[0].retention_rate.toFixed(0)}%`,
      narrative: `${byRetention[0].retention_rate.toFixed(0)}% of ${byRetention[0].name}'s regular attendees remain active members, indicating strong member loyalty.`,
    });
  }

  // Areas to develop
  const areasToDevlop: DevelopmentArea[] = [];

  for (const trainer of trainers) {
    if (trainer.avg_fill_rate < avgFillRate * 0.75 && trainers.length > 1) {
      areasToDevlop.push({
        trainer_name: trainer.name,
        area: "Class fill rate",
        current_value: `${trainer.avg_fill_rate.toFixed(0)}%`,
        benchmark: `Team avg: ${avgFillRate.toFixed(0)}%`,
        suggestion: `Consider moving ${trainer.name}'s classes to more popular time slots or pairing with marketing promotions to boost attendance.`,
      });
    }
    if (trainer.bonus_hit_rate < 20 && trainer.total_classes_30d >= 4) {
      areasToDevlop.push({
        trainer_name: trainer.name,
        area: "Bonus threshold performance",
        current_value: `${trainer.bonus_hit_rate.toFixed(0)}%`,
        benchmark: `Team avg: ${avgBonusRate.toFixed(0)}%`,
        suggestion: `${trainer.name} rarely hits the bonus threshold. Review their class types and scheduling to ensure they're set up for success.`,
      });
    }
  }

  // Scheduling suggestions
  const suggestions: SchedulingSuggestion[] = [];

  if (byFillRate.length > 1) {
    const highPerformers = byFillRate.filter(
      (t) => t.avg_fill_rate > avgFillRate
    );
    const lowPerformers = byFillRate.filter(
      (t) => t.avg_fill_rate < avgFillRate * 0.75
    );

    if (highPerformers.length > 0 && lowPerformers.length > 0) {
      suggestions.push({
        suggestion: `Assign prime time slots to high-performing trainers`,
        rationale: `${highPerformers.map((t) => t.name).join(", ")} consistently fill classes above average. Moving them to peak hours maximizes revenue.`,
        affected_trainers: [
          ...highPerformers.map((t) => t.name),
          ...lowPerformers.map((t) => t.name),
        ],
      });
    }
  }

  if (trainers.some((t) => t.total_classes_30d < 4)) {
    const lightSchedule = trainers.filter((t) => t.total_classes_30d < 4);
    suggestions.push({
      suggestion: "Increase class frequency for underutilized trainers",
      rationale: `${lightSchedule.map((t) => t.name).join(", ")} taught fewer than 4 classes this month. If their fill rates are decent, consider adding more sessions.`,
      affected_trainers: lightSchedule.map((t) => t.name),
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      suggestion: "Maintain current scheduling strategy",
      rationale:
        "Class distribution across trainers appears balanced. Continue monitoring fill rates weekly for optimization opportunities.",
      affected_trainers: trainers.map((t) => t.name),
    });
  }

  return {
    team_narrative: teamNarrative,
    standout_performers: standouts,
    areas_to_develop: areasToDevlop.slice(0, 3),
    scheduling_suggestions: suggestions.slice(0, 3),
  };
}
