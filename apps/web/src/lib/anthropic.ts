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
  tone?: "friendly" | "urgent" | "professional" | "casual" | "celebratory";
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
        "You are Meridian AI, writing email campaign copy for a fitness/wellness studio (sauna & cold plunge). Write compelling, on-brand copy. Never generate deceptive, misleading, or clickbait subject lines. All suggestions must be honest and CAN-SPAM compliant. Include merge tags where appropriate (Handlebars syntax like {{first_name}}). Return JSON with fields: subject_line, preview_text, body_html, body_text, suggested_merge_tags. Return ONLY the JSON object, no markdown fences or extra text.",
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

// ---------------------------------------------------------------------------
// Phase 2: Subject Line Suggestions
// ---------------------------------------------------------------------------

export interface SubjectLineContext {
  campaign_type: string;
  audience_description: string;
  tone: string;
  key_points: string[];
}

export interface SubjectLineSuggestion {
  subject_line: string;
  estimated_open_rate_improvement: string;
  rationale: string;
}

/**
 * Generate AI-powered subject line suggestions for email campaigns.
 * Falls back to rules-based suggestions if ANTHROPIC_API_KEY is not set.
 */
export async function suggestSubjectLines(
  context: SubjectLineContext
): Promise<SubjectLineSuggestion[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return generateRulesBasedSubjectLines(context);
  }

  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      system:
        "You are Meridian AI, an email marketing assistant for a fitness/wellness studio (sauna & cold plunge). Generate exactly 5 email subject line suggestions. Never generate deceptive, misleading, or clickbait subject lines. All suggestions must be honest and CAN-SPAM compliant. Return a JSON array of 5 objects, each with: subject_line (string), estimated_open_rate_improvement (string like '+12%'), rationale (string). Return ONLY the JSON array, no markdown fences or extra text.",
      messages: [
        {
          role: "user",
          content: `Generate 5 subject lines for this campaign:\nCampaign type: ${context.campaign_type}\nAudience: ${context.audience_description}\nTone: ${context.tone}\nKey points: ${context.key_points.join(", ")}`,
        },
      ],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";
    const jsonStr = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    const parsed = JSON.parse(jsonStr) as SubjectLineSuggestion[];

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error("Invalid response shape");
    }

    return parsed.slice(0, 5);
  } catch (error) {
    console.error(
      "Anthropic API error for subject lines, falling back to rules-based:",
      error
    );
    return generateRulesBasedSubjectLines(context);
  }
}

