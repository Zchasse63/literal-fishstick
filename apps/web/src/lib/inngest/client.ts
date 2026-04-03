import { Inngest } from 'inngest';

// ---------------------------------------------------------------------------
// Meridian Event Definitions
// ---------------------------------------------------------------------------
// Every event that can trigger automation flows or background jobs.
// Add new events here as new triggers are introduced.

export type MeridianEvents = {
  // Member lifecycle
  'member/signup': {
    data: { member_id: string; studio_id: string };
  };
  'member/no_show': {
    data: { member_id: string; class_id: string; studio_id: string };
  };
  'member/churn_risk': {
    data: { member_id: string; risk_score: number; studio_id: string };
  };
  'member/credit_expiry': {
    data: { member_id: string; expires_at: string; studio_id: string };
  };
  'member/birthday': {
    data: { member_id: string; studio_id: string };
  };
  'member/milestone': {
    data: {
      member_id: string;
      milestone_type: string;
      count: number;
      studio_id: string;
    };
  };
  'member/membership_change': {
    data: {
      member_id: string;
      from_type: string;
      to_type: string;
      studio_id: string;
    };
  };
  'member/booking_completed': {
    data: { member_id: string; class_id: string; studio_id: string };
  };
  'member/inactive': {
    data: { member_id: string; days_inactive: number; studio_id: string };
  };
  'member/referral': {
    data: {
      referrer_id: string;
      referred_id: string;
      studio_id: string;
    };
  };

  // Payments
  'payment/failed': {
    data: { member_id: string; amount: number; studio_id: string };
  };

  // Automation engine
  'automation/execute_flow': {
    data: {
      enrollment_id: string;
      automation_id: string;
      studio_id: string;
    };
  };

  // Campaign engine
  'campaign/send_scheduled': {
    data: { campaign_id: string; studio_id: string };
  };

  // Analytics & Intelligence cron events (Phase 3)
  'cron/daily-metrics': {
    data: Record<string, never>;
  };
  'cron/cohort-refresh': {
    data: Record<string, never>;
  };
  'cron/trainer-metrics': {
    data: Record<string, never>;
  };
  'cron/ai-insights': {
    data: Record<string, never>;
  };
  'cron/report-scheduler': {
    data: Record<string, never>;
  };
  'cron/export-cleanup': {
    data: Record<string, never>;
  };

  // Analytics async jobs
  'analytics/batch-churn': {
    data: { studio_id: string; member_ids?: string[] };
  };
  'report/generate-async': {
    data: { report_id: string; studio_id: string; requested_by: string };
  };

  // Phase 4: Corporate & Operations cron events
  'cron/payroll-reminder': {
    data: Record<string, never>;
  };
  'cron/invoice-overdue-check': {
    data: Record<string, never>;
  };
  'cron/contract-expiry-check': {
    data: Record<string, never>;
  };
  'cron/corporate-credits-refresh': {
    data: Record<string, never>;
  };

  // Phase 4: Shipping & Invoicing events
  'shipping/label_created': {
    data: { order_id: string; tracking_number: string; studio_id: string };
  };
  'invoice/sent': {
    data: { invoice_id: string; company_id: string; studio_id: string };
  };

  // Glofox data sync
  'glofox/sync-manual': {
    data: { studio_id: string; entity_types?: string[] };
  };
  'glofox/backfill': {
    data: { studio_id: string };
  };

  // Glofox write-back
  'glofox/create-booking': {
    data: {
      /** Meridian bookings.id (UUID) */
      booking_id: string;
      /** Glofox event/class _id */
      glofox_event_id: string;
      /** Glofox user _id of the member */
      glofox_user_id: string;
      /** Meridian studio UUID */
      studio_id: string;
    };
  };
  'glofox/cancel-booking': {
    data: {
      /** Meridian bookings.id (UUID) */
      booking_id: string;
      /** bookings.glofox_id — the Glofox booking _id */
      glofox_booking_id: string;
      /** Meridian studio UUID */
      studio_id: string;
    };
  };
  'glofox/mark-attendance': {
    data: {
      /** Meridian bookings.id (UUID) */
      booking_id: string;
      /** bookings.glofox_id — the 24-char MongoDB ObjectID */
      glofox_booking_id: string;
      /** The Glofox user._id of the member */
      glofox_user_id: string;
      /** Meridian studio UUID */
      studio_id: string;
    };
  };
};

// ---------------------------------------------------------------------------
// Inngest Client
// ---------------------------------------------------------------------------

// Enforce signing key in production to prevent unauthorized function invocation
if (
  process.env.NODE_ENV === 'production' &&
  !process.env.INNGEST_SIGNING_KEY
) {
  console.error(
    '[inngest] INNGEST_SIGNING_KEY is not set in production — Inngest functions will reject unsigned requests',
  );
}

export const inngest = new Inngest({ id: 'meridian' });
