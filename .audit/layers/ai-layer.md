# Layer Report: AI Layer

**Agent:** ai-layer
**Date:** 2026-04-08
**Status:** Complete

---

## Executive Summary

Meridian has an exceptionally well-architected AI layer. The Anthropic Claude SDK is integrated via a singleton client (`lib/ai/client.ts`) with a 30-second timeout, exponential retry on 429/529, and a centralised `AI_MODEL = "claude-sonnet-4-6"` constant. The AI functionality is decomposed into 23 focused modules covering every major business domain: churn prediction, health scoring, campaign copy generation, natural language SQL search, briefing generation, insights generation, revenue anomaly detection, booking pattern analysis, trainer summaries, waitlist messaging, and more. Every AI module implements a rules-based fallback for when the API key is absent or the API is unavailable. Rate limiting is applied to all AI endpoints. The most significant risk is the natural language SQL generation module, which generates and executes arbitrary SQL against the production database using the service-role key.

---

## AI Provider Integration

### SDK: `@anthropic-ai/sdk ^0.80.0`
- **Model:** `claude-sonnet-4-6` (defined in `lib/ai/client.ts`)
- **Timeout:** 30 seconds on all API calls
- **Retry:** 3 attempts, exponential backoff (1s, 2s, 4s), triggers on 429 and 529
- **Client init:** Lazy singleton via `getAnthropicClient()`, returns `null` if `ANTHROPIC_API_KEY` is absent
- **Null-safe:** Every AI module checks `if (!anthropic) { return generateRulesBasedFallback(input) }`

### Barrel Export
`lib/anthropic.ts` is a deprecated barrel re-export with a `@deprecated` JSDoc comment. All production code should import directly from `lib/ai/*` sub-modules. This migration is tracked as `MED-012` in code comments.

---

## AI Modules Inventory (23 modules)

| Module | Function | Input | Output | Fallback |
|--------|----------|-------|--------|---------|
| `briefing.ts` | `generateBriefing` | BriefingContext | string (bullet points) | Rules-based text |
| `churn-prediction.ts` | `predictChurn` | ChurnInput | ChurnPredictionResult | Rules-based scoring |
| `health-score.ts` | `generateHealthScore` | HealthScoreInput | HealthScoreResult | Rules-based score |
| `insights-generator.ts` | `generateInsights` | StudioMetricsContext | AIInsight[] | Empty array |
| `campaign.ts` | `generateCampaignCopy`, `suggestSubjectLines`, `summarizeCampaign` | Campaign context | Copy/subject lines | Template fallback |
| `nl-search.ts` | `translateToSQL` | NLSearchRequest | NLSearchResult (SQL + data) | Error result |
| `recommendations.ts` | `generateRecommendations` | RecommendationContext | Recommendation[] | Rules-based |
| `lead-scoring.ts` | `scoreLead` | LeadScoreInput | LeadScoreResult | Rules-based score |
| `send-time.ts` | `optimizeSendTime` | SendTimeInput | SendTimeResult | Default send time |
| `revenue-anomaly.ts` | `detectRevenueAnomaly` | Revenue metrics | AnomalyResult | Threshold-based |
| `booking-patterns.ts` | `analyzeBookingPatterns` | Booking history | PatternResult | Statistical fallback |
| `trainer-summary.ts` | `generateTrainerSummary` | Trainer metrics | Narrative summary | Template |
| `trainer-comparison.ts` | `compareTrainers` | Multi-trainer metrics | Comparative analysis | N/A |
| `waitlist-messaging.ts` | `generateWaitlistMessage` | Waitlist context | Personalized message | Template |
| `auto-reply.ts` | `generateAutoReply` | Member message context | Reply suggestion | N/A |
| `intake-enrichment.ts` | `enrichMemberIntake` | New member data | Enriched profile fields | N/A |
| `seasonal-predictor.ts` | `predictSeasonalTrend` | Historical data | Seasonal forecast | Statistical |
| `pricing-analyzer.ts` | `analyzePricing` | PricingSimulation | Impact analysis | N/A |
| `report-narrative.ts` | `generateReportNarrative` | Report data | Narrative summary | Template |
| `cross-sell.ts` | `generateCrossSellOpportunities` | Member profile | CrossSell[] | Rules-based |
| `automation-recommendations.ts` | `recommendAutomations` | Studio context | AutomationRecommendation[] | Template recommendations |

