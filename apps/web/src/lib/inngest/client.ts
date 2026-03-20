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
};

// ---------------------------------------------------------------------------
// Inngest Client
// ---------------------------------------------------------------------------

export const inngest = new Inngest({ id: 'meridian' });
