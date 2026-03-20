/**
 * Inngest Function: Execute Automation Flow
 *
 * The core automation engine. Processes an enrolled member through a
 * multi-step flow — sending emails, waiting, branching on conditions,
 * tagging members, and updating fields.
 *
 * Triggered by: 'automation/execute_flow' event
 */
import { inngest } from '@/lib/inngest/client';
import { sendCampaignEmail } from '@/lib/resend';
import { resolveTemplate, textToHtml, wrapEmailLayout } from '@/lib/email-templates';
import { createSMSProvider } from '@/lib/sms';
import {
  getAdminClient,
  checkExitConditions,
  checkAutomationCooldown,
  updateCooldown,
  recordStepExecution,
  completeEnrollment,
  exitEnrollment,
  failEnrollment,
} from '@/lib/inngest/helpers';

// ---------------------------------------------------------------------------
// Types for flow steps (stored as JSONB in flow_snapshot)
// ---------------------------------------------------------------------------

interface EmailStep {
  type: 'email';
  subject: string;
  body: string; // Handlebars template with merge tags
  preheader?: string;
}

interface WaitStep {
  type: 'wait';
  delay_minutes: number;
}

interface ConditionStep {
  type: 'condition';
  condition_type: 'email_opened' | 'link_clicked' | 'days_since_last_visit' | 'membership_type';
  config?: Record<string, unknown>;
  true_branch: number; // step index to jump to
  false_branch: number; // step index to jump to
}

interface SMSStep {
  type: 'sms';
  body: string; // Handlebars template
}

interface TagStep {
  type: 'tag';
  tag_name: string;
  action: 'add' | 'remove';
}

interface UpdateFieldStep {
  type: 'update_field';
  field: string;
  value: string | number | boolean;
}

type FlowStep = EmailStep | WaitStep | ConditionStep | SMSStep | TagStep | UpdateFieldStep;

// ---------------------------------------------------------------------------
// Function definition
// ---------------------------------------------------------------------------