---

## Prompt Architecture

### Pattern: System Prompt + User Prompt (Non-Streaming)
All AI modules use the standard non-streaming chat completion pattern:
```typescript
anthropic.messages.create({
  model: AI_MODEL,
  max_tokens: 800,  // varies by module
  system: SYSTEM_PROMPT,  // constant — defines persona + output format
  messages: [{ role: "user", content: dataContext }]
})
```

### System Prompt Design
Every module uses a consistent persona: `"You are Meridian AI, [role description]..."`. System prompts:
- Define output format (JSON schema with exact fields)
- Specify the business domain context (fitness/wellness studio)
- Instruct on fallback behavior
- Return `ONLY the JSON object. No markdown fences, no extra text.`

### Output Parsing
- `parseAIJson<T>(text)` in `lib/ai/client.ts` strips markdown fences then parses JSON
- If parsing fails, the error propagates and the API route catches it with a `console.error` + fallback
- No schema validation (Zod) on the parsed JSON from Claude — type assertion only

### Prompt Hardcoding
All prompts are hardcoded in the source files. There is no database-driven prompt management system. Changes to AI behavior require code deployments. This is appropriate for the current phase but limits non-technical customization.

---

## Natural Language SQL Search — Security Analysis

### Implementation
`nl-search.ts` implements a natural language to SQL translator for the Cmd+K search:
1. User types a natural language query (e.g., "members who haven't visited in 30 days")
2. Claude generates a SQL SELECT statement
3. The generated SQL is executed against the **production database** via a read-only Supabase RPC

### Security Measures in Place
- `SCHEMA_CONTEXT` in the prompt includes explicit schema definition — narrows Claude's knowledge
- System prompt rule: `"Only generate SELECT statements. Never generate INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE, or any mutation."`
- The SQL is executed via a **read-only RPC** (`create-readonly-sql-rpc.sql` in scripts/)

### Residual Risks
1. Claude could generate a valid SELECT that exfiltrates sensitive data from a table not listed in the schema context (the service-role key bypasses RLS)
2. Claude could generate a computationally expensive query (nested loops, CARTESIAN joins) that causes a denial-of-service on the database
3. No server-side SQL parsing/validation — the LLM output is passed directly to execution
4. If Claude returns non-SELECT SQL despite the instruction, there is no programmatic check before execution

---

## AI Error Handling

### Pattern: Try-Catch + Fallback
Every AI function wraps the API call in try-catch:
```typescript
try {
  const message = await withRetry(() => anthropic.messages.create(...))
  return parseAIJson(extractText(message))
} catch (error) {
  console.error("Anthropic API error, falling back to rules-based:", error)
  return generateRulesBasedFallback(input)
}
```

### What's Good
- Rules-based fallbacks ensure the feature never returns an error to users
- `withRetry` handles transient rate limiting (429) and overload (529)
- 30-second timeout prevents hanging requests

### What's Missing
- No error telemetry — `console.error` won't appear in Netlify production logs in a queryable form
- No circuit breaker pattern — if Anthropic is down for an extended period, every AI request still attempts one API call before falling back (adding 30-second latency)
- No AI response validation against Zod schemas — malformed JSON from Claude (which can happen with `max_tokens` truncation) propagates as a parse error rather than using the fallback

---

## AI Hooks (Client-Side)

17 React hooks in `src/hooks/` wrap AI endpoints:
- `use-churn-prediction.ts` — calls `/api/ai/churn-prediction`
- `use-member-health-score.ts` — calls `/api/ai/health-score`
- `use-ai-campaign-copy.ts` — calls `/api/ai/campaign-copy`
- `use-booking-patterns.ts` — calls `/api/ai/booking-patterns`
- `use-revenue-anomaly.ts` — calls `/api/ai/revenue-anomaly`
- `use-trainer-summary.ts` — calls `/api/ai/trainer-summary`
- `use-waitlist-message.ts` — calls `/api/ai/waitlist-message`
- `use-ai-search.ts` — calls `/api/ai/search`
- `use-intake-enrichment.ts` — calls `/api/ai/intake-enrichment`
- `use-command-center-data.ts` — aggregates Command Center metrics

