import { getAnthropicClient, AI_MODEL, extractText, parseAIJson } from "@/lib/ai/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IntakeData {
  member_id: string;
  full_name: string;
  join_date: string;
  days_since_join: number;
  membership_type: string | null;
  // First 2 weeks of behavior
  total_visits: number;
  visit_days: string[]; // which days of the week they visited
  preferred_time_slots: string[]; // morning, afternoon, evening
  classes_attended: { title: string; count: number }[];
  used_cold_plunge: boolean; // inferred from class types
  was_walk_in: boolean; // any walk-in bookings
  cancellations: number;
  no_shows: number;
  total_spend: number; // cents
  referred_by: string | null;
  purchased_merch: boolean;
}

export interface IntakeEnrichmentResult {
  member_persona:
    | "enthusiast"
    | "explorer"
    | "social"
    | "wellness_seeker"
    | "casual";
  engagement_prediction: "high" | "moderate" | "low";
  narrative: string; // 3-4 sentence behavior analysis
  suggested_next_steps: string[]; // 2-3 personalized suggestions
  ideal_class_recommendations: string[]; // class types/times to recommend
  retention_risk_early: "low" | "medium" | "high";
  personalization_tags: string[]; // tags to add to member profile
}

// ---------------------------------------------------------------------------
// AI-powered intake enrichment
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are Meridian AI, analyzing a new member's first 2 weeks of behavior at a sauna and cold plunge wellness studio. Your job is to classify their persona, predict their engagement level, and provide personalized recommendations to help the studio retain and delight them.

The studio operates group-class style sessions (hour-long time slots with sauna and cold plunge access), plus guided breathwork classes led by instructors.

Analyze the provided behavioral data and return a JSON object with exactly these fields:
- "member_persona": one of "enthusiast" (highly active, 5+ visits), "explorer" (trying different classes/times, 3-4 visits), "social" (referred by someone, community-oriented), "wellness_seeker" (consistent schedule, routine-driven), "casual" (infrequent, <2 visits)
- "engagement_prediction": one of "high", "moderate", "low"
- "narrative": string (3-4 sentences analyzing their early behavior patterns, grounded in the data)
- "suggested_next_steps": array of 2-3 strings (personalized actions the studio should take)
- "ideal_class_recommendations": array of 2-3 strings (specific class types or time slots to recommend)
- "retention_risk_early": one of "low", "medium", "high"
- "personalization_tags": array of strings (behavioral tags like "morning_person", "cold_plunge_fan", "weekend_warrior", "guided_class_lover", "social_referral", "merch_buyer", "consistent_schedule", "explorer", "high_frequency")

Be specific and data-driven in the narrative. Reference actual visit counts, days, and patterns. Avoid generic advice.

Return ONLY the JSON object. No markdown fences, no extra text.`;

/**
 * Enrich a new member's intake profile using Claude, with a robust rules-based fallback.
 */
export async function enrichIntakeProfile(
  data: IntakeData
): Promise<IntakeEnrichmentResult> {
  const anthropic = getAnthropicClient();
  if (!anthropic) {
    return generateRulesBasedEnrichment(data);
  }

  try {

    const message = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Analyze this new member's first 2 weeks of behavior:\n${JSON.stringify(data, null, 2)}`,
        },
      ],
    });

    const text = extractText(message);

    // Strip markdown fences if present
    const jsonStr = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    const parsed = JSON.parse(jsonStr) as IntakeEnrichmentResult;

    // Validate the response shape
    if (
      !["enthusiast", "explorer", "social", "wellness_seeker", "casual"].includes(
        parsed.member_persona
      ) ||
      !["high", "moderate", "low"].includes(parsed.engagement_prediction) ||
      typeof parsed.narrative !== "string" ||
      !Array.isArray(parsed.suggested_next_steps) ||
      !Array.isArray(parsed.ideal_class_recommendations) ||
      !["low", "medium", "high"].includes(parsed.retention_risk_early) ||
      !Array.isArray(parsed.personalization_tags)
    ) {
      console.error(
        "Invalid intake enrichment response shape, falling back to rules-based"
      );
      return generateRulesBasedEnrichment(data);
    }

    return parsed;
  } catch (error) {
    console.error(
      "Anthropic API error for intake enrichment, falling back to rules-based:",
      error
    );
    return generateRulesBasedEnrichment(data);
  }
}

