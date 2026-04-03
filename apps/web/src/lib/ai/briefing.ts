/**
 * AI Briefing — daily studio briefing generation.
 *
 * Extracted from lib/anthropic.ts (MED-09).
 */
import { getAnthropicClient, AI_MODEL, extractText } from "@/lib/ai/client";

export interface BriefingContext {
  today_classes: number;
  today_bookings: number;
  total_capacity: number;
  checkins_today: number;
  revenue_today: number;
  revenue_mtd: number;
  active_members: number;
  at_risk_members: number;
  new_members_this_week: number;
  expiring_credits_7d: number;
  waitlisted_today: number;
  top_class_today?: string;
}

/**
 * Generate an AI-powered daily briefing for the studio owner.
 * Falls back to a rules-based template if ANTHROPIC_API_KEY is not set.
 */
export async function generateBriefing(
  context: BriefingContext
): Promise<string> {
  const anthropic = getAnthropicClient();
  if (!anthropic) {
    return generateRulesBasedBriefing(context);
  }

  try {
    const message = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 500,
      system: `You are Meridian AI, the intelligent assistant for a fitness studio management platform. You provide concise, actionable daily briefings for studio owners. Be direct, data-driven, and highlight what needs attention. Use a confident but warm tone. Never use more than 3-4 bullet points. Format with bullet points using "\u2022" characters.`,
      messages: [
        {
          role: "user",
          content: `Generate today's briefing for the studio based on this data:\n${JSON.stringify(context, null, 2)}`,
        },
      ],
    });

    return extractText(message);
  } catch (error) {
    console.error("Anthropic API error, falling back to rules-based:", error);
    return generateRulesBasedBriefing(context);
  }
}

function generateRulesBasedBriefing(context: BriefingContext): string {
  const utilizationRate =
    context.total_capacity > 0
      ? Math.round((context.today_bookings / context.total_capacity) * 100)
      : 0;

  const lines: string[] = [];

  lines.push(
    `\u2022 Today: ${context.today_classes} classes scheduled with ${context.today_bookings} bookings (${utilizationRate}% capacity). ${context.checkins_today} checked in so far.`
  );

  if (context.revenue_today > 0 || context.revenue_mtd > 0) {
    lines.push(
      `\u2022 Revenue: $${context.revenue_today.toLocaleString()} today, $${context.revenue_mtd.toLocaleString()} month-to-date.`
    );
  }

  if (context.at_risk_members > 0) {
    lines.push(
      `\u2022 Attention: ${context.at_risk_members} member${context.at_risk_members === 1 ? "" : "s"} at risk \u2014 no check-in in 30+ days. Consider a re-engagement outreach.`
    );
  }

  if (context.expiring_credits_7d > 0) {
    lines.push(
      `\u2022 ${context.expiring_credits_7d} credit pack${context.expiring_credits_7d === 1 ? "" : "s"} expiring within 7 days. Send reminders to avoid member frustration.`
    );
  }

  if (context.new_members_this_week > 0) {
    lines.push(
      `\u2022 Welcome ${context.new_members_this_week} new member${context.new_members_this_week === 1 ? "" : "s"} this week!`
    );
  }

  if (context.waitlisted_today > 0) {
    lines.push(
      `\u2022 ${context.waitlisted_today} on waitlists today \u2014 consider adding capacity if this is a recurring pattern.`
    );
  }

  return lines.join("\n");
}
