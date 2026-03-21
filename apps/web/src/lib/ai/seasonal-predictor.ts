import Anthropic from "@anthropic-ai/sdk";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DailyMetric {
  date: string; // ISO date
  bookings: number;
  revenue: number;
  member_count: number;
}

export interface SeasonalInput {
  studio_id: string;
  daily_metrics: DailyMetric[]; // 12+ months of data
  studio_type: string; // e.g., "sauna_recovery", "yoga", "pilates"
  location_climate: string; // e.g., "subtropical" (Tampa), "temperate", "cold"
}

export interface WeeklyForecast {
  week_start: string; // ISO date
  projected_bookings: number;
  projected_revenue: number;
  projected_member_count: number;
  confidence: number; // 0-100
}

export interface PeakTrough {
  type: "peak" | "trough";
  week_start: string;
  metric: "bookings" | "revenue";
  projected_value: number;
  narrative: string;
}

export interface SeasonalPrediction {
  forecast: WeeklyForecast[]; // next 90 days, weekly
  peaks: PeakTrough[];
  troughs: PeakTrough[];
  confidence_range: {
    low_pct: number; // e.g., 10 means forecast could be 10% lower
    high_pct: number; // e.g., 15 means forecast could be 15% higher
  };
  narrative: string; // 3-5 sentences
  year_over_year_growth_rate: number; // percentage
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are Meridian AI, a demand forecasting analyst for a fitness and wellness studio (sauna & cold plunge). Analyze historical daily metrics to predict the next 90 days.

You will receive 12+ months of daily metrics (bookings, revenue, member counts), along with studio type and location climate context. Use seasonal patterns, year-over-year trends, and climate context to produce a 90-day weekly forecast.

Return a JSON object with exactly these fields:
- "forecast": array of 13 objects (one per week for 90 days), each with:
  - "week_start": ISO date string (Monday of each week)
  - "projected_bookings": number (weekly total)
  - "projected_revenue": number (weekly total in dollars)
  - "projected_member_count": number (expected active members that week)
  - "confidence": number 0-100 (higher for near-term, lower for far-out)
- "peaks": array of { "type": "peak", "week_start": string, "metric": "bookings" | "revenue", "projected_value": number, "narrative": string } — the 1-3 highest predicted weeks
- "troughs": array of { "type": "trough", "week_start": string, "metric": "bookings" | "revenue", "projected_value": number, "narrative": string } — the 1-3 lowest predicted weeks
- "confidence_range": { "low_pct": number, "high_pct": number } — how much actual values might deviate from forecast
- "narrative": string (3-5 sentences summarizing expected trends, seasonal patterns, and key events to prepare for)
- "year_over_year_growth_rate": number (percentage growth rate applied)

For sauna/recovery studios in subtropical climates (like Tampa), note that:
- Summer heat reduces demand (people seek less additional heat)
- Winter/cool months increase demand
- New Year (January) typically spikes
- Holiday weeks (Thanksgiving, Christmas) dip

Return ONLY the JSON object. No markdown fences, no extra text.`;

// ---------------------------------------------------------------------------
// Predict seasonal trends
// ---------------------------------------------------------------------------

/**
 * Predict seasonal trends using Claude, with a rules-based fallback.
 */
export async function predictSeasonalTrends(
  data: SeasonalInput
): Promise<SeasonalPrediction> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return generateRulesBasedPrediction(data);
  }

  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Downsample daily metrics to weekly for token efficiency
    const weeklyAggregated = aggregateToWeekly(data.daily_metrics);

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2500,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Predict the next 90 days based on this historical data:\n${JSON.stringify({ ...data, daily_metrics: undefined, weekly_metrics: weeklyAggregated }, null, 2)}`,
        },
      ],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";

    const jsonStr = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    let parsed: SeasonalPrediction;
    try {
      parsed = JSON.parse(jsonStr) as SeasonalPrediction;
    } catch (parseError) {
      console.error("Failed to parse seasonal prediction JSON, falling back to rules-based:", parseError);
      return generateRulesBasedPrediction(data);
    }

    // Validate shape
    if (
      !Array.isArray(parsed.forecast) ||
      parsed.forecast.length === 0 ||
      typeof parsed.narrative !== "string" ||
      !Array.isArray(parsed.peaks) ||
      !Array.isArray(parsed.troughs) ||
      typeof parsed.confidence_range !== "object" ||
      typeof parsed.year_over_year_growth_rate !== "number"
    ) {
      console.error(
        "Invalid seasonal prediction response shape, falling back to rules-based"
      );
      return generateRulesBasedPrediction(data);
    }

    return parsed;
  } catch (error) {
    console.error(
      "Anthropic API error for seasonal prediction, falling back to rules-based:",
      error
    );
    return generateRulesBasedPrediction(data);
  }
}