function generateRulesBasedSubjectLines(
  context: SubjectLineContext
): SubjectLineSuggestion[] {
  const templates: Record<string, SubjectLineSuggestion[]> = {
    winback: [
      { subject_line: "We miss you, {{first_name}} — your spot is waiting", estimated_open_rate_improvement: "+8%", rationale: "Personalization with name and emotional appeal" },
      { subject_line: "It's been a while — ready to sweat again?", estimated_open_rate_improvement: "+5%", rationale: "Casual re-engagement with question format" },
      { subject_line: "Come back and feel the difference this week", estimated_open_rate_improvement: "+4%", rationale: "Action-oriented with time urgency" },
      { subject_line: "Your wellness routine is calling, {{first_name}}", estimated_open_rate_improvement: "+6%", rationale: "Personalized with identity-based framing" },
      { subject_line: "The sauna is warm — we saved your spot", estimated_open_rate_improvement: "+7%", rationale: "Warm imagery with exclusivity feel" },
    ],
    upsell: [
      { subject_line: "Ready for unlimited, {{first_name}}?", estimated_open_rate_improvement: "+10%", rationale: "Direct value proposition with personalization" },
      { subject_line: "Upgrade your plan — more sessions, more results", estimated_open_rate_improvement: "+6%", rationale: "Benefit-focused upgrade prompt" },
      { subject_line: "You're outgrowing your current plan (that's a good thing)", estimated_open_rate_improvement: "+9%", rationale: "Positive framing of usage growth" },
      { subject_line: "Unlock unlimited access to every session", estimated_open_rate_improvement: "+7%", rationale: "Clear value statement with action verb" },
      { subject_line: "{{first_name}}, your next level is waiting", estimated_open_rate_improvement: "+5%", rationale: "Aspirational language with personalization" },
    ],
    retention: [
      { subject_line: "Keep your streak alive, {{first_name}}", estimated_open_rate_improvement: "+11%", rationale: "Streak psychology with personalization" },
      { subject_line: "You've been crushing it — don't stop now", estimated_open_rate_improvement: "+8%", rationale: "Positive reinforcement with momentum" },
      { subject_line: "Your next session is just a tap away", estimated_open_rate_improvement: "+5%", rationale: "Low-friction action-oriented" },
      { subject_line: "{{first_name}}, book your next sweat session", estimated_open_rate_improvement: "+6%", rationale: "Personalized direct call-to-action" },
      { subject_line: "Great things happen when you show up consistently", estimated_open_rate_improvement: "+4%", rationale: "Motivational consistency message" },
    ],
    promotion: [
      { subject_line: "Special offer: limited spots available this week", estimated_open_rate_improvement: "+12%", rationale: "Scarcity without being deceptive" },
      { subject_line: "{{first_name}}, an exclusive offer just for you", estimated_open_rate_improvement: "+9%", rationale: "Personalized exclusivity" },
      { subject_line: "This week only — save on your favorite sessions", estimated_open_rate_improvement: "+7%", rationale: "Time-bound with value clarity" },
      { subject_line: "Your studio has a treat for you, {{first_name}}", estimated_open_rate_improvement: "+6%", rationale: "Warm, gift-like framing" },
      { subject_line: "Don't miss this — new member pricing for upgrades", estimated_open_rate_improvement: "+8%", rationale: "Clear offer with urgency" },
    ],
  };

  const defaultLines: SubjectLineSuggestion[] = [
    { subject_line: "What's new at the studio this week, {{first_name}}", estimated_open_rate_improvement: "+5%", rationale: "Personalized curiosity-driven subject" },
    { subject_line: "Your weekly wellness update is here", estimated_open_rate_improvement: "+3%", rationale: "Consistent newsletter-style format" },
    { subject_line: "New sessions, events, and more — check it out", estimated_open_rate_improvement: "+4%", rationale: "Multi-value teaser" },
    { subject_line: "{{first_name}}, here's what's happening this week", estimated_open_rate_improvement: "+6%", rationale: "Personalized with timely relevance" },
    { subject_line: "Fresh schedule just dropped — book your spot", estimated_open_rate_improvement: "+7%", rationale: "Action-oriented with freshness" },
  ];

  return templates[context.campaign_type] ?? defaultLines;
}

// ---------------------------------------------------------------------------
// Phase 2: Lead Scoring
// ---------------------------------------------------------------------------

export interface LeadScoreInput {
  lead_id: string;
  first_name: string;
  email: string;
  phone: string | null;
  source: string;
  days_since_created: number;
  activity_count_7d: number;
  activity_count_30d: number;
  emails_opened: number;
  emails_clicked: number;
  trial_booked: boolean;
  source_detail: string | null;
}

export interface LeadScoreResult {
  score: number; // 0-100
  factors: string[];
  recommended_action: string;
  priority: "hot" | "warm" | "cold";
}

/**
 * Score a lead using AI analysis of their engagement data.
 * Falls back to rules-based scoring if ANTHROPIC_API_KEY is not set.
 */
