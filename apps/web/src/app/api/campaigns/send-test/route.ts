import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { sendTransactionalEmail } from '@/lib/resend'
import { resolveTemplate, textToHtml, wrapEmailLayout } from '@/lib/email-templates'

const STUDIO_ID = '11111111-1111-1111-1111-111111111111'

/**
 * POST /api/campaigns/send-test
 *
 * Send a single test email (does NOT log to email_send_log).
 * Body: { testEmail, subject, bodyTemplate, sampleMemberId?, campaignName }
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerClient()

  // ─── Auth ──────────────────────────────────────────────────
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ─── Parse Body ────────────────────────────────────────────
  const body = await request.json()
  const { testEmail, subject, bodyTemplate, sampleMemberId, campaignName } = body as {
    testEmail: string
    subject: string
    bodyTemplate: string
    sampleMemberId?: string
    campaignName?: string
  }

  if (!testEmail || !subject || !bodyTemplate) {
    return NextResponse.json(
      { error: 'testEmail, subject, and bodyTemplate are required' },
      { status: 400 }
    )
  }

  // ─── Build Merge Data ──────────────────────────────────────
  let mergeData: Record<string, string | number> = {
    first_name: 'Test',
    last_name: 'User',
    credits_remaining: 5,
    membership_name: 'Unlimited',
    total_visits: 42,
    campaign_name: campaignName ?? 'Test Campaign',
  }

  // If a sample member is provided, use their real data
  if (sampleMemberId) {
    const { data: member } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', sampleMemberId)
      .eq('studio_id', STUDIO_ID)
      .maybeSingle()

    if (member) {
      const nameParts = (member.full_name ?? '').split(' ')
      mergeData = {
        ...mergeData,
        first_name: nameParts[0] ?? 'Test',
        last_name: nameParts.slice(1).join(' '),
      }

      // Fetch credits
      const { data: creditPacks } = await supabase
        .from('credit_packs')
        .select('remaining_credits')
        .eq('member_id', sampleMemberId)
        .gt('remaining_credits', 0)

      const totalCredits = (creditPacks ?? []).reduce(
        (sum, p) => sum + p.remaining_credits,
        0
      )
      mergeData.credits_remaining = totalCredits

      // Fetch membership
      const { data: membership } = await supabase
        .from('memberships')
        .select('type')
        .eq('member_id', sampleMemberId)
        .eq('status', 'active')
        .maybeSingle()

      if (membership) {
        mergeData.membership_name = membership.type
      }
    }
  }

  // ─── Resolve & Send ───────────────────────────────────────
  const resolvedBody = resolveTemplate(bodyTemplate, mergeData)
  const bodyHtml = textToHtml(resolvedBody)
  const html = wrapEmailLayout(bodyHtml, `[TEST] ${campaignName ?? 'Test Campaign'}`)
  const resolvedSubject = `[TEST] ${resolveTemplate(subject, mergeData)}`

  const result = await sendTransactionalEmail(testEmail, resolvedSubject, html)

  if (result.error) {
    return NextResponse.json(
      { error: result.error, dryRun: result.dryRun },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    resendId: result.id,
    dryRun: result.dryRun,
  })
}
