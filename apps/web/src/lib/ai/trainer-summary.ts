import Anthropic from "@anthropic-ai/sdk";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TrainerMetrics {
  trainer_id: string;
  trainer_name: string;
  period_start: string;
  period_end: string;
  total_classes: number;
  total_check_ins: number;
  avg_attendance_rate: number; // 0-100
  avg_capacity_utilization: number; // 0-100
  classes_above_bonus_threshold: number; // classes with 7+ check-ins
  bonus_eligible: boolean;
  unique_members_served: number;
  repeat_member_rate: number; // % of members who attended 2+ of their classes
  promo_code_conversions: number;
  revenue_attributed: number; // cents
  top_classes: { title: string; avg_attendance: number }[];
  comparison_to_studio_avg: {
    attendance_diff: number; // percentage points above/below studio avg
    utilization_diff: number;
  };
}

export interface TrainerSummaryResult {
  narrative: string; // 4-6 sentence performance narrative
  highlights: string[]; // 3 key highlights
  areas_for_growth: string[]; // 1-2 suggestions
  overall_rating:
    | "exceptional"
    | "strong"
    | "solid"
    | "developing"
    | "needs_attention";
  bonus_summary: string; // sentence about bonus eligibility
}

// ---------------------------------------------------------------------------
// AI-powered trainer performance summary
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are Meridian AI, writing monthly trainer performance summaries for a fitness and wellness studio (sauna & cold plunge). Be constructive, specific, and data-driven. Highlight strengths first, then growth areas. Reference specific numbers from the data provided.

Return your response as a JSON object with exactly these fields:
- "narrative": string (4-6 sentences summarizing overall performance)
- "highlights": array of exactly 3 strings (key highlights/wins)
- "areas_for_growth": array of 1-2 strings (constructive suggestions)
- "overall_rating": one of "exceptional", "strong", "solid", "developing", "needs_attention"
- "bonus_summary": string (one sentence about bonus eligibility and threshold classes)

Rating guidelines based on average attendance rate:
- 80%+ → exceptional
- 65-79% → strong
- 50-64% → solid
- 35-49% → developing
- Below 35% → needs_attention

Return ONLY the JSON object. No markdown fences, no extra text.`;

/**
 * Generate an AI-powered trainer performance summary using Claude,
 * with a robust rules-based fallback.
 */
export async function generateTrainerSummary(
  metrics: TrainerMetrics
): Promise<TrainerSummaryResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return generateRulesBasedTrainerSummary(metrics);
  }

  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Generate a performance summary for this trainer:\n${JSON.stringify(metrics, null, 2)}`,
        },
      ],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Strip markdown fences if present
    const jsonStr = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    const parsed = JSON.parse(jsonStr) as TrainerSummaryResult;

    // Validate the response shape
    if (
      typeof parsed.narrative !== "string" ||
      !Array.isArray(parsed.highlights) ||
      !Array.isArray(parsed.areas_for_growth) ||
      ![
        "exceptional",
        "strong",
        "solid",
        "developing",
        "needs_attention",
      ].includes(parsed.overall_rating) ||
      typeof parsed.bonus_summary !== "string"
    ) {
      console.error(
        "Invalid trainer summary response shape, falling back to rules-based"
      );
      return generateRulesBasedTrainerSummary(metrics);
    }

    return parsed;
  } catch (error) {
    console.error(
      "Anthropic API error for trainer summary, falling back to rules-based:",
      error
    );
    return generateRulesBasedTrainerSummary(metrics);
  }
}

// ---------------------------------------------------------------------------
// Rules-based fallback
// ---------------------------------------------------------------------------

function getRating(
  avgAttendanceRate: number
): TrainerSummaryResult["overall_rating"] {
  if (avgAttendanceRate >= 80) return "exceptional";
  if (avgAttendanceRate >= 65) return "strong";
  if (avgAttendanceRate >= 50) return "solid";
  if (avgAttendanceRate >= 35) return "developing";
  return "needs_attention";
}