export async function scoreLead(
  leadData: LeadScoreInput
): Promise<LeadScoreResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return generateRulesBasedLeadScore(leadData);
  }

  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      system:
        "You are Meridian AI. Score a lead (0-100) for a fitness/wellness studio based on their engagement data. Score meaning: 70-100 hot (ready to convert), 40-69 warm (engaged but needs nurturing), 0-39 cold (low engagement). Return JSON with: score (number 0-100), factors (array of strings explaining key scoring factors), recommended_action (string with specific next step), priority ('hot' | 'warm' | 'cold'). Return ONLY the JSON object, no markdown fences.",
      messages: [
        {
          role: "user",
          content: `Score this lead:\n${JSON.stringify(leadData, null, 2)}`,
        },
      ],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";
    const jsonStr = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    const parsed = JSON.parse(jsonStr) as LeadScoreResult;

    if (
      typeof parsed.score !== "number" ||
      !Array.isArray(parsed.factors) ||
      !["hot", "warm", "cold"].includes(parsed.priority)
    ) {
      throw new Error("Invalid lead score response shape");
    }

    parsed.score = Math.max(0, Math.min(100, Math.round(parsed.score)));

    return parsed;
  } catch (error) {
    console.error(
      "Anthropic API error for lead scoring, falling back to rules-based:",
      error
    );
    return generateRulesBasedLeadScore(leadData);
  }
}

function generateRulesBasedLeadScore(
  leadData: LeadScoreInput
): LeadScoreResult {
  let score = 30; // baseline
  const factors: string[] = [];

  // Source weight
  const highValueSources = ["referral", "google", "instagram"];
  const mediumValueSources = ["website", "walk-in", "event"];
  if (highValueSources.includes(leadData.source.toLowerCase())) {
    score += 15;
    factors.push(`High-value source: ${leadData.source}`);
  } else if (mediumValueSources.includes(leadData.source.toLowerCase())) {
    score += 8;
    factors.push(`Medium-value source: ${leadData.source}`);
  }

  // Activity weight
  if (leadData.activity_count_7d >= 3) {
    score += 20;
    factors.push(`High recent activity: ${leadData.activity_count_7d} actions in 7 days`);
  } else if (leadData.activity_count_7d >= 1) {
    score += 10;
    factors.push(`Some recent activity: ${leadData.activity_count_7d} actions in 7 days`);
  }

  if (leadData.activity_count_30d >= 5) {
    score += 10;
    factors.push(`Strong 30-day engagement: ${leadData.activity_count_30d} actions`);
  }

  // Email engagement weight
  if (leadData.emails_clicked > 0) {
    score += 15;
    factors.push(`Email click-through: ${leadData.emails_clicked} clicks`);
  } else if (leadData.emails_opened > 0) {
    score += 5;
    factors.push(`Email opens: ${leadData.emails_opened} opened`);
  }

  // Trial booked is a strong signal
  if (leadData.trial_booked) {
    score += 20;
    factors.push("Trial session booked — high intent");
  }

  // Phone provided
  if (leadData.phone) {
    score += 5;
    factors.push("Phone number provided");
  }

  // Recency decay
  if (leadData.days_since_created > 30) {
    score -= 10;
    factors.push(`Lead aging: ${leadData.days_since_created} days old`);
  } else if (leadData.days_since_created > 14) {
    score -= 5;
    factors.push(`Lead created ${leadData.days_since_created} days ago`);
  }

  score = Math.max(0, Math.min(100, score));

  const priority: LeadScoreResult["priority"] =
    score >= 70 ? "hot" : score >= 40 ? "warm" : "cold";

  let recommendedAction: string;
  if (priority === "hot") {
    recommendedAction =
      "Reach out directly — this lead is ready to convert. Offer a trial session or membership consultation.";
  } else if (priority === "warm") {
    recommendedAction =
      "Nurture with targeted content. Send a personalized email highlighting class options and member benefits.";
  } else {
    recommendedAction =
      "Add to drip campaign. Monitor for engagement signals before personal outreach.";
  }

  return { score, factors, recommended_action: recommendedAction, priority };
}

// ---------------------------------------------------------------------------
// Phase 2: Send Time Optimization
// ---------------------------------------------------------------------------

