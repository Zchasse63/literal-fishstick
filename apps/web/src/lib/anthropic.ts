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
      model: "claude-sonnet-4-6",
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
      model: "claude-sonnet-4-6",
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

// --- Smart Campaign Copy Generator ---

export interface CampaignCopyRequest {
  campaign_type:
    | "winback"
    | "upsell"
    | "retention"
    | "reactivation"
    | "promotion"
    | "general";
  audience_description: string;
  tone?: "friendly" | "urgent" | "professional" | "casual";
  key_points?: string[];
  merge_tags?: string[]; // available merge tags like {{first_name}}, {{credits_remaining}}
  max_length?: number;
}

export interface CampaignCopyResult {
  subject_line: string;
  preview_text: string;
  body_html: string;
  body_text: string;
  suggested_merge_tags: string[];
}

/**
 * Generate AI-powered email campaign copy for the studio.
 * Falls back to rules-based templates if ANTHROPIC_API_KEY is not set.
 */
export async function generateCampaignCopy(
  request: CampaignCopyRequest
): Promise<CampaignCopyResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return generateRulesBasedCampaignCopy(request);
  }

  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const userPrompt = [
      `Campaign type: ${request.campaign_type}`,
      `Target audience: ${request.audience_description}`,
      request.tone ? `Tone: ${request.tone}` : null,
      request.key_points?.length
        ? `Key points to include:\n${request.key_points.map((p) => `- ${p}`).join("\n")}`
        : null,
      request.merge_tags?.length
        ? `Available merge tags: ${request.merge_tags.join(", ")}`
        : null,
      request.max_length
        ? `Maximum body length: approximately ${request.max_length} characters`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system:
        "You are Meridian AI, writing email campaign copy for a fitness/wellness studio (sauna & cold plunge). Write compelling, on-brand copy. Include merge tags where appropriate (Handlebars syntax like {{first_name}}). Return JSON with fields: subject_line, preview_text, body_html, body_text, suggested_merge_tags. Return ONLY the JSON object, no markdown fences or extra text.",
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Parse JSON from response, stripping any markdown fences if present
    const jsonStr = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    const parsed = JSON.parse(jsonStr) as CampaignCopyResult;

    // Validate required fields
    if (
      !parsed.subject_line ||
      !parsed.preview_text ||
      !parsed.body_html ||
      !parsed.body_text
    ) {
      throw new Error("Incomplete response from AI — missing required fields");
    }

    return {
      subject_line: parsed.subject_line,
      preview_text: parsed.preview_text,
      body_html: parsed.body_html,
      body_text: parsed.body_text,
      suggested_merge_tags: parsed.suggested_merge_tags ?? [],
    };
  } catch (error) {
    console.error(
      "Anthropic API error for campaign copy, falling back to rules-based:",
      error
    );
    return generateRulesBasedCampaignCopy(request);
  }
}

