/**
 * Inngest Functions Registry
 *
 * All Inngest functions exported as a flat array for the serve endpoint.
 * Import this in the API route handler.
 */
import { executeFlow } from './execute-flow';
import { evaluateTriggers } from './evaluate-triggers';
import { cronDailyMetrics } from './cron-daily-metrics';
import { cronCohortRefresh } from './cron-cohort-refresh';
import { cronTrainerMetrics } from './cron-trainer-metrics';
import { cronAIInsights } from './cron-ai-insights';
import { cronReportScheduler } from './cron-report-scheduler';
import { cronExportCleanup } from './cron-export-cleanup';

export const functions = [
  executeFlow,
  evaluateTriggers,
  cronDailyMetrics,
  cronCohortRefresh,
  cronTrainerMetrics,
  cronAIInsights,
  cronReportScheduler,
  cronExportCleanup,
];