export interface SendTimeInput {
  member_id: string;
  timezone: string;
  recent_open_times: string[]; // ISO datetime strings of recent email opens
  recent_booking_times: string[]; // ISO datetime strings of recent bookings
  membership_type: string | null;
}

export interface SendTimeResult {
  optimal_hour: number; // 0-23
  optimal_day: string; // e.g. "Tuesday"
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
  if (!process.env.ANTHROPIC_API_KEY) {
    return generateRulesBasedSendTime(memberData);
  }

  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
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

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";
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

// ---------------------------------------------------------------------------
// Phase 2: Campaign Summary
// ---------------------------------------------------------------------------

export interface CampaignSummaryInput {
  campaign_name: string;
  channel: string;
  sent_count: number;
  delivered_count: number;
  open_count: number;
  click_count: number;
  bounce_count: number;
  unsubscribe_count: number;
  conversion_count: number;
  revenue_attributed: number;
  segment_name: string;
  sent_at: string;
}

export interface CampaignSummaryResult {
  summary: string;
  highlights: string[];
  concerns: string[];
  recommendation: string;
}

/**
 * Generate an AI-powered post-campaign summary with performance analysis.
 * Falls back to rules-based templates if ANTHROPIC_API_KEY is not set.
 */
export async function summarizeCampaign(
  data: CampaignSummaryInput
): Promise<CampaignSummaryResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return generateRulesBasedCampaignSummary(data);
  }

  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      system:
        "You are Meridian AI. Summarize the performance of an email/SMS campaign for a fitness/wellness studio. Be data-driven and actionable. Return JSON with: summary (2-3 sentence overview), highlights (array of positive takeaways), concerns (array of issues to watch), recommendation (single actionable next step). Return ONLY the JSON object, no markdown fences.",
      messages: [
        {
          role: "user",
          content: `Summarize this campaign's performance:\n${JSON.stringify(data, null, 2)}`,
        },
      ],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";
    const jsonStr = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    const parsed = JSON.parse(jsonStr) as CampaignSummaryResult;

    if (
      typeof parsed.summary !== "string" ||
      !Array.isArray(parsed.highlights) ||
      !Array.isArray(parsed.concerns) ||
      typeof parsed.recommendation !== "string"
    ) {
      throw new Error("Invalid campaign summary response shape");
    }

    return parsed;
  } catch (error) {
    console.error(
      "Anthropic API error for campaign summary, falling back to rules-based:",
      error
    );
    return generateRulesBasedCampaignSummary(data);
  }
}