export const executeFlow = inngest.createFunction(
  {
    id: 'automation-execute-flow',
    name: 'Execute Automation Flow',
    retries: 3,
    concurrency: [{ limit: 10 }],
    triggers: [{ event: 'automation/execute_flow' }],
  },
  async ({ event, step }) => {
    const { enrollment_id, studio_id } = event.data;
    const db = getAdminClient();

    // ── Load enrollment ────────────────────────────────────────
    const enrollment = await step.run('load-enrollment', async () => {
      const { data, error } = await db
        .from('automation_enrollments')
        .select('*')
        .eq('id', enrollment_id)
        .eq('studio_id', studio_id)
        .single();

      if (error || !data) {
        throw new Error(`Enrollment ${enrollment_id} not found: ${error?.message}`);
      }

      return data;
    });

    if (enrollment.status !== 'active') {
      return { status: 'skipped', reason: `Enrollment status is ${enrollment.status}` };
    }

    const steps: FlowStep[] = (enrollment.flow_snapshot as { steps: FlowStep[] })?.steps ?? [];
    if (steps.length === 0) {
      await step.run('complete-empty-flow', () => completeEnrollment(enrollment_id));
      return { status: 'completed', reason: 'No steps in flow' };
    }

    // ── Load member profile ──────────────────────────────────
    const member = await step.run('load-member', async () => {
      const { data, error } = await db
        .from('profiles')
        .select('id, email, first_name, last_name, phone, timezone')
        .eq('id', enrollment.member_id)
        .single();

      if (error || !data) {
        throw new Error(`Member ${enrollment.member_id} not found: ${error?.message}`);
      }
      return data;
    });

    // Load member details for merge tags
    const memberDetails = await step.run('load-member-details', async () => {
      const { data: memberRow } = await db
        .from('members')
        .select('membership_type, membership_status, credits_remaining, total_visits')
        .eq('id', enrollment.member_id)
        .eq('studio_id', studio_id)
        .single();

      return memberRow ?? {};
    });

    // Merge tag data
    const mergeData: Record<string, string | number | undefined> = {
      first_name: member.first_name,
      last_name: member.last_name,
      membership_name: (memberDetails as Record<string, unknown>)?.membership_type as string | undefined,
      credits_remaining: (memberDetails as Record<string, unknown>)?.credits_remaining as number | undefined,
      total_visits: (memberDetails as Record<string, unknown>)?.total_visits as number | undefined,
    };

    // ── Step execution loop ──────────────────────────────────
    let currentStep = enrollment.current_step ?? 0;

    while (currentStep < steps.length) {
      const flowStep = steps[currentStep];
      const stepKey = `step-${currentStep}-${flowStep.type}`;

      // Check exit conditions before each step
      const exitCondition = await step.run(`check-exit-${currentStep}`, async () => {
        const exitConditions = (enrollment.flow_snapshot as { exit_conditions?: Array<{ type: string; config?: Record<string, unknown> }> })?.exit_conditions ?? [];
        return checkExitConditions(
          {
            id: enrollment.id,
            member_id: enrollment.member_id,
            automation_id: enrollment.automation_id,
            studio_id: enrollment.studio_id,
            enrolled_at: enrollment.enrolled_at,
          },
          exitConditions,
        );
      });

      if (exitCondition) {
        await step.run('exit-enrollment', async () => {
          await recordStepExecution(enrollment_id, currentStep, flowStep.type, 'skipped', {
            reason: `Exit condition resolved: ${exitCondition}`,
          });
          await exitEnrollment(enrollment_id, `condition_resolved:${exitCondition}`);
        });
        return { status: 'exited', reason: exitCondition, step: currentStep };
      }

      // Execute step based on type
      switch (flowStep.type) {
        // ── EMAIL ──────────────────────────────────────────────
        case 'email': {
          await step.run(stepKey, async () => {
            // Check cooldown
            const cooledDown = await checkAutomationCooldown(
              enrollment.member_id,
              studio_id,
              'email',
            );
            if (cooledDown) {
              await recordStepExecution(enrollment_id, currentStep, 'email', 'cooldown_blocked');
              return { sent: false, reason: 'cooldown' };
            }

            if (!member.email) {
              await recordStepExecution(enrollment_id, currentStep, 'email', 'skipped', {
                reason: 'no_email_address',
              });
              return { sent: false, reason: 'no_email' };
            }

            // Resolve merge tags
            const subject = resolveTemplate(flowStep.subject, mergeData);
            const bodyHtml = wrapEmailLayout(
              textToHtml(resolveTemplate(flowStep.body, mergeData)),
              flowStep.preheader ? resolveTemplate(flowStep.preheader, mergeData) : undefined,
            );

            // Send via Resend
            const result = await sendCampaignEmail(
              member.email,
              subject,
              bodyHtml,
              enrollment.automation_id, // use automation ID as campaign ID for tracking
              enrollment.member_id,
            );

            // Record in campaign_recipients for open/click tracking
            if (result.id) {
              await db.from('campaign_recipients').insert({
                campaign_id: enrollment.automation_id,
                member_id: enrollment.member_id,
                studio_id,
                email: member.email,
                resend_id: result.id,
                message_id: result.messageId,
                status: 'sent',
                sent_at: new Date().toISOString(),
                metadata: {
                  source: 'automation',
                  enrollment_id,
                  step_index: currentStep,
                },
              });
            }

            await updateCooldown(enrollment.member_id, studio_id, 'email');
            await recordStepExecution(enrollment_id, currentStep, 'email', 'completed', {
              resend_id: result.id,
              subject,
            });

            return { sent: true, resend_id: result.id };
          });

          currentStep++;
          break;
        }

        // ── WAIT ───────────────────────────────────────────────
        case 'wait': {
          const delayMs = flowStep.delay_minutes * 60 * 1000;
          const delayLabel =
            flowStep.delay_minutes >= 1440
              ? `${Math.round(flowStep.delay_minutes / 1440)}d`
              : flowStep.delay_minutes >= 60
                ? `${Math.round(flowStep.delay_minutes / 60)}h`
                : `${flowStep.delay_minutes}m`;

          await step.sleep(`wait-${currentStep}-${delayLabel}`, delayMs);

          await step.run(`record-wait-${currentStep}`, async () => {
            await recordStepExecution(enrollment_id, currentStep, 'wait', 'completed', {
              delay_minutes: flowStep.delay_minutes,
            });
          });

          currentStep++;
          break;
        }

        // ── CONDITION ──────────────────────────────────────────
        case 'condition': {
          const branchResult = await step.run(stepKey, async () => {
            let conditionMet = false;

            switch (flowStep.condition_type) {
              case 'email_opened': {
                // Check if the email from a referenced step was opened
                const refStepIndex = (flowStep.config?.reference_step as number) ?? currentStep - 1;
                const { data: recipient } = await db
                  .from('campaign_recipients')
                  .select('opened_at')
                  .eq('campaign_id', enrollment.automation_id)
                  .eq('member_id', enrollment.member_id)
                  .eq('studio_id', studio_id)
                  .not('opened_at', 'is', null)
                  .limit(1)
                  .single();

                conditionMet = !!recipient?.opened_at;
                break;
              }
              case 'link_clicked': {
                const { data: recipient } = await db
                  .from('campaign_recipients')
                  .select('clicked_at')
                  .eq('campaign_id', enrollment.automation_id)
                  .eq('member_id', enrollment.member_id)
                  .eq('studio_id', studio_id)
                  .not('clicked_at', 'is', null)
                  .limit(1)
                  .single();

                conditionMet = !!recipient?.clicked_at;
                break;
              }
              case 'days_since_last_visit': {
                const thresholdDays = (flowStep.config?.days as number) ?? 14;
                const cutoff = new Date(
                  Date.now() - thresholdDays * 24 * 60 * 60 * 1000,
                ).toISOString();

                const { data: recentBooking } = await db
                  .from('bookings')
                  .select('id')
                  .eq('member_id', enrollment.member_id)
                  .eq('studio_id', studio_id)
                  .not('checked_in_at', 'is', null)
                  .gte('checked_in_at', cutoff)
                  .limit(1)
                  .single();

                // Condition met = they HAVE NOT visited recently (inactive)
                conditionMet = !recentBooking;
                break;
              }
              case 'membership_type': {
                const targetType = flowStep.config?.membership_type as string;
                const { data: memberRow } = await db
                  .from('members')
                  .select('membership_type')
                  .eq('id', enrollment.member_id)
                  .eq('studio_id', studio_id)
                  .single();

                conditionMet = memberRow?.membership_type === targetType;
                break;
              }
              default:
                console.warn(`[automation] Unknown condition type: ${flowStep.condition_type}`);
            }

            const nextStep = conditionMet ? flowStep.true_branch : flowStep.false_branch;

            await recordStepExecution(enrollment_id, currentStep, 'condition', 'completed', {
              condition_type: flowStep.condition_type,
              result: conditionMet,
              next_step: nextStep,
            });

            return nextStep;
          });

          currentStep = branchResult;
          break;
        }

        // ── SMS ────────────────────────────────────────────────
        case 'sms': {
          await step.run(stepKey, async () => {
            const cooledDown = await checkAutomationCooldown(
              enrollment.member_id,
              studio_id,
              'sms',
            );
            if (cooledDown) {
              await recordStepExecution(enrollment_id, currentStep, 'sms', 'cooldown_blocked');
              return { sent: false, reason: 'cooldown' };
            }

            if (!member.phone) {
              await recordStepExecution(enrollment_id, currentStep, 'sms', 'skipped', {
                reason: 'no_phone_number',
              });
              return { sent: false, reason: 'no_phone' };
            }

            const body = resolveTemplate(flowStep.body, mergeData);
            const smsProvider = createSMSProvider();
            const result = await smsProvider.sendSMS({
              to: member.phone,
              body,
              studio_id,
              metadata: {
                source: 'automation',
                enrollment_id,
                step_index: String(currentStep),
              },
            });

            await updateCooldown(enrollment.member_id, studio_id, 'sms');
            await recordStepExecution(enrollment_id, currentStep, 'sms', 'completed', {
              provider_message_id: result.provider_message_id,
              segments: result.segments,
            });

            return { sent: true, provider_message_id: result.provider_message_id };
          });

          currentStep++;
          break;
        }

        // ── TAG ────────────────────────────────────────────────
        case 'tag': {
          await step.run(stepKey, async () => {
            if (flowStep.action === 'add') {
              await db.from('member_tags').upsert(
                {
                  member_id: enrollment.member_id,
                  studio_id,
                  tag: flowStep.tag_name,
                  source: 'automation',
                  created_at: new Date().toISOString(),
                },
                { onConflict: 'member_id,studio_id,tag' },
              );
            } else {
              await db
                .from('member_tags')
                .delete()
                .eq('member_id', enrollment.member_id)
                .eq('studio_id', studio_id)
                .eq('tag', flowStep.tag_name);
            }

            await recordStepExecution(enrollment_id, currentStep, 'tag', 'completed', {
              tag: flowStep.tag_name,
              action: flowStep.action,
            });
          });

          currentStep++;
          break;
        }

        // ── UPDATE FIELD ───────────────────────────────────────
        case 'update_field': {
          await step.run(stepKey, async () => {
            await db
              .from('profiles')
              .update({ [flowStep.field]: flowStep.value })
              .eq('id', enrollment.member_id);

            await recordStepExecution(enrollment_id, currentStep, 'update_field', 'completed', {
              field: flowStep.field,
              value: flowStep.value,
            });
          });

          currentStep++;
          break;
        }

        default: {
          // Unknown step type — skip and continue
          await step.run(`skip-unknown-${currentStep}`, async () => {
            await recordStepExecution(
              enrollment_id,
              currentStep,
              (flowStep as { type: string }).type,
              'skipped',
              { reason: 'unknown_step_type' },
            );
          });
          currentStep++;
        }
      }
    }

    // ── Flow complete ────────────────────────────────────────
    await step.run('complete-enrollment', () => completeEnrollment(enrollment_id));

    return { status: 'completed', steps_executed: currentStep };
  },
);
