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
import { cronMemberEnrichment } from './cron-member-enrichment';

// Phase 4: Corporate & Operations
import { cronPayrollReminder } from './cron-payroll-reminder';
import { cronInvoiceOverdue } from './cron-invoice-overdue';
import { cronContractExpiry } from './cron-contract-expiry';
import { cronCorporateCredits } from './cron-corporate-credits';

// Glofox Sync Engine
import { glofoxSyncHourly } from './glofox-sync-hourly';
import { glofoxBackfill } from './glofox-backfill';
import { glofoxSyncManual } from './glofox-sync-manual';

// Glofox Write-back
import { glofoxMarkAttendance } from './glofox-mark-attendance';
import { glofoxCreateBooking } from './glofox-create-booking';
import { glofoxCancelBooking } from './glofox-cancel-booking';

export const functions = [
  executeFlow,
  evaluateTriggers,
  cronDailyMetrics,
  cronCohortRefresh,
  cronTrainerMetrics,
  cronAIInsights,
  cronReportScheduler,
  cronExportCleanup,
  cronMemberEnrichment,
  // Phase 4
  cronPayrollReminder,
  cronInvoiceOverdue,
  cronContractExpiry,
  cronCorporateCredits,
  // Glofox Sync
  glofoxSyncHourly,
  glofoxBackfill,
  glofoxSyncManual,
  // Glofox Write-back
  glofoxMarkAttendance,
  glofoxCreateBooking,
  glofoxCancelBooking,
];
