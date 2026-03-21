/**
 * Inngest Cron Function: Corporate Credits Refresh
 *
 * Runs on the 1st of every month at 2 AM ET (7:00 UTC).
 * For each active company account:
 * 1. Calculate rollover credits (min of remaining, rollover cap if set)
 * 2. Set credits_remaining = rollover + monthly_credit_allocation
 * 3. Log the refresh to activity_log
 */
import { inngest } from '@/lib/inngest/client';
import { getAdminClient } from '@/lib/inngest/helpers';

// TODO: Multi-tenancy — query `studios` table and iterate all active studios
// instead of hardcoding a single studio ID. See MED-001.
const STUDIO_ID = process.env.DEFAULT_STUDIO_ID || '11111111-1111-1111-1111-111111111111';

export const cronCorporateCredits = inngest.createFunction(
  {
    id: 'cron-corporate-credits',
    name: 'Monthly Corporate Credits Refresh',
    retries: 2,
    concurrency: [{ limit: 1 }],
    triggers: [{ cron: '0 7 1 * *' }], // 1st of month, 2 AM ET = 7:00 UTC
  },
  async ({ step }) => {
    const db = getAdminClient();

    // ── Fetch active companies ───────────────────────────────
    const companies = await step.run('fetch-active-companies', async () => {
      const { data, error } = await db
        .from('company_accounts')
        .select(
          'id, company_name, credits_remaining, monthly_credit_allocation, credit_rollover_cap, status',
        )
        .eq('studio_id', STUDIO_ID)
        .eq('status', 'active');

      if (error) {
        console.error('[corporate-credits] Failed to query companies:', error);
        return [];
      }

      return data ?? [];
    });

    if (companies.length === 0) {
      return { status: 'no_active_companies', refreshed: 0 };
    }

    // ── Refresh credits for each company ─────────────────────
    const result = await step.run('refresh-credits', async () => {
      const now = new Date().toISOString();
      let refreshed = 0;
      let errors = 0;

      for (const company of companies) {
        try {
          const currentCredits = company.credits_remaining ?? 0;
          const allocation = company.monthly_credit_allocation ?? 0;
          const rolloverCap = company.credit_rollover_cap;

          // Calculate rollover: if cap is set, min of remaining and cap; else 0
          let rollover = 0;
          if (rolloverCap !== null && rolloverCap !== undefined && rolloverCap > 0) {
            rollover = Math.min(currentCredits, rolloverCap);
          }

          const newBalance = rollover + allocation;

          // Update company credits
          const { error: updateError } = await db
            .from('company_accounts')
            .update({
              credits_remaining: newBalance,
              updated_at: now,
            })
            .eq('id', company.id);

          if (updateError) {
            console.error(
              `[corporate-credits] Failed to update ${company.company_name}:`,
              updateError,
            );
            errors++;
            continue;
          }

          // Log to activity_log
          await db.from('activity_log').insert({
            studio_id: STUDIO_ID,
            actor_id: null, // system action
            action: 'corporate_credits_refreshed',
            entity_type: 'company_account',
            entity_id: company.id,
            metadata: {
              company_name: company.company_name,
              previous_balance: currentCredits,
              rollover,
              rollover_cap: rolloverCap,
              allocation,
              new_balance: newBalance,
            },
          });

          refreshed++;
        } catch (err) {
          console.error(
            `[corporate-credits] Error processing ${company.company_name}:`,
            err,
          );
          errors++;
        }
      }

      return { refreshed, errors };
    });

    return {
      status: 'completed',
      companies_found: companies.length,
      credits_refreshed: result.refreshed,
      errors: result.errors,
    };
  },
);
