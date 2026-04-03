import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { sendTransactionalEmail } from '@/lib/resend'
import { resolveTemplate, textToHtml, wrapEmailLayout } from '@/lib/email-templates'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

const STUDIO_ID = DEFAULT_STUDIO_ID

/**
 * POST /api/campaigns/send-test
 *
 * Send a single test email (does NOT log to email_send_log or campaign_recipients).
 * Supports both direct content and campaign-based sends.
 *
 * Body: {
 *   testEmail, subject?, bodyTemplate?,
 *   campaignId?,  // If provided, loads content from the campaign record
 *   variant?,     // 'A' | 'B' for A/B test campaigns
 *   sampleMemberId?, campaignName?
 * }
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerClient()

  // ─── Auth ──────────────────────────────────────────────────
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Role check
  const { data: _rp } = await supabase.from('profiles').select('roles').eq('id', user.id).single()
  if (!_rp?.roles?.some((r: string) => ['owner', 'manager'].includes(r))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ─── Parse Body ────────────────────────────────────────────
  const body = await request.json()
  const {
    testEmail,
    subject: directSubject,
    bodyTemplate: directBodyTemplate,
    campaignId,
    variant,
    sampleMemberId,
    campaignName: directCampaignName,
  } = body as {
    testEmail: string
    subject?: string
    bodyTemplate?: string
    campaignId?: string
    variant?: 'A' | 'B'
    sampleMemberId?: string
    campaignName?: string
  }

  if (!testEmail) {
    return NextResponse.json(
      { error: 'testEmail is required' },
      { status: 400 }
    )
  }

  // ─── Resolve Content Source ──────────────────────────────────
  let subject: string
  let bodyTemplate: string
  let campaignName: string

  if (campaignId) {
    // Load content from campaign record
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .eq('studio_id', STUDIO_ID)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    campaignName = campaign.name ?? 'Test Campaign'

    if (campaign.ab_test_enabled && variant) {
      // Send specific A/B variant
      if (variant === 'A') {
        subject = campaign.variant_a_subject ?? campaign.subject ?? ''
        bodyTemplate = campaign.variant_a_body ?? campaign.body_template ?? ''
      } else {
        subject = campaign.variant_b_subject ?? campaign.subject ?? ''
        bodyTemplate = campaign.variant_b_body ?? campaign.body_template ?? ''
      }
    } else {
      subject = campaign.subject ?? ''
      bodyTemplate = campaign.body_template ?? ''
    }

    if (!subject || !bodyTemplate) {
      return NextResponse.json(
        { error: 'Campaign has no subject or body content to send' },
        { status: 400 }
      )
    }
  } else {
    // Use directly provided content
    if (!directSubject || !directBodyTemplate) {
      return NextResponse.json(
        { error: 'Either campaignId or both subject and bodyTemplate are required' },
        { status: 400 }
      )
    }
    subject = directSubject
    bodyTemplate = directBodyTemplate
    campaignName = directCampaignName ?? 'Test Campaign'
  }

  // ─── Build Merge Data ──────────────────────────────────────
  let mergeData: Record<string, string | number> = {
    first_name: 'Test',
    last_name: 'User',
    credits_remaining: 5,
    membership_name: 'Unlimited',
    total_visits: 42,
    campaign_name: campaignName,
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
        .select('credits_remaining')
        .eq('member_id', sampleMemberId)
        .gt('credits_remaining', 0)

      const totalCredits = (creditPacks ?? []).reduce(
        (sum, p) => sum + p.credits_remaining,
        0
      )
      mergeData.credits_remaining = totalCredits

      // Fetch membership
      const { data: membership } = await supabase
        .from('members')
        .select('membership_tier')
        .eq('profile_id', sampleMemberId)
        .eq('membership_status', 'active')
        .maybeSingle()

      if (membership) {
        mergeData.membership_name = membership.membership_tier
      }
    }
  }

  // ─── Resolve & Send ───────────────────────────────────────
  const resolvedBody = resolveTemplate(bodyTemplate, mergeData)
  const bodyHtml = textToHtml(resolvedBody)
  const variantLabel = variant ? ` [Variant ${variant}]` : ''
  const html = wrapEmailLayout(bodyHtml, `[TEST]${variantLabel} ${campaignName}`)
  const resolvedSubject = `[TEST]${variantLabel} ${resolveTemplate(subject, mergeData)}`

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
    variant: variant ?? null,
  })
}
