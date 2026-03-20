import Anthropic from "@anthropic-ai/sdk";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BookingPatternInput {
  studio_id: string;
  /** 90 days of class data with aggregated booking/check-in metrics. */
  classes: {
    id: string;
    title: string;
    day_of_week: number; // 0=Sun, 6=Sat
    hour: number; // 0-23
    capacity: number;
    avg_booked: number;
    avg_checked_in: number;
    total_sessions: number;
    trainer_name: string | null;
  }[];
  /** Overall studio metrics for the analysis window. */
  total_members: number;
  avg_daily_bookings: number;
  peak_utilization_pct: number;
}

export interface BookingPatternResult {
  recommendations: {
    type:
      | "add_class"
      | "remove_class"
      | "move_class"
      | "adjust_capacity"
      | "general";
    priority: "high" | "medium" | "low";
    title: string;
    description: string;
    data?: Record<string, unknown>;
  }[];
  peak_hours: { day: string; hour: string; utilization: number }[];
  underperforming: {
    title: string;
    day: string;
    hour: string;
    avg_utilization: number;
  }[];
  summary: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function formatHour(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

// ---------------------------------------------------------------------------
// AI-powered analysis
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are Meridian AI, analyzing 90 days of class booking data for a fitness/wellness studio (sauna & cold plunge). Your job is to identify patterns, peak/off-peak hours, underperforming classes, and provide schedule optimization recommendations.

Analyze the data and return a JSON object with exactly these fields:
- "recommendations": array of objects with { type, priority, title, description, data? }
  - type: "add_class" | "remove_class" | "move_class" | "adjust_capacity" | "general"
  - priority: "high" | "medium" | "low"
  - title: short action title
  - description: 1-2 sentence explanation with specific data references
  - data: optional object with supporting metrics
- "peak_hours": array of { day, hour, utilization } for time slots with >80% utilization
- "underperforming": array of { title, day, hour, avg_utilization } for classes with <50% utilization
- "summary": 2-3 sentence executive summary of the schedule health

Be specific and data-driven. Reference class names, days, and times. Limit to 5-7 recommendations max. Return ONLY the JSON object, no markdown fences or extra text.`;

/**
 * Analyze booking patterns using Claude, with a robust rules-based fallback.
 */
export async function analyzeBookingPatterns(
  input: BookingPatternInput
): Promise<BookingPatternResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return analyzeBookingPatternsRulesBased(input);
  }

  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Analyze the following 90-day booking data and provide schedule optimization recommendations:\n\n${JSON.stringify(input, null, 2)}`,
        },
      ],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Strip markdown fences if present
    const jsonStr = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    const parsed = JSON.parse(jsonStr) as BookingPatternResult;

    // Validate required fields
    if (
      !Array.isArray(parsed.recommendations) ||
      !Array.isArray(parsed.peak_hours) ||
      !Array.isArray(parsed.underperforming) ||
      typeof parsed.summary !== "string"
    ) {
      console.error(
        "Invalid booking pattern response shape, falling back to rules-based"
      );
      return analyzeBookingPatternsRulesBased(input);
    }

    return parsed;
  } catch (error) {
    console.error(
      "Anthropic API error for booking patterns, falling back to rules-based:",
      error
    );
    return analyzeBookingPatternsRulesBased(input);
  }
}

// ---------------------------------------------------------------------------
// Rules-based fallback
// ---------------------------------------------------------------------------

