import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

const ALLOWED_ROLES = ['admin', 'manager', 'owner']

// Federal tax estimate (simplified bracket)
function estimateFederalTax(annual: number): number {
  if (annual <= 11600) return annual * 0.10
  if (annual <= 47150) return 1160 + (annual - 11600) * 0.12
  if (annual <= 100525) return 5426 + (annual - 47150) * 0.22
  return 17168.50 + (annual - 100525) * 0.24
}

/**
 * POST /api/payroll/periods/[id]/calculate
 *
 * Auto-calculate payroll from clock_entries + classes for the period date range.
 * For each employee: sum regular_hours, calculate overtime (>40hrs/week),
 * look up hourly_rate, count classes_led, count bonus_eligible_classes,
 * count promo_conversions. Upsert into payroll_line_items.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient()
    const { id } = await params

    // ─── Auth ──────────────────────────────────────────────────
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, roles, studio_id')
      .eq('id', user.id)
      .single()

    const roles: string[] = profile?.roles ?? []
    if (!roles.some((r: string) => ALLOWED_ROLES.includes(r))) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Admin, manager, or owner role required.' },
        { status: 403 }
      )
    }

    const studioId = profile?.studio_id || DEFAULT_STUDIO_ID

    // ─── Fetch Period ──────────────────────────────────────────
    const { data: period, error: periodError } = await supabase
      .from('payroll_periods')
      .select('*')
      .eq('id', id)
      .eq('studio_id', studioId)
      .single()

    if (periodError || !period) {
      return NextResponse.json({ error: 'Payroll period not found' }, { status: 404 })
    }

    if (period.status === 'approved' || period.status === 'exported' || period.status === 'paid') {
      return NextResponse.json(
        { error: `Cannot calculate for a period with status "${period.status}". Reopen the period first.` },
        { status: 409 }
      )
    }

    // ─── Fetch Clock Entries for the Period ────────────────────
    const { data: clockEntries, error: clockError } = await supabase
      .from('clock_entries')
      .select('employee_id, clock_in, clock_out, total_hours, break_duration_minutes')
      .eq('studio_id', studioId)
      .gte('clock_in', period.period_start)
      .lte('clock_in', period.period_end)
      .not('clock_out', 'is', null)
      .eq('status', 'completed')

    if (clockError) {
      return NextResponse.json({ error: clockError.message }, { status: 500 })
    }

    // ─── Fetch Staff/Trainers for Hourly Rates ─────────────────
    const { data: staffMembers } = await supabase
      .from('staff')
      .select('id, user_id, hourly_rate, overtime_rate')
      .eq('studio_id', studioId)

    const { data: trainers } = await supabase
      .from('trainers')
      .select('id, user_id, hourly_rate, bonus_threshold')
      .eq('studio_id', studioId)

    // Build lookup maps
    const staffByUserId = new Map<string, { hourly_rate: number; overtime_rate: number }>()
    for (const s of staffMembers ?? []) {
      staffByUserId.set(s.user_id, {
        hourly_rate: s.hourly_rate ?? 15,
        overtime_rate: s.overtime_rate ?? (s.hourly_rate ?? 15) * 1.5,
      })
    }

    const trainerByUserId = new Map<string, { hourly_rate: number; bonus_threshold: number }>()
    for (const t of trainers ?? []) {
      trainerByUserId.set(t.user_id, {
        hourly_rate: t.hourly_rate ?? 20,
        bonus_threshold: t.bonus_threshold ?? 7,
      })
    }

    // ─── Aggregate Hours Per Employee Per Week ─────────────────
    // Group clock entries by employee_id
    const employeeHours = new Map<string, number>()
    const employeeWeeklyHours = new Map<string, Map<string, number>>()

    for (const entry of clockEntries ?? []) {
      const empId = entry.employee_id
      const hours = entry.total_hours ?? 0
      const breakHours = (entry.break_duration_minutes ?? 0) / 60
      const netHours = Math.max(0, hours - breakHours)

      employeeHours.set(empId, (employeeHours.get(empId) ?? 0) + netHours)

      // Calculate ISO week for overtime tracking
      const clockInDate = new Date(entry.clock_in)
      const weekKey = getISOWeekKey(clockInDate)

      if (!employeeWeeklyHours.has(empId)) {
        employeeWeeklyHours.set(empId, new Map())
      }
      const weekMap = employeeWeeklyHours.get(empId)!
      weekMap.set(weekKey, (weekMap.get(weekKey) ?? 0) + netHours)
    }

    // Calculate regular vs overtime hours
    const employeeRegularOT = new Map<string, { regular: number; overtime: number }>()
    for (const [empId, weekMap] of employeeWeeklyHours) {
      let totalRegular = 0
      let totalOvertime = 0
      for (const [, weekHours] of weekMap) {
        if (weekHours > 40) {
          totalRegular += 40
          totalOvertime += weekHours - 40
        } else {
          totalRegular += weekHours
        }
      }
      employeeRegularOT.set(empId, {
        regular: Math.round(totalRegular * 100) / 100,
        overtime: Math.round(totalOvertime * 100) / 100,
      })
    }

    // ─── Fetch Classes Led by Trainers in Period ───────────────
    const { data: classesInPeriod } = await supabase
      .from('classes')
      .select('id, trainer_id, check_in_count')
      .eq('studio_id', studioId)
      .gte('start_time', period.period_start)
      .lte('start_time', period.period_end)

    // Count classes per trainer
    const trainerClasses = new Map<string, { total: number; bonusEligible: number }>()
    for (const cls of classesInPeriod ?? []) {
      if (!cls.trainer_id) continue
      const current = trainerClasses.get(cls.trainer_id) ?? { total: 0, bonusEligible: 0 }
      current.total += 1

      // Check if this class meets bonus threshold
      const trainerInfo = trainerByUserId.get(cls.trainer_id)
      const threshold = trainerInfo?.bonus_threshold ?? 7
      if ((cls.check_in_count ?? 0) >= threshold) {
        current.bonusEligible += 1
      }
      trainerClasses.set(cls.trainer_id, current)
    }

    // ─── Fetch Promo Conversions ───────────────────────────────
    const { data: promoConversions } = await supabase
      .from('promo_codes')
      .select('trainer_id, times_used')
      .eq('studio_id', studioId)

    const trainerPromos = new Map<string, number>()
    for (const promo of promoConversions ?? []) {
      if (!promo.trainer_id) continue
      trainerPromos.set(
        promo.trainer_id,
        (trainerPromos.get(promo.trainer_id) ?? 0) + (promo.times_used ?? 0)
      )
    }

    // ─── Build Line Items ──────────────────────────────────────
    const allEmployeeIds = new Set<string>()
    for (const empId of employeeHours.keys()) allEmployeeIds.add(empId)
    for (const tId of trainerClasses.keys()) allEmployeeIds.add(tId)

    const lineItems = []

    for (const empId of allEmployeeIds) {
      const hours = employeeRegularOT.get(empId) ?? { regular: 0, overtime: 0 }
      const staffInfo = staffByUserId.get(empId)
      const trainerInfo = trainerByUserId.get(empId)

      const hourlyRate = staffInfo?.hourly_rate ?? trainerInfo?.hourly_rate ?? 15
      const overtimeRate = staffInfo?.overtime_rate ?? hourlyRate * 1.5

      const basePay = Math.round(hours.regular * hourlyRate * 100) / 100
      const overtimePay = Math.round(hours.overtime * overtimeRate * 100) / 100

      const classInfo = trainerClasses.get(empId) ?? { total: 0, bonusEligible: 0 }
      const trainerBonuses = classInfo.bonusEligible * 25 // $25 per bonus-eligible class
      const promoConversionCount = trainerPromos.get(empId) ?? 0
      const promoCommissions = promoConversionCount * 5 // $5 per promo conversion

      const grossPay = basePay + overtimePay + trainerBonuses + promoCommissions

      // Tax estimates (simplified)
      const annualizedGross = grossPay * 26 // Assume biweekly
      const federalEstimate = Math.round(estimateFederalTax(annualizedGross) / 26 * 100) / 100
      const stateEstimate = Math.round(grossPay * 0 * 100) / 100 // Florida: no state income tax
      const ficaEstimate = Math.round(grossPay * 0.0765 * 100) / 100
      const netPayEstimate = Math.round((grossPay - federalEstimate - stateEstimate - ficaEstimate) * 100) / 100

      lineItems.push({
        payroll_period_id: id,
        employee_id: empId,
        studio_id: studioId,
        regular_hours: hours.regular,
        overtime_hours: hours.overtime,
        hourly_rate: hourlyRate,
        overtime_rate: overtimeRate,
        base_pay: basePay,
        overtime_pay: overtimePay,
        trainer_bonuses: trainerBonuses,
        promo_commissions: promoCommissions,
        tips: 0,
        other_earnings: 0,
        gross_pay: grossPay,
        federal_estimate: federalEstimate,
        state_estimate: stateEstimate,
        fica_estimate: ficaEstimate,
        net_pay_estimate: netPayEstimate,
        classes_led: classInfo.total,
        bonus_eligible_classes: classInfo.bonusEligible,
        promo_conversions: promoConversionCount,
      })
    }

    // ─── Upsert Line Items ─────────────────────────────────────
    // Delete existing line items for this period, then insert fresh
    await supabase
      .from('payroll_line_items')
      .delete()
      .eq('payroll_period_id', id)
      .eq('studio_id', studioId)

    let insertedItems = null
    if (lineItems.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from('payroll_line_items')
        .insert(lineItems)
        .select()

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }
      insertedItems = inserted
    }

    // Update period status to processing
    await supabase
      .from('payroll_periods')
      .update({ status: 'processing' })
      .eq('id', id)
      .eq('studio_id', studioId)

    // Log activity
    await supabase.from('activity_log').insert({
      studio_id: studioId,
      actor_id: user.id,
      type: 'payroll_calculated',
      subject_type: 'payroll_period',
      subject_id: id,
      metadata: {
        employee_count: lineItems.length,
        total_gross: lineItems.reduce((sum, li) => sum + li.gross_pay, 0),
      },
    })

    return NextResponse.json({
      data: {
        period_id: id,
        employee_count: lineItems.length,
        line_items: insertedItems ?? [],
        total_gross: Math.round(lineItems.reduce((sum, li) => sum + li.gross_pay, 0) * 100) / 100,
      },
    })
  } catch (err) {
    console.error('POST /api/payroll/periods/[id]/calculate error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Get ISO week key (e.g. "2026-W12") for a date.
 */
function getISOWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`
}