function generateRulesBasedCampaignCopy(
  request: CampaignCopyRequest
): CampaignCopyResult {
  const templates: Record<
    CampaignCopyRequest["campaign_type"],
    CampaignCopyResult
  > = {
    winback: {
      subject_line: "We miss you, {{first_name}}! Come back and sweat with us",
      preview_text:
        "It's been a while — your sauna spot is waiting.",
      body_html: `<p>Hey {{first_name}},</p>
<p>We noticed it's been a while since your last visit. The sauna is warm, the plunges are cold, and your spot is waiting.</p>
<p>Come back this week and rediscover why you started your wellness journey with us.</p>
<p>See you soon,<br/>The Team</p>`,
      body_text:
        "Hey {{first_name}},\n\nWe noticed it's been a while since your last visit. The sauna is warm, the plunges are cold, and your spot is waiting.\n\nCome back this week and rediscover why you started your wellness journey with us.\n\nSee you soon,\nThe Team",
      suggested_merge_tags: ["{{first_name}}", "{{last_visit_date}}"],
    },
    upsell: {
      subject_line:
        "{{first_name}}, unlock unlimited sessions",
      preview_text:
        "Upgrade your membership and never worry about credits again.",
      body_html: `<p>Hey {{first_name}},</p>
<p>You've been making great progress with your current plan. Ready to take it to the next level?</p>
<p>Upgrade to unlimited and get unrestricted access to all sessions — sauna, cold plunge, and guided classes.</p>
<p>Upgrade now from your account in just one tap.</p>`,
      body_text:
        "Hey {{first_name}},\n\nYou've been making great progress with your current plan. Ready to take it to the next level?\n\nUpgrade to unlimited and get unrestricted access to all sessions — sauna, cold plunge, and guided classes.\n\nUpgrade now from your account in just one tap.",
      suggested_merge_tags: [
        "{{first_name}}",
        "{{current_plan}}",
        "{{credits_remaining}}",
      ],
    },
    retention: {
      subject_line: "{{first_name}}, your streak is on fire 🔥",
      preview_text: "Keep the momentum going — book your next session.",
      body_html: `<p>Hey {{first_name}},</p>
<p>You've been showing up consistently, and that's what it's all about. Keep the momentum going!</p>
<p>Your next session is just a tap away. Book now and keep building your wellness routine.</p>`,
      body_text:
        "Hey {{first_name}},\n\nYou've been showing up consistently, and that's what it's all about. Keep the momentum going!\n\nYour next session is just a tap away. Book now and keep building your wellness routine.",
      suggested_merge_tags: [
        "{{first_name}}",
        "{{total_visits}}",
        "{{streak_count}}",
      ],
    },
    reactivation: {
      subject_line:
        "{{first_name}}, your membership is paused — ready to restart?",
      preview_text: "Reactivate and get back to your routine.",
      body_html: `<p>Hey {{first_name}},</p>
<p>Your membership is currently inactive, but getting back on track is easy.</p>
<p>Reactivate today and pick up right where you left off. Your body and mind will thank you.</p>`,
      body_text:
        "Hey {{first_name}},\n\nYour membership is currently inactive, but getting back on track is easy.\n\nReactivate today and pick up right where you left off. Your body and mind will thank you.",
      suggested_merge_tags: [
        "{{first_name}}",
        "{{membership_status}}",
        "{{last_visit_date}}",
      ],
    },
    promotion: {
      subject_line: "Limited time: Special offer just for you, {{first_name}}",
      preview_text: "Don't miss this exclusive deal on sessions.",
      body_html: `<p>Hey {{first_name}},</p>
<p>We've got something special for you. For a limited time, take advantage of an exclusive offer on our sessions.</p>
<p>Don't wait — this deal won't last long. Book your spot today!</p>`,
      body_text:
        "Hey {{first_name}},\n\nWe've got something special for you. For a limited time, take advantage of an exclusive offer on our sessions.\n\nDon't wait — this deal won't last long. Book your spot today!",
      suggested_merge_tags: ["{{first_name}}", "{{offer_details}}"],
    },
    general: {
      subject_line: "What's new at the studio, {{first_name}}",
      preview_text: "Updates, events, and more from your studio.",
      body_html: `<p>Hey {{first_name}},</p>
<p>Here's what's happening at the studio this week. New classes, upcoming events, and more — we've got a lot in store.</p>
<p>Check the schedule and book your next session!</p>`,
      body_text:
        "Hey {{first_name}},\n\nHere's what's happening at the studio this week. New classes, upcoming events, and more — we've got a lot in store.\n\nCheck the schedule and book your next session!",
      suggested_merge_tags: ["{{first_name}}"],
    },
  };

  return templates[request.campaign_type] ?? templates.general;
}

// ---------------------------------------------------------------------------
// Member Health Score
// ---------------------------------------------------------------------------

export interface HealthScoreInput {
  member_id: string;
  full_name: string;
  membership_type: string | null;
  membership_status: string | null;
  join_date: string | null;
  total_visits_30d: number;
  total_visits_90d: number;
  avg_visits_per_week: number;
  days_since_last_visit: number;
  total_spend_90d: number;
  credits_remaining: number;
  credits_expiring_7d: number;
  cancellation_rate: number; // late cancels / total bookings
  no_show_rate: number;
}

