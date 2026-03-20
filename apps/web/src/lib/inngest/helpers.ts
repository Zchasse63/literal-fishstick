/**
 * Inngest Automation Helpers
 *
 * Shared database utilities for the automation engine.
 * All functions use a service-role Supabase client (no cookie context)
 * because Inngest functions run outside the HTTP request lifecycle.
 */
import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Service-role Supabase client for background jobs
// ---------------------------------------------------------------------------
// Inngest functions do NOT run inside a Next.js request, so they cannot use
// the cookie-based `createServerClient`. We create a service-role client
// that bypasses RLS — every query MUST filter by studio_id explicitly.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _admin: ReturnType<typeof createClient<any>> | null = null;

export function getAdminClient() {
  if (!_admin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for Inngest admin client',
      );
    }
    _admin = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return _admin;
}

// ---------------------------------------------------------------------------
// Exit condition checker
// ---------------------------------------------------------------------------

export interface ExitCondition {
  type: string; // e.g. 'booking_made', 'membership_active', 'email_opened', 'manual'
  config?: Record<string, unknown>;
}

/**
 * Check whether any exit condition has been satisfied for an enrollment.
 * Returns the name of the first resolved condition, or null if none resolved.
 */
export async function checkExitConditions(
  enrollment: {
    id: string;
    member_id: string;
    automation_id: string;
    studio_id: string;
    enrolled_at: string;
  },
  exitConditions: ExitCondition[],
): Promise<string | null> {
  if (!exitConditions || exitConditions.length === 0) return null;

  const db = getAdminClient();

  for (const cond of exitConditions) {
    try {
      switch (cond.type) {
        case 'booking_made': {
          // Member has made a booking since enrollment
          const { count } = await db
            .from('bookings')
            .select('*', { count: 'exact', head: true })
            .eq('member_id', enrollment.member_id)
            .eq('studio_id', enrollment.studio_id)
            .gte('created_at', enrollment.enrolled_at);
          if (count && count > 0) return 'booking_made';
          break;
        }
        case 'membership_active': {
          // Member has an active membership
          const { data } = await db
            .from('members')
            .select('membership_status')
            .eq('id', enrollment.member_id)
            .eq('studio_id', enrollment.studio_id)
            .single();
          if (data?.membership_status === 'active') return 'membership_active';
          break;
        }
        case 'checked_in': {
          // Member has checked in since enrollment
          const { count } = await db
            .from('bookings')
            .select('*', { count: 'exact', head: true })
            .eq('member_id', enrollment.member_id)
            .eq('studio_id', enrollment.studio_id)
            .not('checked_in_at', 'is', null)
            .gte('checked_in_at', enrollment.enrolled_at);
          if (count && count > 0) return 'checked_in';
          break;
        }
        case 'payment_succeeded': {
          // Successful payment since enrollment
          const { count } = await db
            .from('transactions')
            .select('*', { count: 'exact', head: true })
            .eq('member_id', enrollment.member_id)
            .eq('studio_id', enrollment.studio_id)
            .eq('status', 'completed')
            .gte('created_at', enrollment.enrolled_at);
          if (count && count > 0) return 'payment_succeeded';
          break;
        }
        case 'manual':
          // Manual exit — never auto-resolves
          break;
        default:
          console.warn(`[automation] Unknown exit condition type: ${cond.type}`);
      }
    } catch (err) {
      console.error(`[automation] Error checking exit condition ${cond.type}:`, err);
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Cooldown management (24-hour global cooldown per channel)
// ---------------------------------------------------------------------------

/**
 * Check if a member is within the 24-hour cooldown window for a channel.
 * Returns true if the member should be blocked (still cooling down).
 */
export async function checkAutomationCooldown(
  memberId: string,
  studioId: string,
  channel: 'email' | 'sms',
): Promise<boolean> {
  const db = getAdminClient();
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data } = await db
    .from('automation_cooldowns')
    .select('last_sent_at')
    .eq('member_id', memberId)
    .eq('studio_id', studioId)
    .eq('channel', channel)
    .single();

  if (!data) return false;
  return data.last_sent_at > twentyFourHoursAgo;
}

/**
 * Upsert the cooldown timestamp after sending a message.
 */
export async function updateCooldown(
  memberId: string,
  studioId: string,
  channel: 'email' | 'sms',
): Promise<void> {
  const db = getAdminClient();
  const now = new Date().toISOString();

  await db
    .from('automation_cooldowns')
    .upsert(
      {
        member_id: memberId,
        studio_id: studioId,
        channel,
        last_sent_at: now,
      },
      { onConflict: 'member_id,studio_id,channel' },
    );
}

// ---------------------------------------------------------------------------
// Step history recording
// ---------------------------------------------------------------------------

export interface StepExecutionRecord {
  step_index: number;
  step_type: string;
  status: 'completed' | 'skipped' | 'failed' | 'cooldown_blocked';
  executed_at: string;
  metadata?: Record<string, unknown>;
  error?: string;
}

/**
 * Append a step execution record to the enrollment's step_history JSONB array.
 */
export async function recordStepExecution(
  enrollmentId: string,
  stepIndex: number,
  stepType: string,
  status: StepExecutionRecord['status'],
  metadata?: Record<string, unknown>,
  error?: string,
): Promise<void> {
  const db = getAdminClient();

  const record: StepExecutionRecord = {
    step_index: stepIndex,
    step_type: stepType,
    status,
    executed_at: new Date().toISOString(),
    ...(metadata && { metadata }),
    ...(error && { error }),
  };

  // Fetch current history, append, and update
  const { data: enrollment } = await db
    .from('automation_enrollments')
    .select('step_history')
    .eq('id', enrollmentId)
    .single();

  const history: StepExecutionRecord[] = (enrollment?.step_history as StepExecutionRecord[]) ?? [];
  history.push(record);

  await db
    .from('automation_enrollments')
    .update({
      step_history: history,
      current_step: stepIndex,
      last_processed_at: new Date().toISOString(),
    })
    .eq('id', enrollmentId);
}

// ---------------------------------------------------------------------------
// Enrollment lifecycle
// ---------------------------------------------------------------------------

/**
 * Mark enrollment as completed.
 */
export async function completeEnrollment(enrollmentId: string): Promise<void> {
  const db = getAdminClient();
  await db
    .from('automation_enrollments')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      last_processed_at: new Date().toISOString(),
    })
    .eq('id', enrollmentId);
}