function analyzeBookingPatternsRulesBased(
  input: BookingPatternInput
): BookingPatternResult {
  const recommendations: BookingPatternResult["recommendations"] = [];
  const peakHours: BookingPatternResult["peak_hours"] = [];
  const underperforming: BookingPatternResult["underperforming"] = [];

  for (const cls of input.classes) {
    if (cls.capacity === 0 || cls.total_sessions === 0) continue;

    const utilization =
      Math.round((cls.avg_booked / cls.capacity) * 100 * 100) / 100;
    const dayName = DAY_NAMES[cls.day_of_week] ?? `Day ${cls.day_of_week}`;
    const hourLabel = formatHour(cls.hour);

    // Peak hours: >80% utilization
    if (utilization > 80) {
      peakHours.push({
        day: dayName,
        hour: hourLabel,
        utilization,
      });
    }

    // Underperforming: <50% utilization
    if (utilization < 50) {
      underperforming.push({
        title: cls.title,
        day: dayName,
        hour: hourLabel,
        avg_utilization: utilization,
      });
    }

    // Recommendation: add class near peak if capacity >85%
    if (utilization > 85) {
      recommendations.push({
        type: "add_class",
        priority: "high",
        title: `Add class near ${dayName} ${hourLabel}`,
        description: `${cls.title} on ${dayName} at ${hourLabel} is running at ${utilization}% capacity (avg ${cls.avg_booked}/${cls.capacity} booked). Consider adding an adjacent time slot to capture overflow demand.`,
        data: {
          class_id: cls.id,
          current_utilization: utilization,
          avg_booked: cls.avg_booked,
          capacity: cls.capacity,
        },
      });
    }

    // Recommendation: review classes with <30% utilization
    if (utilization < 30 && cls.total_sessions >= 4) {
      recommendations.push({
        type: "remove_class",
        priority: cls.total_sessions >= 8 ? "high" : "medium",
        title: `Review ${cls.title} on ${dayName}`,
        description: `${cls.title} on ${dayName} at ${hourLabel} averages only ${utilization}% utilization across ${cls.total_sessions} sessions. Consider removing, rescheduling, or consolidating this time slot.`,
        data: {
          class_id: cls.id,
          current_utilization: utilization,
          total_sessions: cls.total_sessions,
          avg_booked: cls.avg_booked,
        },
      });
    }

    // Recommendation: adjust capacity for classes consistently between 60-80%
    if (utilization >= 60 && utilization <= 80 && cls.total_sessions >= 4) {
      // Check if check-in rate is significantly lower than booking rate
      const checkInRate =
        cls.avg_booked > 0
          ? Math.round((cls.avg_checked_in / cls.avg_booked) * 100)
          : 0;
      if (checkInRate < 70) {
        recommendations.push({
          type: "adjust_capacity",
          priority: "medium",
          title: `Address no-show rate for ${cls.title}`,
          description: `${cls.title} on ${dayName} at ${hourLabel} has a ${100 - checkInRate}% no-show/cancellation rate (${cls.avg_checked_in} check-ins vs ${cls.avg_booked} booked). Consider overbooking or enforcing late-cancel penalties.`,
          data: {
            class_id: cls.id,
            avg_booked: cls.avg_booked,
            avg_checked_in: cls.avg_checked_in,
            check_in_rate: checkInRate,
          },
        });
      }
    }
  }

  // Sort peak hours by utilization descending
  peakHours.sort((a, b) => b.utilization - a.utilization);

  // Sort underperforming by utilization ascending
  underperforming.sort((a, b) => a.avg_utilization - b.avg_utilization);

  // General recommendation if overall peak utilization is high
  if (input.peak_utilization_pct > 90) {
    recommendations.push({
      type: "general",
      priority: "high",
      title: "Studio nearing maximum capacity",
      description: `Peak utilization has reached ${input.peak_utilization_pct}%. With ${input.total_members} active members and an average of ${input.avg_daily_bookings} daily bookings, consider expanding hours or adding resources to prevent member frustration.`,
      data: {
        peak_utilization: input.peak_utilization_pct,
        total_members: input.total_members,
        avg_daily_bookings: input.avg_daily_bookings,
      },
    });
  }

  // Limit recommendations to 7 (sorted by priority)
  const priorityOrder: Record<string, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };
  recommendations.sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
  );
  const finalRecommendations = recommendations.slice(0, 7);

  // Generate summary
  const totalClasses = input.classes.length;
  const peakCount = peakHours.length;
  const underCount = underperforming.length;

  let summary: string;
  if (peakCount === 0 && underCount === 0) {
    summary = `Across ${totalClasses} class slots analyzed over 90 days, the schedule is well-balanced with no extreme peaks or underperformers. Continue monitoring weekly trends.`;
  } else if (peakCount > underCount) {
    summary = `The schedule shows strong demand with ${peakCount} time slot${peakCount === 1 ? "" : "s"} exceeding 80% capacity. ${underCount > 0 ? `${underCount} slot${underCount === 1 ? "" : "s"} underperform${underCount === 1 ? "s" : ""} and may benefit from rescheduling.` : "No significant underperformers detected."} Focus on adding capacity near peak hours to capture unmet demand.`;
  } else {
    summary = `${underCount} class slot${underCount === 1 ? "" : "s"} running below 50% utilization — consider consolidating or rescheduling. ${peakCount > 0 ? `${peakCount} peak slot${peakCount === 1 ? " is" : "s are"} near capacity and could benefit from adjacent time offerings.` : "No slots are currently at peak capacity."} Overall average daily bookings: ${input.avg_daily_bookings}.`;
  }

  return {
    recommendations: finalRecommendations,
    peak_hours: peakHours,
    underperforming,
    summary,
  };
}