export interface HealthScoreResult {
  score: number; // 0-100
  risk_level: "healthy" | "watch" | "at_risk" | "critical";
  narrative: string; // 2-3 sentence explanation
  top_factors: string[]; // top 3 factors influencing the score
  recommended_action: string;
}

/**
 * Generate a member health score using Claude, with a robust rules-based fallback.
 */
export async function generateHealthScore(
  input: HealthScoreInput
): Promise<HealthScoreResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return generateRulesBasedHealthScore(input);
  }

  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      system:
        "You are Meridian AI. Calculate a health score (0-100) for a fitness studio member based on their engagement data. Score meaning: 80-100 healthy, 60-79 watch, 40-59 at_risk, 0-39 critical. Provide a brief narrative explanation and recommended action. Return JSON only with keys: score (number), risk_level (string), narrative (string), top_factors (array of 3 strings), recommended_action (string). No markdown fences.",
      messages: [
        {
          role: "user",
          content: `Calculate health score for this member:\n${JSON.stringify(input, null, 2)}`,
        },
      ],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Strip markdown fences if present
    const jsonStr = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    const parsed = JSON.parse(jsonStr) as HealthScoreResult;

    // Validate the response shape
    if (
      typeof parsed.score !== "number" ||
      !["healthy", "watch", "at_risk", "critical"].includes(
        parsed.risk_level
      ) ||
      typeof parsed.narrative !== "string" ||
      !Array.isArray(parsed.top_factors) ||
      typeof parsed.recommended_action !== "string"
    ) {
      console.error(
        "Invalid health score response shape, falling back to rules-based"
      );
      return generateRulesBasedHealthScore(input);
    }

    // Clamp score to 0-100
    parsed.score = Math.max(0, Math.min(100, Math.round(parsed.score)));

    return parsed;
  } catch (error) {
    console.error(
      "Anthropic API error for health score, falling back to rules-based:",
      error
    );
    return generateRulesBasedHealthScore(input);
  }
}

function getHealthRiskLevel(
  score: number
): HealthScoreResult["risk_level"] {
  if (score >= 80) return "healthy";
  if (score >= 60) return "watch";
  if (score >= 40) return "at_risk";
  return "critical";
}