function generateRulesBasedCampaignSummary(
  data: CampaignSummaryInput
): CampaignSummaryResult {
  const openRate =
    data.delivered_count > 0
      ? ((data.open_count / data.delivered_count) * 100).toFixed(1)
      : "0.0";
  const clickRate =
    data.delivered_count > 0
      ? ((data.click_count / data.delivered_count) * 100).toFixed(1)
      : "0.0";
  const bounceRate =
    data.sent_count > 0
      ? ((data.bounce_count / data.sent_count) * 100).toFixed(1)
      : "0.0";
  const conversionRate =
    data.click_count > 0
      ? ((data.conversion_count / data.click_count) * 100).toFixed(1)
      : "0.0";
  const deliveryRate =
    data.sent_count > 0
      ? ((data.delivered_count / data.sent_count) * 100).toFixed(1)
      : "0.0";

  const summary = `"${data.campaign_name}" was sent to ${data.sent_count.toLocaleString()} recipients in the "${data.segment_name}" segment via ${data.channel}. It achieved a ${openRate}% open rate and ${clickRate}% click rate, generating ${data.conversion_count} conversions and $${data.revenue_attributed.toLocaleString()} in attributed revenue.`;

  const highlights: string[] = [];
  const concerns: string[] = [];

  if (parseFloat(openRate) >= 25) {
    highlights.push(`Strong open rate of ${openRate}% (above 25% benchmark)`);
  }
  if (parseFloat(clickRate) >= 3) {
    highlights.push(`Solid click rate of ${clickRate}% (above 3% benchmark)`);
  }
  if (data.conversion_count > 0) {
    highlights.push(
      `${data.conversion_count} conversions with ${conversionRate}% click-to-conversion rate`
    );
  }
  if (data.revenue_attributed > 0) {
    highlights.push(
      `$${data.revenue_attributed.toLocaleString()} revenue attributed`
    );
  }
  if (parseFloat(deliveryRate) >= 98) {
    highlights.push(`Excellent delivery rate of ${deliveryRate}%`);
  }

  if (parseFloat(openRate) < 15) {
    concerns.push(
      `Open rate of ${openRate}% is below the 15% minimum threshold — consider testing subject lines`
    );
  }
  if (parseFloat(bounceRate) > 3) {
    concerns.push(
      `Bounce rate of ${bounceRate}% exceeds 3% — review list hygiene`
    );
  }
  if (data.unsubscribe_count > 0) {
    const unsubRate =
      data.delivered_count > 0
        ? ((data.unsubscribe_count / data.delivered_count) * 100).toFixed(2)
        : "0.00";
    concerns.push(
      `${data.unsubscribe_count} unsubscribes (${unsubRate}%) — monitor content relevance`
    );
  }
  if (parseFloat(clickRate) < 1 && parseFloat(openRate) >= 15) {
    concerns.push(
      `Low click rate (${clickRate}%) despite decent opens — improve CTA placement or copy`
    );
  }

  if (highlights.length === 0) {
    highlights.push("Campaign delivered successfully");
  }
  if (concerns.length === 0) {
    concerns.push("No significant concerns detected");
  }

  let recommendation: string;
  if (parseFloat(openRate) < 15) {
    recommendation =
      "A/B test subject lines on the next campaign to improve open rates. Try personalization or urgency-based subjects.";
  } else if (parseFloat(clickRate) < 1) {
    recommendation =
      "Focus on improving click-through rates. Test different CTA button copy, placement, and offer clarity.";
  } else if (data.conversion_count === 0 && data.click_count > 0) {
    recommendation =
      "Clicks are happening but not converting. Review the landing page experience and simplify the conversion path.";
  } else {
    recommendation =
      "Campaign performed well. Replicate this approach for the next send and consider expanding the segment.";
  }

  return { summary, highlights, concerns, recommendation };
}

// ---------------------------------------------------------------------------
// Phase 2: Automation Recommendations
// ---------------------------------------------------------------------------

export interface AutomationRecommendationInput {
  active_members: number;
  at_risk_members: number;
  new_members_30d: number;
  avg_visits_per_week: number;
  churn_rate_30d: number;
  active_automations: string[];
  revenue_mtd: number;
}

export interface AutomationRecommendation {
  name: string;
  trigger_type: string;
  description: string;
  estimated_impact: string;
  priority: "high" | "medium" | "low";
}

/**
 * Recommend marketing automations based on studio data and current automation state.
 * Falls back to rules-based recommendations if ANTHROPIC_API_KEY is not set.
 */
export async function recommendAutomations(
  studioData: AutomationRecommendationInput
): Promise<AutomationRecommendation[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return generateRulesBasedAutomationRecommendations(studioData);
  }

  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      system:
        "You are Meridian AI. Recommend marketing automations for a fitness/wellness studio based on their metrics and current automation setup. Prioritize automations that address the biggest gaps. Return a JSON array of objects with: name (string), trigger_type (string like 'event-based', 'time-based', 'threshold-based'), description (string), estimated_impact (string describing expected outcome), priority ('high' | 'medium' | 'low'). Return ONLY the JSON array, no markdown fences.",
      messages: [
        {
          role: "user",
          content: `Recommend automations for this studio:\n${JSON.stringify(studioData, null, 2)}`,
        },
      ],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";
    const jsonStr = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    const parsed = JSON.parse(jsonStr) as AutomationRecommendation[];

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error("Invalid automation recommendations response shape");
    }

    return parsed;
  } catch (error) {
    console.error(
      "Anthropic API error for automation recommendations, falling back to rules-based:",
      error
    );
    return generateRulesBasedAutomationRecommendations(studioData);
  }
}

