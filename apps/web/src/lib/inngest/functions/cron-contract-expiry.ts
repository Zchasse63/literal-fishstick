/**
 * Inngest Cron Function: Contract Expiry Check
 *
 * Runs daily at 8 AM ET (13:00 UTC) to find active company accounts
 * whose contract ends within 30 days. Sends an alert email to the
 * studio owner so they can initiate renewal conversations.
 */
import { inngest } from '@/lib/inngest/client';
import { getAdminClient } from '@/lib/inngest/helpers';
import { Resend } from 'resend';

const STUDIO_ID = '11111111-1111-1111-1111-111111111111';

export const cronContractExpiry = inngest.createFunction(
  {
    id: 'cron-contract-expiry',
    name: 'Daily Contract Expiry Check',
    retries: 2,
    concurrency: [{ limit: 1 }],
    triggers: [{ cron: '0 13 * * *' }], // Daily 8 AM ET = 13:00 UTC
  },
  async ({ step }) => {
    const db = getAdminClient();

    const today = new Date();
    const thirtyDaysOut = new Date(today);
    thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);

    const todayStr = today.toISOString().split('T')[0];
    const thirtyDaysStr = thirtyDaysOut.toISOString().split('T')[0];

    // ── Find expiring contracts ──────────────────────────────
    const expiringCompanies = await step.run('find-expiring-contracts', async () => {
      const { data, error } = await db
        .from('company_accounts')
        .select('id, company_name, billing_email, contract_end, status')
        .eq('studio_id', STUDIO_ID)
        .eq('status', 'active')
        .gte('contract_end', todayStr)
        .lte('contract_end', thirtyDaysStr);

      if (error) {
        console.error('[contract-expiry] Failed to query companies:', error);
        return [];
      }

      return data ?? [];
    });

    if (expiringCompanies.length === 0) {
      return { status: 'no_expiring_contracts', alerts_sent: 0 };
    }

    // ── Find studio owner to notify ──────────────────────────
    const ownerEmail = await step.run('find-owner', async () => {
      const { data, error } = await db
        .from('profiles')
        .select('email, full_name, roles')
        .eq('studio_id', STUDIO_ID)
        .or('roles.cs.{admin}');

      if (error) {
        console.error('[contract-expiry] Failed to query owner:', error);
        return null;
      }

      // Pick the first admin
      const admin = (data ?? []).find(
        (p: { roles: string[] }) => p.roles?.includes('admin'),
      );
      return admin ?? null;
    });

    if (!ownerEmail) {
      return { status: 'no_owner_found', expiring: expiringCompanies.length };
    }

    // ── Send alert email ─────────────────────────────────────
    const sendResult = await step.run('send-alert', async () => {
      const resend = new Resend(process.env.RESEND_API_KEY!);
      const from = process.env.RESEND_FROM_ADDRESS ?? 'Meridian <noreply@thesaunaguys.com>';

      const companyList = expiringCompanies
        .map(
          (c: { company_name: string; contract_end: string }) =>
            `<li><strong>${c.company_name}</strong> — expires ${c.contract_end}</li>`,
        )
        .join('');

      try {
        await resend.emails.send({
          from,
          to: ownerEmail.email,
          subject: `[Meridian] ${expiringCompanies.length} corporate contract(s) expiring within 30 days`,
          html: `
            <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #111827;">Contract Expiry Alert</h2>
              <p style="color: #6B7280;">
                Hi ${ownerEmail.full_name?.split(' ')[0] ?? 'there'},
              </p>
              <p style="color: #6B7280;">
                The following ${expiringCompanies.length} corporate account(s) have
                contracts expiring within the next 30 days:
              </p>
              <ul style="color: #374151;">${companyList}</ul>
              <p style="color: #6B7280;">
                Consider reaching out to discuss renewal terms.
              </p>
              <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
              <p style="color: #9CA3AF; font-size: 12px;">
                This is an automated alert from Meridian.
              </p>
            </div>
          `,
        });
        return { sent: true };
      } catch (err) {
        console.error('[contract-expiry] Failed to send alert:', err);
        return { sent: false };
      }
    });

    return {
      status: 'completed',
      expiring_contracts: expiringCompanies.length,
      alert_sent: sendResult.sent,
    };
  },
);