function generateRulesBasedTrainerSummary(
  metrics: TrainerMetrics
): TrainerSummaryResult {
  const rating = getRating(metrics.avg_attendance_rate);
  const firstName = metrics.trainer_name.split(" ")[0];

  // --- Build narrative ---
  const narrative = buildNarrative(metrics, rating, firstName);

  // --- Build highlights ---
  const highlights = buildHighlights(metrics, firstName);

  // --- Build growth areas ---
  const areasForGrowth = buildGrowthAreas(metrics);

  // --- Build bonus summary ---
  const bonusSummary = buildBonusSummary(metrics, firstName);

  return {
    narrative,
    highlights,
    areas_for_growth: areasForGrowth,
    overall_rating: rating,
    bonus_summary: bonusSummary,
  };
}

function buildNarrative(
  metrics: TrainerMetrics,
  rating: TrainerSummaryResult["overall_rating"],
  firstName: string
): string {
  const periodLabel = `${metrics.period_start} to ${metrics.period_end}`;
  const attendanceDiff = metrics.comparison_to_studio_avg.attendance_diff;
  const comparisonPhrase =
    attendanceDiff > 0
      ? `${attendanceDiff.toFixed(1)} percentage points above the studio average`
      : attendanceDiff < 0
        ? `${Math.abs(attendanceDiff).toFixed(1)} percentage points below the studio average`
        : "right at the studio average";

  switch (rating) {
    case "exceptional":
      return (
        `${firstName} delivered an exceptional performance during ${periodLabel}. ` +
        `Across ${metrics.total_classes} classes, they maintained an average attendance rate of ${metrics.avg_attendance_rate.toFixed(1)}%, which is ${comparisonPhrase}. ` +
        `They served ${metrics.unique_members_served} unique members with a ${metrics.repeat_member_rate.toFixed(1)}% repeat rate, demonstrating strong member loyalty. ` +
        `${metrics.classes_above_bonus_threshold} of their classes exceeded the 7-check-in bonus threshold, reflecting consistently high demand. ` +
        `Their total check-ins for the period reached ${metrics.total_check_ins}, a testament to their ability to fill the room and keep members coming back.`
      );

    case "strong":
      return (
        `${firstName} had a strong month during ${periodLabel}, teaching ${metrics.total_classes} classes with an average attendance rate of ${metrics.avg_attendance_rate.toFixed(1)}%. ` +
        `Their performance is ${comparisonPhrase}, showing reliable class appeal. ` +
        `They brought in ${metrics.total_check_ins} total check-ins across ${metrics.unique_members_served} unique members. ` +
        `${metrics.classes_above_bonus_threshold > 0 ? `${metrics.classes_above_bonus_threshold} classes hit the bonus threshold, which is a great sign of growing popularity.` : "With continued momentum, bonus threshold classes are within reach."}`
      );

    case "solid":
      return (
        `${firstName} maintained a solid presence during ${periodLabel}, leading ${metrics.total_classes} classes with an average attendance rate of ${metrics.avg_attendance_rate.toFixed(1)}%. ` +
        `Their attendance is ${comparisonPhrase}. ` +
        `They reached ${metrics.unique_members_served} unique members and recorded ${metrics.total_check_ins} total check-ins. ` +
        `There is clear potential to grow class sizes with targeted scheduling or promotional efforts.`
      );

    case "developing":
      return (
        `${firstName} is developing their class following during ${periodLabel}. ` +
        `Across ${metrics.total_classes} classes, the average attendance rate was ${metrics.avg_attendance_rate.toFixed(1)}%, which is ${comparisonPhrase}. ` +
        `They served ${metrics.unique_members_served} unique members with ${metrics.total_check_ins} total check-ins. ` +
        `Focused effort on member engagement and class promotion should help build momentum in the coming weeks.`
      );

    case "needs_attention":
      return (
        `${firstName}'s classes during ${periodLabel} showed room for significant improvement. ` +
        `The average attendance rate of ${metrics.avg_attendance_rate.toFixed(1)}% across ${metrics.total_classes} classes is ${comparisonPhrase}. ` +
        `With ${metrics.total_check_ins} total check-ins and ${metrics.unique_members_served} unique members, there is an opportunity to reassess scheduling, class format, or promotional strategies. ` +
        `A collaborative conversation about goals and support would be a productive next step.`
      );
  }
}

