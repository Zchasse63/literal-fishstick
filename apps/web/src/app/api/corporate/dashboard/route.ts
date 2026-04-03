import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

const STUDIO_ID = DEFAULT_STUDIO_ID
const ALLOWED_ROLES = ['owner', 'admin', 'manager']

/**
 * GET /api/corporate/dashboard
 *
 * Overview metrics for the corporate module:
 * - Total companies by status
 * - Total contract value
 * - Credits allocated vs used
 * - Upcoming events count
 * - Overdue invoices
 */
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createServerClient()

    // ─── Auth ──────────────────────────────────────────────────
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('roles')
      .eq('id', user.id)
      .single()

    const roles: string[] = profile?.roles ?? []
    if (!roles.some((r: string) => ALLOWED_ROLES.includes(r))) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Admin or manager role required.' },
        { status: 403 }
      )
    }

    // ─── Fetch All Companies ─────────────────────────────────
    const { data: companies } = await supabase
      .from('company_accounts')
      .select('status, contract_value, monthly_credit_allocation, credits_remaining')
      .eq('studio_id', STUDIO_ID)

    const statusCounts: Record<string, number> = {
      prospect: 0,
      active: 0,
      paused: 0,
      churned: 0,
    }
    let totalContractValue = 0
    let totalCreditsAllocated = 0
    let totalCreditsRemaining = 0

    if (companies) {
      for (const c of companies) {
        statusCounts[c.status] = (statusCounts[c.status] ?? 0) + 1
        totalContractValue += c.contract_value ?? 0
        totalCreditsAllocated += c.monthly_credit_allocation ?? 0
        totalCreditsRemaining += c.credits_remaining ?? 0
      }
    }

    // ─── Upcoming Events Count ────────────────────────────────
    const { count: upcomingEventsCount } = await supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('studio_id', STUDIO_ID)
      .not('company_id', 'is', null)
      .gte('start_time', new Date().toISOString())
      .in('status', ['confirmed', 'deposit_paid', 'quoted'])

    // ─── Overdue Invoices ─────────────────────────────────────
    const { data: overdueInvoices } = await supabase
      .from('corporate_invoices')
      .select('total, amount_paid')
      .eq('studio_id', STUDIO_ID)
      .eq('status', 'overdue')

    let overdueCount = 0
    let overdueTotal = 0
    if (overdueInvoices) {
      overdueCount = overdueInvoices.length
      for (const inv of overdueInvoices) {
        overdueTotal += (inv.total ?? 0) - (inv.amount_paid ?? 0)
      }
    }

    return NextResponse.json({
      data: {
        companies_by_status: statusCounts,
        total_companies: companies?.length ?? 0,
        total_contract_value: totalContractValue,
        credits: {
          monthly_allocated: totalCreditsAllocated,
          remaining: totalCreditsRemaining,
          used: totalCreditsAllocated - totalCreditsRemaining,
        },
        upcoming_events_count: upcomingEventsCount ?? 0,
        overdue_invoices: {
          count: overdueCount,
          total_outstanding: overdueTotal,
        },
      },
    })
  } catch (err) {
    console.error('GET /api/corporate/dashboard error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