function generateRulesBasedHealthScore(
  input: HealthScoreInput
): HealthScoreResult {
  let score = 50;
  const factors: { label: string; impact: number }[] = [];

  // Visit frequency
  if (input.avg_visits_per_week >= 2) {
    score += 20;
    factors.push({ label: "Strong visit frequency (2+/week)", impact: 20 });
  } else if (input.avg_visits_per_week >= 1) {
    score += 10;
    factors.push({
      label: "Moderate visit frequency (1+/week)",
      impact: 10,
    });
  } else if (
    input.avg_visits_per_week < 0.5 &&
    input.avg_visits_per_week > 0
  ) {
    score -= 10;
    factors.push({
      label: "Low visit frequency (<0.5/week)",
      impact: -10,
    });
  } else if (input.avg_visits_per_week === 0) {
    score -= 20;
    factors.push({ label: "No visits recorded", impact: -20 });
  }

  // Recency
  const recencyPenalty = Math.min(
    30,
    Math.floor(input.days_since_last_visit / 7) * 5
  );
  if (recencyPenalty > 0) {
    score -= recencyPenalty;
    factors.push({
      label: `${input.days_since_last_visit} days since last visit`,
      impact: -recencyPenalty,
    });
  }

  // Spend
  if (input.total_spend_90d > 300) {
    score += 10;
    factors.push({ label: "High 90-day spending (>$300)", impact: 10 });
  } else if (input.total_spend_90d > 150) {
    score += 5;
    factors.push({
      label: "Moderate 90-day spending (>$150)",
      impact: 5,
    });
  }

  // Cancellation rate
  if (input.cancellation_rate > 0.3) {
    score -= 10;
    factors.push({
      label: "High cancellation rate (>30%)",
      impact: -10,
    });
  } else if (input.cancellation_rate > 0.15) {
    score -= 5;
    factors.push({
      label: "Elevated cancellation rate (>15%)",
      impact: -5,
    });
  }

  // No-show rate
  if (input.no_show_rate > 0.2) {
    score -= 15;
    factors.push({ label: "High no-show rate (>20%)", impact: -15 });
  } else if (input.no_show_rate > 0.1) {
    score -= 5;
    factors.push({ label: "Elevated no-show rate (>10%)", impact: -5 });
  }

  // Credits expiring
  if (input.credits_expiring_7d > 0) {
    score -= 5;
    factors.push({
      label: `${input.credits_expiring_7d} credits expiring within 7 days`,
      impact: -5,
    });
  }

  // Clamp
  score = Math.max(0, Math.min(100, score));

  // Sort factors by absolute impact descending, take top 3
  factors.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
  const topFactors = factors.slice(0, 3).map((f) => f.label);

  // Fill to 3 if fewer factors
  while (topFactors.length < 3) {
    topFactors.push("Baseline engagement level");
  }

  const riskLevel = getHealthRiskLevel(score);

  // Generate narrative
  let narrative: string;
  if (riskLevel === "healthy") {
    narrative = `${input.full_name} is highly engaged with consistent visit patterns and strong studio commitment. This member is a retention success story.`;
  } else if (riskLevel === "watch") {
    narrative = `${input.full_name} shows moderate engagement but there are early signs that attention may be needed. Monitor visit frequency and spending trends over the next few weeks.`;
  } else if (riskLevel === "at_risk") {
    narrative = `${input.full_name} is showing declining engagement with reduced visits or concerning behavioral patterns. Proactive outreach is recommended before this member churns.`;
  } else {
    narrative = `${input.full_name} is at critical risk of churning. Engagement has dropped significantly and immediate intervention is recommended.`;
  }

  // Generate recommended action
  let recommendedAction: string;
  if (riskLevel === "healthy") {
    recommendedAction =
      "No immediate action needed. Consider for referral program or testimonial.";
  } else if (riskLevel === "watch") {
    recommendedAction =
      "Send a personalized check-in message. Highlight upcoming classes that match their interests.";
  } else if (riskLevel === "at_risk") {
    recommendedAction =
      "Trigger a re-engagement campaign — offer a complimentary session or schedule a personal outreach call.";
  } else {
    recommendedAction =
      "Immediate personal outreach required. Consider a win-back offer or direct phone call from the studio owner.";
  }

  return {
    score,
    risk_level: riskLevel,
    narrative,
    top_factors: topFactors,
    recommended_action: recommendedAction,
  };
}

// ---------------------------------------------------------------------------
// Natural Language Search (Cmd+K)
// ---------------------------------------------------------------------------

export interface NLSearchRequest {
  query: string;
  studio_id: string;
}

export interface NLSearchResult {
  sql: string;
  explanation: string;
  result_type:
    | "members"
    | "classes"
    | "bookings"
    | "transactions"
    | "stats"
    | "other";
  data: Record<string, unknown>[] | null;
  error: string | null;
}

const SCHEMA_CONTEXT = `You have access to the following Postgres tables in a multi-tenant fitness studio platform. Every query MUST filter by studio_id.

Tables:
- profiles (id uuid, full_name text, email text, phone text, health_score int, health_risk_level text, studio_id uuid, status text, created_at timestamptz)
- members (id uuid, profile_id uuid, studio_id uuid, membership_type text, status text, credits_remaining int, created_at timestamptz)
- bookings (id uuid, member_id uuid, class_id uuid, studio_id uuid, status text, is_walk_in boolean, checked_in_at timestamptz, created_at timestamptz)
- classes (id uuid, title text, starts_at timestamptz, ends_at timestamptz, capacity int, booked_count int, checked_in_count int, status text, studio_id uuid, created_at timestamptz)
- transactions (id uuid, member_id uuid, studio_id uuid, amount numeric, type text, status text, created_at timestamptz)
- member_tags (id uuid, member_id uuid, tag text, metadata jsonb)
- email_send_log (id uuid, recipient_email text, studio_id uuid, status text, opened_at timestamptz, clicked_at timestamptz, created_at timestamptz)
- staff (id uuid, full_name text, role text, email text, studio_id uuid, created_at timestamptz)

Important relationships:
- bookings.member_id references members.id
- bookings.class_id references classes.id
- members.profile_id references profiles.id
- transactions.member_id references members.id`;