// ---------------------------------------------------------------------------
// Rules-based fallback
// ---------------------------------------------------------------------------

function classifyPersona(data: IntakeData): IntakeEnrichmentResult["member_persona"] {
  if (data.total_visits >= 5) return "enthusiast";
  if (
    data.total_visits >= 3 &&
    data.classes_attended.length >= 2
  ) {
    return "explorer";
  }
  if (data.referred_by && data.purchased_merch) return "social";
  if (
    data.total_visits >= 2 &&
    data.preferred_time_slots.length === 1
  ) {
    return "wellness_seeker";
  }
  if (data.referred_by) return "social";
  return "casual";
}

function classifyEngagement(
  data: IntakeData
): IntakeEnrichmentResult["engagement_prediction"] {
  if (data.total_visits >= 4 && data.cancellations === 0 && data.no_shows === 0) {
    return "high";
  }
  if (data.total_visits >= 2 && data.total_visits <= 3) return "moderate";
  return "low";
}

function classifyRetentionRisk(
  data: IntakeData
): IntakeEnrichmentResult["retention_risk_early"] {
  if (data.total_visits < 2 || data.no_shows > 0) return "high";
  if (data.cancellations > 0 || data.total_visits < 3) return "medium";
  return "low";
}

function buildPersonalizationTags(data: IntakeData): string[] {
  const tags: string[] = [];

  // Time-based tags
  if (data.preferred_time_slots.includes("morning")) tags.push("morning_person");
  if (data.preferred_time_slots.includes("evening")) tags.push("evening_person");
  if (
    data.visit_days.some((d) =>
      ["Saturday", "Sunday"].includes(d)
    )
  ) {
    const weekendVisits = data.visit_days.filter((d) =>
      ["Saturday", "Sunday"].includes(d)
    ).length;
    if (weekendVisits >= 2) tags.push("weekend_warrior");
  }

  // Activity tags
  if (data.used_cold_plunge) tags.push("cold_plunge_fan");
  if (data.classes_attended.some((c) => c.title.toLowerCase().includes("guided"))) {
    tags.push("guided_class_lover");
  }
  if (data.was_walk_in) tags.push("walk_in_convert");

  // Engagement tags
  if (data.total_visits >= 5) tags.push("high_frequency");
  if (data.classes_attended.length >= 3) tags.push("explorer");
  if (data.referred_by) tags.push("social_referral");
  if (data.purchased_merch) tags.push("merch_buyer");
  if (
    data.preferred_time_slots.length === 1 &&
    data.total_visits >= 2
  ) {
    tags.push("consistent_schedule");
  }

  return tags;
}

function buildTemplateNarrative(
  data: IntakeData,
  persona: IntakeEnrichmentResult["member_persona"]
): string {
  const name = data.full_name.split(" ")[0];

  switch (persona) {
    case "enthusiast":
      return (
        `${name} has had an exceptionally strong start with ${data.total_visits} visits in their first ${data.days_since_join} days. ` +
        `They've been visiting on ${data.visit_days.slice(0, 3).join(", ")} and prefer ${data.preferred_time_slots.join(" and ")} sessions. ` +
        (data.used_cold_plunge
          ? "They've already incorporated cold plunge into their routine, showing commitment to the full experience. "
          : "") +
        "This member shows strong early engagement and is a prime candidate for community involvement."
      );

    case "explorer":
      return (
        `${name} is actively exploring with ${data.total_visits} visits across ${data.classes_attended.length} different class types in their first ${data.days_since_join} days. ` +
        `They've tried ${data.classes_attended.map((c) => c.title).join(", ")}, suggesting curiosity about different offerings. ` +
        `Their preferred time slots are ${data.preferred_time_slots.join(" and ")}. ` +
        "Helping them find their ideal routine will be key to long-term retention."
      );

    case "social":
      return (
        `${name} joined through a referral${data.referred_by ? ` from ${data.referred_by}` : ""}, indicating social motivation. ` +
        `They've logged ${data.total_visits} visit(s) in their first ${data.days_since_join} days` +
        (data.purchased_merch
          ? " and have already purchased merchandise, showing strong brand affinity. "
          : ". ") +
        "Community-oriented members like this often become advocates when nurtured with social experiences."
      );

    case "wellness_seeker":
      return (
        `${name} shows a disciplined approach with ${data.total_visits} visits, consistently attending during ${data.preferred_time_slots[0]} time slots. ` +
        `They visit on ${data.visit_days.join(", ")}, suggesting they've already established a routine. ` +
        (data.cancellations === 0 && data.no_shows === 0
          ? "Zero cancellations and no-shows reflect strong commitment. "
          : "") +
        "This member values consistency and will respond well to schedule-based recommendations."
      );

    case "casual":
      return (
        `${name} has had a slow start with only ${data.total_visits} visit(s) in their first ${data.days_since_join} days. ` +
        (data.cancellations > 0
          ? `They've had ${data.cancellations} cancellation(s), which may indicate scheduling friction. `
          : "") +
        (data.no_shows > 0
          ? `${data.no_shows} no-show(s) suggest potential engagement barriers. `
          : "") +
        "Early intervention is important — a personal check-in could help identify and remove obstacles."
      );
  }
}

