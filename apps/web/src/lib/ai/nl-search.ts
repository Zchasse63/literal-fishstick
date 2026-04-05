/**
 * AI Natural Language Search — Cmd+K SQL translation.
 *
 * Extracted from lib/anthropic.ts (MED-09).
 */
import { getAnthropicClient, AI_MODEL, withRetry } from "@/lib/ai/client";

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

export const SCHEMA_CONTEXT = `You have access to the following Postgres tables in a multi-tenant fitness studio platform. Every query MUST filter by studio_id.

Tables:
- profiles (id uuid, full_name text, email text, phone text, health_score int, health_risk_level text, studio_id uuid, date_of_birth date, is_active boolean, exclude_from_analytics boolean, glofox_id text, glofox_write_status text, created_at timestamptz)
- members (id uuid, profile_id uuid, studio_id uuid, membership_tier text, membership_status text, membership_plan_id uuid, credits_remaining int, join_date date, last_visit timestamptz, total_visits int, lifetime_value int, glofox_id text, glofox_membership_id text, created_at timestamptz)
- bookings (id uuid, member_id uuid, class_id uuid, studio_id uuid, status text, is_walk_in boolean, attended boolean, checked_in_at timestamptz, glofox_id text, glofox_write_status text, glofox_write_error text, created_at timestamptz)
- classes (id uuid, title text, starts_at timestamptz, ends_at timestamptz, capacity int, booked_count int, checked_in_count int, status text, studio_id uuid, class_type_id uuid, program_id uuid, facility_id uuid, trainer_id uuid, glofox_id text, created_at timestamptz)
- transactions (id uuid, member_id uuid, studio_id uuid, amount int, type text, status text, currency text, tax_amount int, discount_id text, promo_code text, glofox_id text, glofox_charge_id text, created_at timestamptz)
- member_tags (id uuid, member_id uuid, tag text, metadata jsonb)
- email_send_log (id uuid, recipient_email text, studio_id uuid, status text, opened_at timestamptz, clicked_at timestamptz, created_at timestamptz)
- staff (id uuid, full_name text, role text, email text, studio_id uuid, created_at timestamptz)
- programs (id uuid, studio_id uuid, name text, description text, glofox_id text, active boolean, created_at timestamptz)
- facilities (id uuid, studio_id uuid, name text, description text, capacity int, glofox_id text, active boolean, created_at timestamptz)
- integrations (id uuid, studio_id uuid, provider text, status text, config jsonb, created_at timestamptz)
- tax_configurations (id uuid, studio_id uuid, name text, rate numeric, is_default boolean, active boolean, created_at timestamptz)
- discounts (id uuid, studio_id uuid, name text, rate_type text, rate_value numeric, num_cycles int, glofox_id text, active boolean, created_at timestamptz)
- trainers (id uuid, studio_id uuid, profile_id uuid, promo_code text, glofox_id text, created_at timestamptz)
- trainer_bonuses (id uuid, trainer_id uuid, class_id uuid, studio_id uuid, check_in_count int, threshold int, status text, created_at timestamptz)
- appointments (id uuid, studio_id uuid, member_id uuid, trainer_id uuid, title text, start_time timestamptz, end_time timestamptz, status text, price int, glofox_id text, created_at timestamptz)
- leads (id uuid, studio_id uuid, full_name text, email text, phone text, source text, status text, score int, assigned_to uuid, notes text, converted_member_id uuid, created_at timestamptz, updated_at timestamptz)
- lead_interactions (id uuid, studio_id uuid, lead_id uuid, type text, notes text, created_by uuid, created_at timestamptz)
- glofox_sync_conflicts (id uuid, studio_id uuid, entity_type text, entity_id text, glofox_id text, conflict_type text, glofox_data jsonb, meridian_data jsonb, resolved boolean, created_at timestamptz)

Important relationships:
- bookings.member_id references members.id
- bookings.class_id references classes.id
- members.profile_id references profiles.id
- transactions.member_id references members.id
- classes.program_id references programs.id
- classes.facility_id references facilities.id
- classes.trainer_id references profiles.id (trainer role)
- trainers.profile_id references profiles.id
- trainer_bonuses.trainer_id references trainers.id
- trainer_bonuses.class_id references classes.id
- appointments.member_id references members.id
- appointments.trainer_id references profiles.id
- lead_interactions.lead_id references leads.id
- leads.assigned_to references profiles.id
- leads.converted_member_id references members.id

Notes:
- Transaction amounts are stored in CENTS (divide by 100 for display)
- Trainer bonuses are based on CHECK-INS (not bookings), trainer's own attendance doesn't count
- discount_id and promo_code on transactions are mutually exclusive
- glofox_write_status values: null (not applicable), 'pending', 'synced', 'failed'
- Programs: 'Open Sauna', 'Guided Breathwork', 'Private Session'`;

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
      sql: `SELECT p.full_name, p.email, m.membership_tier, m.membership_status, m.credits_remaining
FROM members m
JOIN profiles p ON p.id = m.profile_id
WHERE m.studio_id = '${studioId}'
  AND m.membership_status = 'active'
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

  const anthropic = getAnthropicClient();
  if (!anthropic) {
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
    const prompt = NL_SEARCH_SYSTEM_PROMPT.replace(
      /\$STUDIO_ID/g,
      studio_id
    );

    const message = await withRetry(() => anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 1024,
      system: prompt,
      messages: [
        {
          role: "user",
          content: query,
        },
      ],
    }));

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

    // Verify studio_id appears in a WHERE clause context
    const studioIdPattern = new RegExp(
      `studio_id\\s*=\\s*'${studio_id.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}'`,
      'i'
    );
    if (!studioIdPattern.test(parsed.sql)) {
      return {
        sql: parsed.sql,
        explanation: parsed.explanation,
        result_type: "other" as NLSearchResult["result_type"],
        error:
          "Query rejected: missing studio_id = '...' filter for multi-tenant safety.",
      };
    }

    // Enforce LIMIT to prevent unbounded result sets
    const hasLimit = /\bLIMIT\s+\d+/i.test(parsed.sql);
    if (!hasLimit) {
      parsed.sql = parsed.sql.replace(/;?\s*$/, '') + ' LIMIT 100';
    } else {
      // Cap existing LIMIT to 100
      parsed.sql = parsed.sql.replace(
        /\bLIMIT\s+(\d+)/i,
        (_match, n) => `LIMIT ${Math.min(parseInt(n, 10), 100)}`
      );
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