const NL_SEARCH_SYSTEM_PROMPT = `You are Meridian AI, a SQL query generator for a fitness studio management platform.

${SCHEMA_CONTEXT}

Rules:
1. ALWAYS include a WHERE clause filtering by studio_id = $STUDIO_ID (the placeholder will be replaced with the actual UUID).
2. Only generate SELECT statements. Never generate INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE, or any mutation.
3. Limit results to 50 rows maximum unless the user explicitly asks for more.
4. Use reasonable defaults for time ranges (e.g., "recent" = last 7 days, "today" = current date).
5. For "inactive members" or "haven't visited", look for members with no bookings with checked_in_at in the specified period.
6. Return your response as a JSON object with exactly these fields:
   - "sql": the SELECT query as a string
   - "explanation": a brief human-readable description of what the query returns
   - "result_type": one of "members", "classes", "bookings", "transactions", "stats", "other"

Respond ONLY with the JSON object, no markdown fencing, no extra text.`;

/**
 * Common query patterns handled by rules-based fallback when the Anthropic API
 * is unavailable. Returns null if the query doesn't match any known pattern.
 */
function tryRulesBasedSQL(
  query: string,
  studioId: string
): Omit<NLSearchResult, "data"> | null {
  const q = query.toLowerCase().trim();

  // Members who haven't visited / inactive members
  if (
    q.includes("haven't visited") ||
    q.includes("havent visited") ||
    q.includes("inactive member") ||
    q.includes("not visited") ||
    q.includes("no visit")
  ) {
    const daysMatch = q.match(/(\d+)\s*days?/);
    const days = daysMatch ? parseInt(daysMatch[1], 10) : 30;

    return {
      sql: `SELECT p.full_name, p.email, m.membership_type, m.status, m.credits_remaining
FROM members m
JOIN profiles p ON p.id = m.profile_id
WHERE m.studio_id = '${studioId}'
  AND m.status = 'active'
  AND m.id NOT IN (
    SELECT DISTINCT b.member_id FROM bookings b
    WHERE b.studio_id = '${studioId}'
      AND b.checked_in_at >= NOW() - INTERVAL '${days} days'
  )
ORDER BY p.full_name
LIMIT 50`,
      explanation: `Active members who have not checked in during the last ${days} days`,
      result_type: "members",
      error: null,
    };
  }

  // Revenue today / this week / this month
  if (q.includes("revenue")) {
    let interval = "0 days";
    let label = "today";

    if (q.includes("week")) {
      interval = "7 days";
      label = "this week";
    } else if (q.includes("month")) {
      interval = "30 days";
      label = "this month";
    }

    const dateFilter =
      label === "today"
        ? "created_at::date = CURRENT_DATE"
        : `created_at >= NOW() - INTERVAL '${interval}'`;

    return {
      sql: `SELECT COALESCE(SUM(amount), 0) AS total_revenue, COUNT(*) AS transaction_count
FROM transactions
WHERE studio_id = '${studioId}'
  AND status = 'completed'
  AND ${dateFilter}`,
      explanation: `Total revenue and transaction count for ${label}`,
      result_type: "stats",
      error: null,
    };
  }

  // Upcoming classes
  if (q.includes("upcoming class") || q.includes("next class")) {
    return {
      sql: `SELECT title, starts_at, ends_at, capacity, booked_count, checked_in_count, status
FROM classes
WHERE studio_id = '${studioId}'
  AND starts_at > NOW()
ORDER BY starts_at ASC
LIMIT 20`,
      explanation: "Next 20 upcoming classes ordered by start time",
      result_type: "classes",
      error: null,
    };
  }

  // Top members by visit count
  if (q.includes("top member") || q.includes("most active")) {
    const daysMatch = q.match(/(\d+)\s*days?/);
    const days = daysMatch ? parseInt(daysMatch[1], 10) : 30;

    return {
      sql: `SELECT p.full_name, p.email, COUNT(b.id) AS visit_count
FROM bookings b
JOIN members m ON m.id = b.member_id
JOIN profiles p ON p.id = m.profile_id
WHERE b.studio_id = '${studioId}'
  AND b.checked_in_at IS NOT NULL
  AND b.checked_in_at >= NOW() - INTERVAL '${days} days'
GROUP BY p.full_name, p.email
ORDER BY visit_count DESC
LIMIT 20`,
      explanation: `Top 20 members by check-in count over the last ${days} days`,
      result_type: "members",
      error: null,
    };
  }

  return null;
}