function buildTemplateSuggestions(
  data: IntakeData,
  persona: IntakeEnrichmentResult["member_persona"]
): string[] {
  switch (persona) {
    case "enthusiast":
      return [
        "Invite them to a guided breathwork class to deepen their practice",
        "Add to the referral program — enthusiastic early members convert friends",
        "Consider highlighting them in the community board as a new member spotlight",
      ];

    case "explorer":
      return [
        `Recommend trying a ${data.used_cold_plunge ? "guided breathwork" : "cold plunge"} session to expand their experience`,
        "Send a personalized message asking what they've enjoyed most so far",
        "Suggest a consistent weekly time slot based on their most-visited day",
      ];

    case "social":
      return [
        "Invite them to bring a friend for a buddy session",
        "Highlight upcoming community events and group classes",
        data.total_visits < 3
          ? "Encourage more frequent visits — their social connection is strong but visit habit needs building"
          : "Recognize their early engagement with a personal welcome message",
      ];

    case "wellness_seeker":
      return [
        "Confirm their preferred time slot is consistently available on the schedule",
        "Introduce them to the wellness journey tracking features",
        "Suggest complementary class types at their preferred time",
      ];

    case "casual":
      return [
        "Send a personal check-in message asking about their experience so far",
        "Offer a guided class recommendation at a time that fits their schedule",
        data.cancellations > 0
          ? "Ask if scheduling is a challenge — suggest alternative time slots"
          : "Remind them of the benefits of building a weekly habit",
      ];
  }
}

function buildClassRecommendations(
  data: IntakeData,
  persona: IntakeEnrichmentResult["member_persona"]
): string[] {
  const recs: string[] = [];

  // Time-based recommendations
  if (data.preferred_time_slots.length > 0) {
    const preferredTime = data.preferred_time_slots[0];
    recs.push(`Open Sauna sessions during ${preferredTime} hours`);
  }

  // Activity-based recommendations
  if (!data.used_cold_plunge) {
    recs.push("Intro to Cold Plunge — beginner-friendly session");
  }

  const hasGuidedClass = data.classes_attended.some((c) =>
    c.title.toLowerCase().includes("guided")
  );
  if (!hasGuidedClass) {
    recs.push("Guided Breathwork class — great for deepening the sauna experience");
  }

  // Persona-based recommendations
  if (persona === "social" || persona === "explorer") {
    recs.push("Weekend group sessions — social atmosphere with higher attendance");
  }

  if (persona === "wellness_seeker" && data.visit_days.length > 0) {
    recs.push(
      `Regular ${data.visit_days[0]} sessions to maintain their established routine`
    );
  }

  return recs.slice(0, 3);
}

function generateRulesBasedEnrichment(
  data: IntakeData
): IntakeEnrichmentResult {
  const persona = classifyPersona(data);
  const engagement = classifyEngagement(data);
  const retentionRisk = classifyRetentionRisk(data);
  const tags = buildPersonalizationTags(data);
  const narrative = buildTemplateNarrative(data, persona);
  const suggestions = buildTemplateSuggestions(data, persona);
  const classRecs = buildClassRecommendations(data, persona);

  return {
    member_persona: persona,
    engagement_prediction: engagement,
    narrative,
    suggested_next_steps: suggestions,
    ideal_class_recommendations: classRecs,
    retention_risk_early: retentionRisk,
    personalization_tags: tags,
  };
}