// ---------------------------------------------------------------------------
// Helper: aggregate daily to weekly
// ---------------------------------------------------------------------------

interface WeeklyAggregate {
  week_start: string;
  total_bookings: number;
  total_revenue: number;
  avg_member_count: number;
}

function aggregateToWeekly(dailyMetrics: DailyMetric[]): WeeklyAggregate[] {
  if (dailyMetrics.length === 0) return [];

  const weeks: Map<
    string,
    { bookings: number; revenue: number; members: number[]; }
  > = new Map();

  for (const day of dailyMetrics) {
    const date = new Date(day.date);
    // Get Monday of the week
    const dayOfWeek = date.getUTCDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(date);
    monday.setUTCDate(monday.getUTCDate() + mondayOffset);
    const weekKey = monday.toISOString().split("T")[0];

    const existing = weeks.get(weekKey) || {
      bookings: 0,
      revenue: 0,
      members: [],
    };
    existing.bookings += day.bookings;
    existing.revenue += day.revenue;
    existing.members.push(day.member_count);
    weeks.set(weekKey, existing);
  }

  return Array.from(weeks.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, data]) => ({
      week_start: weekStart,
      total_bookings: data.bookings,
      total_revenue: Math.round(data.revenue * 100) / 100,
      avg_member_count: Math.round(
        data.members.reduce((s, m) => s + m, 0) / data.members.length
      ),
    }));
}

// ---------------------------------------------------------------------------
// Rules-based fallback
// ---------------------------------------------------------------------------

