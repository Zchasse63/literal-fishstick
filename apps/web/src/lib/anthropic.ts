/**
 * @deprecated Import directly from `@/lib/ai/*` sub-modules instead.
 *
 * This barrel re-export file exists only for backward compatibility with
 * test files. All production code has been migrated to direct sub-module
 * imports (MED-012). New code should NEVER import from `@/lib/anthropic`.
 *
 * The AI functions that previously lived in this 1,700-line file have been
 * decomposed into focused sub-modules under `lib/ai/` (MED-09).
 *
 * Consumers can continue importing from `@/lib/anthropic` with no changes,
 * or import directly from the sub-module for smaller bundles.
 *
 * Sub-modules:
 *   @/lib/ai/client               — Anthropic client singleton, AI_MODEL, helpers
 *   @/lib/ai/briefing              — generateBriefing
 *   @/lib/ai/recommendations       — generateRecommendations
 *   @/lib/ai/campaign              — generateCampaignCopy, suggestSubjectLines, summarizeCampaign
 *   @/lib/ai/health-score          — generateHealthScore
 *   @/lib/ai/nl-search             — translateToSQL, SCHEMA_CONTEXT
 *   @/lib/ai/lead-scoring          — scoreLead
 *   @/lib/ai/send-time             — optimizeSendTime
 *   @/lib/ai/automation-recommendations — recommendAutomations
 */

// ─── Client ────────────────────────────────────────────────
export { getAnthropicClient, AI_MODEL, extractText, parseAIJson, withRetry } from "@/lib/ai/client";

// ─── Briefing ──────────────────────────────────────────────
export { generateBriefing } from "@/lib/ai/briefing";
export type { BriefingContext } from "@/lib/ai/briefing";

// ─── Recommendations ──────────────────────────────────────
export { generateRecommendations } from "@/lib/ai/recommendations";
export type { RecommendationContext } from "@/lib/ai/recommendations";

// ─── Campaign (copy, subject lines, summaries) ────────────
export { generateCampaignCopy, suggestSubjectLines, summarizeCampaign } from "@/lib/ai/campaign";
export type {
  CampaignCopyRequest,
  CampaignCopyResult,
  SubjectLineContext,
  SubjectLineSuggestion,
  CampaignSummaryInput,
  CampaignSummaryResult,
} from "@/lib/ai/campaign";

// ─── Health Score ─────────────────────────────────────────
export { generateHealthScore } from "@/lib/ai/health-score";
export type { HealthScoreInput, HealthScoreResult } from "@/lib/ai/health-score";

// ─── Natural Language Search ──────────────────────────────
export { translateToSQL, SCHEMA_CONTEXT } from "@/lib/ai/nl-search";
export type { NLSearchRequest, NLSearchResult } from "@/lib/ai/nl-search";

// ─── Lead Scoring ─────────────────────────────────────────
export { scoreLead } from "@/lib/ai/lead-scoring";
export type { LeadScoreInput, LeadScoreResult } from "@/lib/ai/lead-scoring";

// ─── Send Time Optimization ──────────────────────────────
export { optimizeSendTime } from "@/lib/ai/send-time";
export type { SendTimeInput, SendTimeResult } from "@/lib/ai/send-time";

// ─── Automation Recommendations ──────────────────────────
export { recommendAutomations } from "@/lib/ai/automation-recommendations";
export type {
  AutomationRecommendationInput,
  AutomationRecommendation,
} from "@/lib/ai/automation-recommendations";