/**
 * Mark enrollment as exited with a reason.
 */
export async function exitEnrollment(
  enrollmentId: string,
  reason: string,
): Promise<void> {
  const db = getAdminClient();
  await db
    .from('automation_enrollments')
    .update({
      status: 'exited',
      exit_reason: reason,
      exited_at: new Date().toISOString(),
      last_processed_at: new Date().toISOString(),
    })
    .eq('id', enrollmentId);
}

/**
 * Mark enrollment as failed.
 */
export async function failEnrollment(
  enrollmentId: string,
  reason: string,
): Promise<void> {
  const db = getAdminClient();
  await db
    .from('automation_enrollments')
    .update({
      status: 'failed',
      exit_reason: reason,
      last_processed_at: new Date().toISOString(),
    })
    .eq('id', enrollmentId);
}

// ---------------------------------------------------------------------------
// Enrollment eligibility
// ---------------------------------------------------------------------------

/**
 * Check whether a member can be enrolled in a flow.
 * Enforces UNIQUE enrollment constraint and reenrollment cooldown.
 */
export async function canEnrollMember(
  flow: {
    id: string;
    studio_id: string;
    allow_reenrollment?: boolean;
    cooldown_days?: number;
  },
  memberId: string,
): Promise<boolean> {
  const db = getAdminClient();

  // Check for any existing active enrollment
  const { data: active } = await db
    .from('automation_enrollments')
    .select('id')
    .eq('automation_id', flow.id)
    .eq('member_id', memberId)
    .eq('studio_id', flow.studio_id)
    .in('status', ['active', 'paused'])
    .limit(1)
    .single();

  if (active) return false; // already enrolled

  // If reenrollment is not allowed, check for any past enrollment
  if (!flow.allow_reenrollment) {
    const { data: past } = await db
      .from('automation_enrollments')
      .select('id')
      .eq('automation_id', flow.id)
      .eq('member_id', memberId)
      .eq('studio_id', flow.studio_id)
      .limit(1)
      .single();

    if (past) return false;
  }

  // If reenrollment is allowed but has a cooldown, check timing
  if (flow.allow_reenrollment && flow.cooldown_days && flow.cooldown_days > 0) {
    const cooldownCutoff = new Date(
      Date.now() - flow.cooldown_days * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data: recent } = await db
      .from('automation_enrollments')
      .select('id')
      .eq('automation_id', flow.id)
      .eq('member_id', memberId)
      .eq('studio_id', flow.studio_id)
      .gte('completed_at', cooldownCutoff)
      .limit(1)
      .single();

    if (recent) return false;
  }

  return true;
}