function generateRulesBasedPrediction(
  data: SeasonalInput
): SeasonalPrediction {
  const weekly = aggregateToWeekly(data.daily_metrics);

  if (weekly.length === 0) {
    return emptyPrediction();
  }

  // Calculate year-over-year growth rate
  const recentWeeks = weekly.slice(-13); // last ~3 months
  const yearAgoStart = weekly.length >= 52 ? weekly.length - 52 : 0;
  const yearAgoWeeks = weekly.slice(yearAgoStart, yearAgoStart + 13);

  let yoyGrowthRate = 5; // default 5% if not enough data
  if (yearAgoWeeks.length >= 4 && recentWeeks.length >= 4) {
    const recentAvgRev =
      recentWeeks.reduce((s, w) => s + w.total_revenue, 0) /
      recentWeeks.length;
    const yearAgoAvgRev =
      yearAgoWeeks.reduce((s, w) => s + w.total_revenue, 0) /
      yearAgoWeeks.length;
    if (yearAgoAvgRev > 0) {
      yoyGrowthRate =
        ((recentAvgRev - yearAgoAvgRev) / yearAgoAvgRev) * 100;
    }
  }

  const growthMultiplier = 1 + yoyGrowthRate / 100;

  // Get same-period-last-year data as baseline for next 90 days
  const today = new Date();
  const forecast: WeeklyForecast[] = [];

  for (let i = 0; i < 13; i++) {
    const weekStart = new Date(today);
    // Advance to next Monday
    const dayOfWeek = weekStart.getUTCDay();
    const toNextMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
    weekStart.setUTCDate(weekStart.getUTCDate() + toNextMonday + i * 7);
    const weekStartStr = weekStart.toISOString().split("T")[0];

    // Find same week last year
    const lastYearWeek = new Date(weekStart);
    lastYearWeek.setUTCFullYear(lastYearWeek.getUTCFullYear() - 1);
    const lastYearWeekStr = lastYearWeek.toISOString().split("T")[0];

    // Find closest week in historical data
    const baseline = findClosestWeek(weekly, lastYearWeekStr);

    if (baseline) {
      forecast.push({
        week_start: weekStartStr,
        projected_bookings: Math.round(
          baseline.total_bookings * growthMultiplier
        ),
        projected_revenue:
          Math.round(baseline.total_revenue * growthMultiplier * 100) / 100,
        projected_member_count: Math.round(
          baseline.avg_member_count * growthMultiplier
        ),
        confidence: Math.max(40, 85 - i * 3), // decreasing confidence
      });
    } else {
      // Use recent average as fallback
      const recentAvg = recentWeeks.length > 0
        ? {
            bookings:
              recentWeeks.reduce((s, w) => s + w.total_bookings, 0) /
              recentWeeks.length,
            revenue:
              recentWeeks.reduce((s, w) => s + w.total_revenue, 0) /
              recentWeeks.length,
            members:
              recentWeeks.reduce((s, w) => s + w.avg_member_count, 0) /
              recentWeeks.length,
          }
        : { bookings: 0, revenue: 0, members: 0 };

      forecast.push({
        week_start: weekStartStr,
        projected_bookings: Math.round(recentAvg.bookings),
        projected_revenue: Math.round(recentAvg.revenue * 100) / 100,
        projected_member_count: Math.round(recentAvg.members),
        confidence: Math.max(30, 70 - i * 4),
      });
    }
  }

  // Identify peaks and troughs
  const byBookings = [...forecast].sort(
    (a, b) => b.projected_bookings - a.projected_bookings
  );
  const byRevenue = [...forecast].sort(
    (a, b) => b.projected_revenue - a.projected_revenue
  );

  const peaks: PeakTrough[] = [];
  const troughs: PeakTrough[] = [];

  if (forecast.length > 0) {
    peaks.push({
      type: "peak",
      week_start: byBookings[0].week_start,
      metric: "bookings",
      projected_value: byBookings[0].projected_bookings,
      narrative: `Week of ${byBookings[0].week_start} is projected to be the highest booking week with ${byBookings[0].projected_bookings} bookings.`,
    });

    if (byRevenue[0].week_start !== byBookings[0].week_start) {
      peaks.push({
        type: "peak",
        week_start: byRevenue[0].week_start,
        metric: "revenue",
        projected_value: byRevenue[0].projected_revenue,
        narrative: `Week of ${byRevenue[0].week_start} is expected to generate the highest revenue at $${byRevenue[0].projected_revenue.toLocaleString()}.`,
      });
    }

    troughs.push({
      type: "trough",
      week_start: byBookings[byBookings.length - 1].week_start,
      metric: "bookings",
      projected_value: byBookings[byBookings.length - 1].projected_bookings,
      narrative: `Week of ${byBookings[byBookings.length - 1].week_start} is projected to have the lowest demand at ${byBookings[byBookings.length - 1].projected_bookings} bookings.`,
    });

    troughs.push({
      type: "trough",
      week_start: byRevenue[byRevenue.length - 1].week_start,
      metric: "revenue",
      projected_value: byRevenue[byRevenue.length - 1].projected_revenue,
      narrative: `Week of ${byRevenue[byRevenue.length - 1].week_start} may see the lowest revenue at $${byRevenue[byRevenue.length - 1].projected_revenue.toLocaleString()}.`,
    });
  }

  // Build narrative
  const avgBookings =
    forecast.length > 0
      ? forecast.reduce((s, f) => s + f.projected_bookings, 0) /
        forecast.length
      : 0;
  const avgRevenue =
    forecast.length > 0
      ? forecast.reduce((s, f) => s + f.projected_revenue, 0) /
        forecast.length
      : 0;

  const narrative =
    `Based on ${weekly.length} weeks of historical data, the next 90 days are projected to average ${Math.round(avgBookings)} bookings and $${Math.round(avgRevenue).toLocaleString()} in revenue per week. ` +
    `Year-over-year growth rate is ${yoyGrowthRate >= 0 ? "+" : ""}${yoyGrowthRate.toFixed(1)}%, which has been applied to same-period-last-year baselines. ` +
    `${peaks.length > 0 ? `Peak demand is expected around ${peaks[0].week_start}. ` : ""}` +
    `${troughs.length > 0 ? `Lower activity is anticipated around ${troughs[0].week_start} — consider running promotions during this window. ` : ""}` +
    `Forecast confidence decreases for weeks further out; near-term projections (1-4 weeks) are most reliable.`;

  return {
    forecast,
    peaks,
    troughs,
    confidence_range: {
      low_pct: 15,
      high_pct: 20,
    },
    narrative,
    year_over_year_growth_rate: Math.round(yoyGrowthRate * 100) / 100,
  };
}

function findClosestWeek(
  weekly: WeeklyAggregate[],
  targetWeekStart: string
): WeeklyAggregate | null {
  if (weekly.length === 0) return null;

  const targetDate = new Date(targetWeekStart).getTime();
  let closest: WeeklyAggregate | null = null;
  let closestDiff = Infinity;

  for (const week of weekly) {
    const diff = Math.abs(new Date(week.week_start).getTime() - targetDate);
    if (diff < closestDiff) {
      closestDiff = diff;
      closest = week;
    }
  }

  // Only use if within 2 weeks of target
  if (closestDiff > 14 * 24 * 60 * 60 * 1000) return null;

  return closest;
}

function emptyPrediction(): SeasonalPrediction {
  return {
    forecast: [],
    peaks: [],
    troughs: [],
    confidence_range: { low_pct: 30, high_pct: 30 },
    narrative:
      "Insufficient historical data to generate a seasonal forecast. At least 12 months of daily metrics are needed for reliable predictions.",
    year_over_year_growth_rate: 0,
  };
}
