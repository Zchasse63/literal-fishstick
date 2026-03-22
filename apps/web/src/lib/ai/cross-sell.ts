import { getAnthropicClient, AI_MODEL, extractText, parseAIJson } from "@/lib/ai/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MemberSegmentUsage {
  segment_name: string; // e.g., "Unlimited Members", "10-Class Pack", "Drop-in Only"
  member_count: number;
  avg_revenue_per_member: number;
  product_usage: {
    product: string; // e.g., "classes", "merch", "events", "gift_cards", "credit_packs"
    pct_using: number; // 0-100
    avg_spend: number;
  }[];
}

export interface CrossSellInput {
  studio_id: string;
  segments: MemberSegmentUsage[];
  total_active_members: number;
  total_mrr: number;
}

export interface CrossSellOpportunity {
  segment_name: string;
  from_product: string;
  to_product: string;
  eligible_members: number;
  estimated_conversion_pct: number; // 0-100
  estimated_incremental_revenue: number; // monthly
  narrative: string; // 1-2 sentences
}

export interface CrossSellResult {
  opportunities: CrossSellOpportunity[];
  total_estimated_incremental_revenue: number;
  summary: string; // 2-3 sentence overview
  recommended_actions: string[];
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are Meridian AI, a revenue optimization analyst for a fitness and wellness studio (sauna & cold plunge). Analyze member segment data to identify cross-sell and upsell opportunities.

You will receive member segments with their product usage patterns and revenue data. Identify opportunities where members in one segment are underusing a product that members in another segment (or the same segment) frequently purchase.

Return a JSON object with exactly these fields:
- "opportunities": array of {
    "segment_name": string,
    "from_product": string (what they currently use),
    "to_product": string (what they should be offered),
    "eligible_members": number (how many in the segment haven't used this product),
    "estimated_conversion_pct": number (realistic estimate, typically 5-20%),
    "estimated_incremental_revenue": number (monthly dollar amount),
    "narrative": string (1-2 sentences explaining the opportunity)
  }
- "total_estimated_incremental_revenue": number (sum of all opportunity revenues)
- "summary": string (2-3 sentence overview of the biggest opportunities)
- "recommended_actions": array of strings (3-5 specific, actionable next steps)

Sort opportunities by estimated_incremental_revenue descending. Be realistic with conversion estimates — most cross-sell campaigns in fitness studios see 5-15% conversion.

Return ONLY the JSON object. No markdown fences, no extra text.`;

// ---------------------------------------------------------------------------
// Detect cross-sell opportunities
// ---------------------------------------------------------------------------

/**
 * Detect cross-sell opportunities using Claude, with a rules-based fallback.
 */
export async function detectCrossSellOpportunities(
  input: CrossSellInput
): Promise<CrossSellResult> {
  const anthropic = getAnthropicClient();
  if (!anthropic) {
    return generateRulesBasedCrossSell(input);
  }

  try {

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Identify cross-sell opportunities from this data:\n${JSON.stringify(input, null, 2)}`,
        },
      ],
    });

    const text = extractText(message);

    const jsonStr = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    let parsed: CrossSellResult;
    try {
      parsed = JSON.parse(jsonStr) as CrossSellResult;
    } catch (parseError) {
      console.error("Failed to parse cross-sell JSON, falling back to rules-based:", parseError);
      return generateRulesBasedCrossSell(input);
    }

    // Validate shape
    if (
      !Array.isArray(parsed.opportunities) ||
      typeof parsed.total_estimated_incremental_revenue !== "number" ||
      typeof parsed.summary !== "string" ||
      !Array.isArray(parsed.recommended_actions)
    ) {
      console.error(
        "Invalid cross-sell response shape, falling back to rules-based"
      );
      return generateRulesBasedCrossSell(input);
    }

    return parsed;
  } catch (error) {
    console.error(
      "Anthropic API error for cross-sell detection, falling back to rules-based:",
      error
    );
    return generateRulesBasedCrossSell(input);
  }
}

// ---------------------------------------------------------------------------
// Rules-based fallback
// ---------------------------------------------------------------------------

