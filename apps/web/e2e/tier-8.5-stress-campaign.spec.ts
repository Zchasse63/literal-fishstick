/**
 * T38 — Stress/load test for campaign send path.
 *
 * Seeds 500 members with email_preferences.marketing_email=false so the
 * campaign send hits the full filter/batch codepath but does not actually
 * dispatch any emails. Verifies:
 *   - The SSE stream completes without 5xx
 *   - Exactly 0 messages are sent (all filtered)
 *   - Total elapsed stays within SLA
 *   - campaign_recipients table has no rows (filtered pre-write)
 *
 * This exercises the same batching + RLS + denormalized-count logic that
 * a real production send goes through, but uses the filter path so it's
 * safe to run without touching Resend.
 */
import { test, expect } from '@playwright/test'
import { testDb, seedMember } from './fixtures/db'
import { DEFAULT_STUDIO_ID } from './fixtures/test-data'
import { randomUUID } from 'node:crypto'

const RECIPIENT_COUNT = 500
const SLA_MS = 60_000

test.describe('Platform — Stress: 500 recipient campaign send (T38)', () => {
  test.setTimeout(300_000)

  test('500 filtered recipients → 0 sent, no 5xx @stress', async ({ page }) => {
    const campaignId = randomUUID()

    // Seed campaign row
    const { error: campaignError } = await testDb.from('campaigns').insert({
      id: campaignId,
      studio_id: DEFAULT_STUDIO_ID,
      name: `E2EStress500_${campaignId.slice(0, 8)}`,
      type: 'email',
      status: 'draft',
      subject: 'Stress test subject',
      body_html: '<p>Hello {{first_name}}</p>',
      body_text: 'Hello {{first_name}}',
      ab_test_enabled: false,
      sent_count: 0,
      delivered_count: 0,
      open_count: 0,
      click_count: 0,
      bounce_count: 0,
      unsubscribe_count: 0,
      conversion_count: 0,
    })
    if (campaignError) throw new Error(`seedCampaign: ${campaignError.message}`)

    // Seed 500 members with marketing_email=false so the send filters them all out
    const members = await Promise.all(
      Array.from({ length: RECIPIENT_COUNT }, (_, i) =>
        seedMember({ fullName: `E2EStress500_M${String(i).padStart(4, '0')}` })
      )
    )

    // Bulk-insert email_preferences rows with marketing_email=false
    const prefRows = members.map((m) => ({
      member_id: m.memberId,
      studio_id: DEFAULT_STUDIO_ID,
      marketing_email: false,
      transactional_email: true,
      sms_marketing: false,
      push_notifications: true,
    }))
    const { error: prefError } = await testDb
      .from('email_preferences')
      .insert(prefRows)
    if (prefError) throw new Error(`seedPrefs: ${prefError.message}`)

    try {
      const startTime = Date.now()

      const response = await page.request.post('/api/campaigns/send', {
        data: {
          campaignId,
          memberIds: members.map((m) => m.memberId),
          subject: 'Stress test subject',
          bodyTemplate: '<p>Hello {{first_name}}</p>',
          batchSize: 50,
        },
        timeout: 240_000,
      })

      const elapsedMs = Date.now() - startTime
      const status = response.status()

      console.log(
        `[T38] campaigns/send with ${RECIPIENT_COUNT} filtered recipients: ` +
          `${status} in ${elapsedMs}ms`
      )

      // Hard bar: no 5xx
      expect(status).toBeLessThan(500)
      // Successful response (could be 200 for SSE stream)
      expect(status).toBe(200)

      // Consume the body so the stream completes
      await response.text().catch(() => {})

      // Soft SLA
      expect(elapsedMs).toBeLessThan(SLA_MS)

      // No campaign_recipients rows should have been written — all 500
      // filtered at the preference boundary before write.
      const { count: recipientCount } = await testDb
        .from('campaign_recipients')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', campaignId)
      expect(recipientCount ?? 0).toBe(0)

      // Verify no emails actually sent
      const { count: sendLogCount } = await testDb
        .from('email_send_log')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', campaignId)
        .eq('status', 'sent')
      expect(sendLogCount ?? 0).toBe(0)
    } finally {
      // Cleanup
      await testDb.from('email_send_log').delete().eq('campaign_id', campaignId)
      await testDb
        .from('campaign_recipients')
        .delete()
        .eq('campaign_id', campaignId)
      await testDb
        .from('email_preferences')
        .delete()
        .in(
          'member_id',
          members.map((m) => m.memberId)
        )
      await testDb.from('campaigns').delete().eq('id', campaignId)
      for (const m of members) {
        await testDb.from('members').delete().eq('id', m.memberId)
        await testDb.from('profiles').delete().eq('id', m.profileId)
      }
    }
  })
})