function generateRulesBasedAutomationRecommendations(
  studioData: AutomationRecommendationInput
): AutomationRecommendation[] {
  const recommendations: AutomationRecommendation[] = [];
  const activeSet = new Set(
    studioData.active_automations.map((a) => a.toLowerCase())
  );

  // Core 4 automations — recommend any that aren't active
  if (!activeSet.has("welcome series") && !activeSet.has("welcome")) {
    recommendations.push({
      name: "Welcome Series",
      trigger_type: "event-based",
      description:
        "Automatically send a 3-email welcome sequence when a new member joins. Includes studio intro, first visit tips, and a check-in after their first week.",
      estimated_impact: `With ${studioData.new_members_30d} new members in the last 30 days, a welcome series can improve first-month retention by 15-25%.`,
      priority: "high",
    });
  }

  if (!activeSet.has("win-back") && !activeSet.has("winback") && !activeSet.has("re-engagement")) {
    const urgency = studioData.at_risk_members > studioData.active_members * 0.1 ? "high" : "medium";
    recommendations.push({
      name: "Win-Back Campaign",
      trigger_type: "threshold-based",
      description:
        "Trigger a re-engagement email when a member hasn't visited in 14+ days. Escalate to a personal outreach task at 30+ days.",
      estimated_impact: `${studioData.at_risk_members} members are currently at risk. Win-back automations typically recover 10-15% of lapsed members.`,
      priority: urgency,
    });
  }

  if (!activeSet.has("failed payment") && !activeSet.has("dunning") && !activeSet.has("payment recovery")) {
    recommendations.push({
      name: "Failed Payment Recovery",
      trigger_type: "event-based",
      description:
        "Send an automated email when a recurring payment fails. Follow up at 3, 7, and 14 days with escalating urgency. Pause membership after 14 days.",
      estimated_impact:
        "Automated dunning recovers 30-50% of failed payments that would otherwise churn. Protects recurring revenue.",
      priority: "high",
    });
  }

  if (!activeSet.has("churn prevention") && !activeSet.has("churn")) {
    const urgency = studioData.churn_rate_30d > 0.05 ? "high" : "medium";
    recommendations.push({
      name: "Churn Prevention",
      trigger_type: "threshold-based",
      description:
        "Monitor member health scores and trigger personalized outreach when a member's score drops below 40. Include special offers or personal check-ins.",
      estimated_impact: `Current 30-day churn rate is ${(studioData.churn_rate_30d * 100).toFixed(1)}%. Proactive churn prevention can reduce churn by 20-30%.`,
      priority: urgency,
    });
  }

  // Additional recommendations based on studio data
  if (recommendations.length < 3) {
    if (!activeSet.has("milestone") && !activeSet.has("celebration")) {
      recommendations.push({
        name: "Milestone Celebrations",
        trigger_type: "threshold-based",
        description:
          "Automatically congratulate members at key milestones: 10th visit, 50th visit, 1-year anniversary. Include a small reward or social share prompt.",
        estimated_impact:
          "Milestone emails have 2-3x higher engagement than standard campaigns and reinforce long-term commitment.",
        priority: "low",
      });
    }

    if (!activeSet.has("referral") && !activeSet.has("refer a friend")) {
      recommendations.push({
        name: "Referral Prompt",
        trigger_type: "time-based",
        description:
          "Send a referral prompt to highly engaged members (health score 80+) after their 5th visit. Include a shareable link or promo code.",
        estimated_impact:
          "Referred members have 25% higher retention. Automating referral asks at peak engagement maximizes conversion.",
        priority: "medium",
      });
    }
  }

  return recommendations;
}