function buildHighlights(
  metrics: TrainerMetrics,
  firstName: string
): string[] {
  const highlights: string[] = [];

  // Top class highlight
  if (metrics.top_classes.length > 0) {
    const topClass = metrics.top_classes[0];
    highlights.push(
      `Top class: "${topClass.title}" averaged ${topClass.avg_attendance.toFixed(1)} attendees per session`
    );
  }

  // Bonus threshold highlight
  if (metrics.classes_above_bonus_threshold > 0) {
    highlights.push(
      `${metrics.classes_above_bonus_threshold} of ${metrics.total_classes} classes exceeded the 7-check-in bonus threshold`
    );
  } else {
    highlights.push(
      `Taught ${metrics.total_classes} classes during the period with ${metrics.total_check_ins} total check-ins`
    );
  }

  // Promo code / revenue highlight
  if (metrics.promo_code_conversions > 0) {
    const revenueFormatted = (metrics.revenue_attributed / 100).toLocaleString(
      "en-US",
      { style: "currency", currency: "USD" }
    );
    highlights.push(
      `${metrics.promo_code_conversions} promo code conversion${metrics.promo_code_conversions === 1 ? "" : "s"} driving ${revenueFormatted} in attributed revenue`
    );
  } else if (metrics.repeat_member_rate > 50) {
    highlights.push(
      `${metrics.repeat_member_rate.toFixed(1)}% repeat member rate demonstrates strong member retention`
    );
  } else {
    highlights.push(
      `Served ${metrics.unique_members_served} unique members during the period`
    );
  }

  // Ensure exactly 3 highlights
  while (highlights.length < 3) {
    if (
      highlights.length === 2 &&
      metrics.comparison_to_studio_avg.attendance_diff > 0
    ) {
      highlights.push(
        `Attendance rate ${metrics.comparison_to_studio_avg.attendance_diff.toFixed(1)} percentage points above studio average`
      );
    } else {
      highlights.push(
        `${firstName} contributed to ${metrics.total_check_ins} total check-ins this period`
      );
    }
  }

  return highlights.slice(0, 3);
}

function buildGrowthAreas(metrics: TrainerMetrics): string[] {
  const areas: string[] = [];

  if (metrics.comparison_to_studio_avg.utilization_diff < -5) {
    areas.push(
      `Capacity utilization is ${Math.abs(metrics.comparison_to_studio_avg.utilization_diff).toFixed(1)} points below studio average — consider adjusting class times or exploring new promotional strategies to fill more spots`
    );
  }

  if (metrics.repeat_member_rate < 40) {
    areas.push(
      `Repeat member rate of ${metrics.repeat_member_rate.toFixed(1)}% is below 40% — focus on building member connections and consistency to encourage return visits`
    );
  }

  if (areas.length === 0 && metrics.promo_code_conversions === 0) {
    areas.push(
      "Consider leveraging your promo code to drive new membership sign-ups and track your referral impact"
    );
  }

  if (areas.length === 0) {
    areas.push(
      "Continue refining class themes and member engagement to maintain upward momentum"
    );
  }

  return areas.slice(0, 2);
}

function buildBonusSummary(
  metrics: TrainerMetrics,
  firstName: string
): string {
  if (metrics.bonus_eligible) {
    return `${firstName} is bonus-eligible this period with ${metrics.classes_above_bonus_threshold} class${metrics.classes_above_bonus_threshold === 1 ? "" : "es"} exceeding the 7-check-in threshold.`;
  }

  if (metrics.classes_above_bonus_threshold > 0) {
    return `${firstName} had ${metrics.classes_above_bonus_threshold} class${metrics.classes_above_bonus_threshold === 1 ? "" : "es"} above the bonus threshold but did not meet the overall eligibility criteria this period.`;
  }

  return `${firstName} did not have any classes exceeding the 7-check-in bonus threshold this period. Growing class attendance will be key to reaching bonus eligibility.`;
}
