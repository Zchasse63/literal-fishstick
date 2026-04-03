/**
 * AI Send Time Optimization — determine optimal email send times per member.
 *
 * Extracted from lib/anthropic.ts (MED-09).
 */
import { getAnthropicClient, AI_MODEL, extractText } from "@/lib/ai/client";

export interface SendTimeInput {
  member_id: string;
  timezone: string;
  recent_open_times: string[];
  recent_booking_times: string[];
  membership_type: string | null;
}

export interface SendTimeResult {
  optimal_hour: number;
  optimal_day: string;
  confidence: "high" | "medium" | "low";
  rationale: string;
}

/**
 * Determine the optimal send time for a member using AI analysis.
 * Falls back to rules-based calculation if ANTHROPIC_API_KEY is not set.
 */
export async function optimizeSendTime(
  memberData: SendTimeInput
): Promise<SendTimeResult> {
  const anthropic = getAnthropicClient();
  if (!anthropic) {
    return generateRulesBasedSendTime(memberData);
  }

  try {
    const message = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 400,
      system:
        "You are Meridian AI. Determine the optimal email send time for a fitness studio member based on their engagement patterns. Return JSON with: optimal_hour (number 0-23 in member's timezone), optimal_day (string day of week like 'Tuesday'), confidence ('high' | 'medium' | 'low'), rationale (brief explanation). Return ONLY the JSON object, no markdown fences.",
      messages: [
        {
          role: "user",
          content: `Determine optimal send time for this member:\n${JSON.stringify(memberData, null, 2)}`,
        },
      ],
    });

    const text = extractText(message);
    const jsonStr = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    const parsed = JSON.parse(jsonStr) as SendTimeResult;

    if (
      typeof parsed.optimal_hour !== "number" ||
      typeof parsed.optimal_day !== "string" ||
      !["high", "medium", "low"].includes(parsed.confidence)
    ) {
      throw new Error("Invalid send time response shape");
    }

    parsed.optimal_hour = Math.max(0, Math.min(23, Math.round(parsed.optimal_hour)));

    return parsed;
  } catch (error) {
    console.error(
      "Anthropic API error for send time optimization, falling back to rules-based:",
      error
    );
    return generateRulesBasedSendTime(memberData);
  }
}

function generateRulesBasedSendTime(
  memberData: SendTimeInput
): SendTimeResult {
  // If we have recent open times, find the most common hour
  if (memberData.recent_open_times.length >= 3) {
    const hourCounts: Record<number, number> = {};
    const dayCounts: Record<string, number> = {};
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    for (const timeStr of memberData.recent_open_times) {
      try {
        const d = new Date(timeStr);
        const hour = d.getHours();
        const day = dayNames[d.getDay()];
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        dayCounts[day] = (dayCounts[day] || 0) + 1;
      } catch {
        // skip invalid dates
      }
    }

    const topHour = Object.entries(hourCounts).sort(
      (a, b) => b[1] - a[1]
    )[0];
    const topDay = Object.entries(dayCounts).sort(
      (a, b) => b[1] - a[1]
    )[0];

    if (topHour && topDay) {
      return {
        optimal_hour: parseInt(topHour[0], 10),
        optimal_day: topDay[0],
        confidence: memberData.recent_open_times.length >= 10 ? "high" : "medium",
        rationale: `Based on ${memberData.recent_open_times.length} recent email opens, this member is most active at ${topHour[0]}:00 on ${topDay[0]}s.`,
      };
    }
  }

  // If we have booking times but not enough open times
  if (memberData.recent_booking_times.length >= 3) {
    const hourCounts: Record<number, number> = {};
    for (const timeStr of memberData.recent_booking_times) {
      try {
        const d = new Date(timeStr);
        const hour = d.getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      } catch {
        // skip invalid dates
      }
    }

    const topHour = Object.entries(hourCounts).sort(
      (a, b) => b[1] - a[1]
    )[0];

    if (topHour) {
      // Send 1-2 hours before their typical booking time
      const sendHour = Math.max(0, parseInt(topHour[0], 10) - 1);
      return {
        optimal_hour: sendHour,
        optimal_day: "Tuesday",
        confidence: "medium",
        rationale: `Based on booking patterns, this member typically books around ${topHour[0]}:00. Sending 1 hour before at ${sendHour}:00 on Tuesday.`,
      };
    }
  }

  // Default fallback
  return {
    optimal_hour: 9,
    optimal_day: "Tuesday",
    confidence: "low",
    rationale:
      "No engagement data available. Defaulting to 9:00 AM on Tuesday, which is the industry standard for highest open rates.",
  };
}