All hooks follow a consistent `{ data, loading, error }` pattern.

---

## RAG Pipeline

No RAG (Retrieval-Augmented Generation) pipeline was detected. `pgvector` is mentioned in the project documentation as a planned addition for AI-powered search and retrieval, but there are no vector embedding generation calls or similarity search implementations in the current codebase. The NL search feature uses schema context injected into prompts rather than vector similarity.

---

## Inngest AI Background Jobs

4 Inngest cron functions involve AI:
1. `cron-ai-insights.ts` — runs on schedule, calls `generateInsights()`, stores to `ai_insights` table with fingerprint dedup
2. `cron-member-enrichment.ts` — enriches new member profiles via `enrichMemberIntake()` (AI + rules)
3. `glofox-sync-enrichment.ts` — enriches data during Glofox sync
4. Various AI API calls are also triggered on-demand through API routes

---

## Findings

### CRITICAL
- **CRIT-AI-001:** The NL Search (`/api/ai/search`) feature generates and executes LLM-produced SQL against the production database via a read-only RPC. While the prompt instructs Claude to generate only SELECT statements, there is no server-side SQL syntax validation before execution. A prompt injection via user input (e.g., "show me members; DROP TABLE members;--") could potentially bypass the instruction. The read-only RPC mitigates write risk, but a malicious or malformed query could still cause significant read-load or data exfiltration. Recommend: server-side SQL parsing to validate the query is a single SELECT before execution.

### HIGH
- **HIGH-AI-001:** AI responses from Claude are parsed as JSON with `parseAIJson<T>()` but are not validated against Zod schemas before use. When Claude returns malformed JSON or a response that doesn't match the expected schema (which can happen due to `max_tokens` truncation or model behavior changes), the parse error causes the API request to fail rather than triggering the rules-based fallback. The fallback is only in the outer try-catch in the module, but if `parseAIJson` throws, the fallback should still trigger.
- **HIGH-AI-002:** No observability for AI failures in production. `console.error` logs won't surface in Netlify's structured logs in an actionable way. If AI features are silently failing (always returning fallback responses), administrators have no visibility. Recommend: add error tracking (Sentry or similar) or structured logging to a database table.

### MEDIUM
- **MED-AI-001:** The `lib/anthropic.ts` barrel file has a `@deprecated` JSDoc comment but is still imported in test files and possibly in some production paths. The migration to direct sub-module imports (tracked as MED-012) should be completed to avoid confusion and ensure bundle optimization.
- **MED-AI-002:** No Zod validation on Claude JSON responses. A changed schema from Claude (column rename, missing field) would only surface as a runtime error after deployment. Validate each module's expected output shape with Zod.
- **MED-AI-003:** The `insights-generator.ts` generates insights and writes them to the database via the Inngest cron. There is no maximum insights count per studio per day, so if the cron runs frequently or is triggered multiple times, the `ai_insights` table could grow unboundedly. The 7-day fingerprint dedup helps but doesn't cap total insight count.

### LOW
- **LOW-AI-001:** pgvector for semantic search is documented as planned but not implemented. The NL Search currently uses prompt-based SQL generation rather than vector similarity — this is less semantically powerful than a vector search approach.
- **LOW-AI-002:** AI model is hardcoded as `claude-sonnet-4-6` with no way to configure per-environment (e.g., use a cheaper model in development). This means dev/test runs incur production model costs.
- **LOW-AI-003:** `max_tokens` values vary by module (500 for briefing, 800 for churn, 1500+ for insights) with no documentation of why specific values were chosen. If a module's output truncates at the token limit, `parseAIJson` will fail.

### INFO
- **INFO-AI-001:** 23 AI modules with rules-based fallbacks is an exemplary pattern for production AI integration. The codebase is prepared for Anthropic API outages without service degradation.
- **INFO-AI-002:** Model version is centralised in a single constant — a model upgrade only requires one line change. Good practice.
- **INFO-AI-003:** The AI features cover the full business lifecycle: new member intake enrichment → daily briefing → churn prediction → re-engagement campaign copy → automated flow execution. This is coherent, domain-appropriate AI integration rather than bolt-on features.
