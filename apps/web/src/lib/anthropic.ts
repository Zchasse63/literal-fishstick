import Anthropic from "@anthropic-ai/sdk";

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

export interface RecommendationContext {
  type: "scheduling" | "pricing" | "retention" | "general";
  metrics: Record<string, unknown>;
}

/**
 * Generate an AI-powered daily briefing for the studio owner.
 * Falls back to a rules-based template if ANTHROPIC_API_KEY is not set.
 */
export async function generateBriefing(
  context: BriefingContext
): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return generateRulesBasedBriefing(context);
  }

  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system: `You are Meridian AI, the intelligent assistant for a fitness studio management platform. You provide concise, actionable daily briefings for studio owners. Be direct, data-driven, and highlight what needs attention. Use a confident but warm tone. Never use more than 3-4 bullet points. Format with bullet points using "•" characters.`,
      messages: [
        {
          role: "user",
          content: `Generate today's briefing for the studio based on this data:\n${JSON.stringify(context, null, 2)}`,
        },
      ],
    });

    return message.content[0].type === "text" ? message.content[0].text : "";
  } catch (error) {
    console.error("Anthropic API error, falling back to rules-based:", error);
    return generateRulesBasedBriefing(context);
  }
}

/**
 * Generate AI-powered recommendations based on type.
 * Falls back to rules-based recommendations if ANTHROPIC_API_KEY is not set.
 */
export async function generateRecommendations(
  context: RecommendationContext
): Promise<string[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return generateRulesBasedRecommendations(context);
  }

  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const systemPrompts: Record<string, string> = {
      scheduling:
        "You are Meridian AI. Analyze class scheduling data and provide 3-5 actionable recommendations to optimize the schedule. Focus on capacity utilization, popular time slots, and underperforming classes.",
      pricing:
        "You are Meridian AI. Analyze pricing and revenue data and provide 3-5 actionable recommendations to optimize pricing strategy. Focus on membership conversion, credit pack usage, and revenue per member.",
      retention:
        "You are Meridian AI. Analyze member retention data and provide 3-5 actionable recommendations to reduce churn. Focus on at-risk members, engagement patterns, and re-engagement strategies.",
      general:
        "You are Meridian AI. Analyze the studio's overall metrics and provide 3-5 actionable recommendations to improve operations. Cover scheduling, revenue, retention, and growth.",
    };

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      system: `${systemPrompts[context.type]} Return each recommendation as a separate line starting with a number and period (e.g. "1. "). Be specific and data-driven.`,
      messages: [
        {
          role: "user",
          content: `Generate recommendations based on this data:\n${JSON.stringify(context.metrics, null, 2)}`,
        },
      ],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";
    return text
      .split("\n")
      .filter((line) => /^\d+\./.test(line.trim()))
      .map((line) => line.trim());
  } catch (error) {
    console.error("Anthropic API error, falling back to rules-based:", error);
    return generateRulesBasedRecommendations(context);
  }
}

function generateRulesBasedBriefing(context: BriefingContext): string {
  const utilizationRate =
    context.total_capacity > 0
      ? Math.round((context.today_bookings / context.total_capacity) * 100)
      : 0;

  const lines: string[] = [];

  lines.push(
    `• Today: ${context.today_classes} classes scheduled with ${context.today_bookings} bookings (${utilizationRate}% capacity). ${context.checkins_today} checked in so far.`
  );

  if (context.revenue_today > 0 || context.revenue_mtd > 0) {
    lines.push(
      `• Revenue: $${context.revenue_today.toLocaleString()} today, $${context.revenue_mtd.toLocaleString()} month-to-date.`
    );
  }

  if (context.at_risk_members > 0) {
    lines.push(
      `• Attention: ${context.at_risk_members} member${context.at_risk_members === 1 ? "" : "s"} at risk — no check-in in 30+ days. Consider a re-engagement outreach.`
    );
  }

  if (context.expiring_credits_7d > 0) {
    lines.push(
      `• ${context.expiring_credits_7d} credit pack${context.expiring_credits_7d === 1 ? "" : "s"} expiring within 7 days. Send reminders to avoid member frustration.`
    );
  }

  if (context.new_members_this_week > 0) {
    lines.push(
      `• Welcome ${context.new_members_this_week} new member${context.new_members_this_week === 1 ? "" : "s"} this week!`
    );
  }

  if (context.waitlisted_today > 0) {
    lines.push(
      `• ${context.waitlisted_today} on waitlists today — consider adding capacity if this is a recurring pattern.`
    );
  }

  return lines.join("\n");
}

function generateRulesBasedRecommendations(
  context: RecommendationContext
): string[] {
  const recommendations: string[] = [];

  switch (context.type) {
    case "scheduling":
      recommendations.push(
        "1. Review classes with less than 50% capacity utilization — consider adjusting time slots or consolidating.",
        "2. Analyze peak booking times and ensure adequate staffing during high-demand periods.",
        "3. Consider adding a waitlist threshold alert to automatically open new class slots."
      );
      break;
    case "pricing":
      recommendations.push(
        "1. Compare revenue per member across membership tiers to identify the most profitable plans.",
        "2. Review credit pack expiration rates — high expiry rates may indicate pricing or communication issues.",
        "3. Consider introducing a limited-time upgrade promotion for members on lower-tier plans."
      );
      break;
    case "retention":
      recommendations.push(
        "1. Reach out to members who haven't checked in within 14 days with a personalized message.",
        "2. Identify members whose credit packs are expiring soon and send renewal reminders.",
        "3. Track first-month retention rate — the first 30 days are critical for long-term engagement.",
        "4. Consider implementing a referral bonus program to incentivize member advocacy."
      );
      break;
    case "general":
      recommendations.push(
        "1. Monitor daily capacity utilization trends to optimize class scheduling.",
        "2. Review at-risk member segments weekly and trigger automated re-engagement campaigns.",
        "3. Track trainer performance metrics to identify coaching and scheduling opportunities.",
        "4. Analyze revenue per class to identify your most and least profitable time slots."
      );
      break;
  }

  return recommendations;
}