/**
 * Translate a natural language query into SQL using Claude or rules-based fallback.
 * The returned SQL is always a read-only SELECT statement scoped to the given studio.
 */
export async function translateToSQL(
  request: NLSearchRequest
): Promise<Omit<NLSearchResult, "data">> {
  const { query, studio_id } = request;

  // Try rules-based fallback first for common patterns (works without API key)
  const rulesResult = tryRulesBasedSQL(query, studio_id);

  if (!process.env.ANTHROPIC_API_KEY) {
    if (rulesResult) return rulesResult;

    return {
      sql: "",
      explanation: "",
      result_type: "other",
      error:
        'Anthropic API key not configured and query did not match a known pattern. Try: "members who haven\'t visited in 30 days", "revenue today", "upcoming classes", or "top members".',
    };
  }

  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const prompt = NL_SEARCH_SYSTEM_PROMPT.replace(
      /\$STUDIO_ID/g,
      studio_id
    );

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: prompt,
      messages: [
        {
          role: "user",
          content: query,
        },
      ],
    });

    const raw =
      message.content[0].type === "text" ? message.content[0].text : "";

    let parsed: { sql: string; explanation: string; result_type: string };
    try {
      parsed = JSON.parse(raw);
    } catch {
      // If Claude returned something unparseable, fall back to rules
      if (rulesResult) return rulesResult;

      return {
        sql: "",
        explanation: "",
        result_type: "other",
        error: "Failed to parse AI response. Please try rephrasing your query.",
      };
    }

    // Security: reject any non-SELECT statement
    const sqlTrimmed = parsed.sql.trim().toUpperCase();
    if (!sqlTrimmed.startsWith("SELECT")) {
      return {
        sql: parsed.sql,
        explanation: parsed.explanation,
        result_type: "other" as NLSearchResult["result_type"],
        error:
          "Only SELECT queries are allowed. The generated query was rejected for safety.",
      };
    }

    // Security: reject dangerous keywords in the body of the query
    const forbidden = [
      "INSERT",
      "UPDATE",
      "DELETE",
      "DROP",
      "ALTER",
      "CREATE",
      "TRUNCATE",
      "EXEC",
      "EXECUTE",
      "GRANT",
      "REVOKE",
    ];
    for (const keyword of forbidden) {
      const regex = new RegExp(`\\b${keyword}\\b`, "i");
      // Skip the initial SELECT when checking
      if (regex.test(parsed.sql.slice(6))) {
        return {
          sql: parsed.sql,
          explanation: parsed.explanation,
          result_type: "other" as NLSearchResult["result_type"],
          error: `Query contains forbidden keyword "${keyword}" and was rejected for safety.`,
        };
      }
    }

    // Verify studio_id is referenced in the query
    if (!parsed.sql.includes(studio_id)) {
      return {
        sql: parsed.sql,
        explanation: parsed.explanation,
        result_type: "other" as NLSearchResult["result_type"],
        error:
          "Query rejected: missing studio_id filter for multi-tenant safety.",
      };
    }

    const validTypes = [
      "members",
      "classes",
      "bookings",
      "transactions",
      "stats",
      "other",
    ];
    const resultType = validTypes.includes(parsed.result_type)
      ? (parsed.result_type as NLSearchResult["result_type"])
      : "other";

    return {
      sql: parsed.sql,
      explanation: parsed.explanation,
      result_type: resultType,
      error: null,
    };
  } catch (error) {
    console.error(
      "Anthropic API error in translateToSQL, trying rules fallback:",
      error
    );

    if (rulesResult) return rulesResult;

    return {
      sql: "",
      explanation: "",
      result_type: "other",
      error:
        'AI search is temporarily unavailable. Try: "members who haven\'t visited in 30 days", "revenue today", "upcoming classes", or "top members".',
    };
  }
}