function generateRulesBasedCrossSell(input: CrossSellInput): CrossSellResult {
  const opportunities: CrossSellOpportunity[] = [];

  for (const segment of input.segments) {
    for (const usage of segment.product_usage) {
      // Find products this segment barely uses (less than 20% adoption)
      if (usage.pct_using < 20 && usage.product !== "classes") {
        const eligibleMembers = Math.round(
          segment.member_count * (1 - usage.pct_using / 100)
        );
        const conversionPct = 10; // conservative 10% estimate
        const convertedMembers = Math.round(
          eligibleMembers * (conversionPct / 100)
        );

        // Estimate revenue based on what current users spend
        const estimatedRevenue =
          usage.avg_spend > 0
            ? convertedMembers * usage.avg_spend
            : convertedMembers * 15; // default $15 if no spend data

        // Only include meaningful opportunities
        if (eligibleMembers >= 5 && estimatedRevenue >= 50) {
          // Determine "from product" — what they primarily use
          const primaryProduct = segment.product_usage.reduce((best, p) =>
            p.pct_using > best.pct_using ? p : best
          );

          opportunities.push({
            segment_name: segment.segment_name,
            from_product: primaryProduct.product,
            to_product: usage.product,
            eligible_members: eligibleMembers,
            estimated_conversion_pct: conversionPct,
            estimated_incremental_revenue:
              Math.round(estimatedRevenue * 100) / 100,
            narrative: `${Math.round(100 - usage.pct_using)}% of ${segment.segment_name} (${eligibleMembers} members) have never purchased ${usage.product}. At a ${conversionPct}% conversion rate, this could generate $${Math.round(estimatedRevenue).toLocaleString()}/month.`,
          });
        }
      }
    }

    // Check for upgrade opportunities (low-tier to high-tier)
    if (
      segment.segment_name.toLowerCase().includes("drop-in") ||
      segment.segment_name.toLowerCase().includes("class pack")
    ) {
      const eligibleMembers = Math.round(segment.member_count * 0.3); // 30% might upgrade
      const conversionPct = 8;
      const avgMembershipValue = input.total_mrr / input.total_active_members;
      const estimatedRevenue =
        Math.round(eligibleMembers * (conversionPct / 100)) *
        avgMembershipValue;

      if (eligibleMembers >= 3) {
        opportunities.push({
          segment_name: segment.segment_name,
          from_product: "limited plan",
          to_product: "membership upgrade",
          eligible_members: eligibleMembers,
          estimated_conversion_pct: conversionPct,
          estimated_incremental_revenue:
            Math.round(estimatedRevenue * 100) / 100,
          narrative: `${eligibleMembers} ${segment.segment_name} members visit frequently enough to benefit from a membership upgrade. Converting even ${conversionPct}% would add $${Math.round(estimatedRevenue).toLocaleString()}/month in MRR.`,
        });
      }
    }
  }

  // Sort by estimated revenue descending
  opportunities.sort(
    (a, b) => b.estimated_incremental_revenue - a.estimated_incremental_revenue
  );

  const totalRevenue = opportunities.reduce(
    (sum, o) => sum + o.estimated_incremental_revenue,
    0
  );

  // Build summary
  const topOpps = opportunities.slice(0, 3);
  const summary =
    opportunities.length > 0
      ? `Identified ${opportunities.length} cross-sell opportunities with a combined estimated incremental revenue of $${Math.round(totalRevenue).toLocaleString()}/month. ` +
        `The largest opportunity is targeting ${topOpps[0]?.segment_name} for ${topOpps[0]?.to_product} (${topOpps[0]?.eligible_members} eligible members). ` +
        `These estimates assume conservative conversion rates of 8-10%, typical for fitness studio campaigns.`
      : "No significant cross-sell opportunities detected with current segment data. Consider expanding product offerings or refining member segments.";

  // Build recommended actions
  const actions: string[] = [];
  if (opportunities.length > 0) {
    actions.push(
      `Launch a targeted email campaign to ${topOpps[0]?.segment_name} promoting ${topOpps[0]?.to_product}.`
    );
    actions.push(
      "Set up an automated post-class email with merch recommendations for members who haven't purchased."
    );
    actions.push(
      "Add in-app cross-sell prompts on the booking confirmation screen."
    );
    if (opportunities.some((o) => o.to_product === "membership upgrade")) {
      actions.push(
        "Enable the self-service membership upgrade flow with one-tap Stripe proration."
      );
    }
    actions.push(
      "Track conversion rates for each campaign to refine targeting."
    );
  } else {
    actions.push(
      "Review current product catalog for gaps in the member journey."
    );
    actions.push(
      "Survey members about products or services they'd like to see."
    );
    actions.push("Consider introducing gift cards or referral incentives.");
  }

  return {
    opportunities: opportunities.slice(0, 8),
    total_estimated_incremental_revenue: Math.round(totalRevenue * 100) / 100,
    summary,
    recommended_actions: actions.slice(0, 5),
  };
}
