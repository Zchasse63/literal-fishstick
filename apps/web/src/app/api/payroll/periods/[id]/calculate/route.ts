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

    // ─── Fetch Employees/Trainers for Pay Rates ────────────────
    // Schema: the `staff` table doesn't exist — use `employees` which has
    // profile_id (not user_id), pay_rate (not hourly_rate), and pay_type.
    // Trainers are paid per class (base_pay_per_class) not hourly.
    const { data: employees } = await supabase
      .from('employees')
      .select('id, profile_id, pay_rate, pay_type')
      .eq('studio_id', studioId)

    const { data: trainers } = await supabase
      .from('trainers')
      .select('id, profile_id, base_pay_per_class, bonus_amount, bonus_threshold')
      .eq('studio_id', studioId)

    // Build lookup maps keyed by profile_id (= user/auth id) since clock
    // entries' employee_id FK points at employees.id but we also need to
    // resolve by profile_id for dual-role lookups.
    const employeeById = new Map<string, { hourly_rate: number; overtime_rate: number; profile_id: string }>()
    const employeeByProfileId = new Map<string, { hourly_rate: number; overtime_rate: number }>()
    for (const e of employees ?? []) {
      const hourly = e.pay_rate ?? 15
      const overtime = hourly * 1.5
      employeeById.set(e.id, {
        hourly_rate: hourly,
        overtime_rate: overtime,
        profile_id: e.profile_id,
      })
      employeeByProfileId.set(e.profile_id, {
        hourly_rate: hourly,
        overtime_rate: overtime,
      })
    }

    const trainerByProfileId = new Map<string, { base_pay_per_class: number; bonus_amount: number; bonus_threshold: number }>()
    const trainerById = new Map<string, { base_pay_per_class: number; bonus_amount: number; bonus_threshold: number; profile_id: string }>()
    for (const t of trainers ?? []) {
      const info = {
        base_pay_per_class: t.base_pay_per_class ?? 25,
        bonus_amount: t.bonus_amount ?? 25,
        bonus_threshold: t.bonus_threshold ?? 7,
      }
      trainerByProfileId.set(t.profile_id, info)
      trainerById.set(t.id, { ...info, profile_id: t.profile_id })
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
    // Schema: classes uses starts_at (not start_time), checked_in_count
    // (not check_in_count), and trainer_id points at trainers.id (not profile).
    const { data: classesInPeriod } = await supabase
      .from('classes')
      .select('id, trainer_id, checked_in_count')
      .eq('studio_id', studioId)
      .gte('starts_at', period.period_start)
      .lte('starts_at', period.period_end)

    // Count classes per trainer (keyed by trainers.id)
    const trainerClasses = new Map<string, { total: number; bonusEligible: number }>()
    for (const cls of classesInPeriod ?? []) {
      if (!cls.trainer_id) continue
      const current = trainerClasses.get(cls.trainer_id) ?? { total: 0, bonusEligible: 0 }
      current.total += 1

      // Check if this class meets bonus threshold
      const trainerInfo = trainerById.get(cls.trainer_id)
      const threshold = trainerInfo?.bonus_threshold ?? 7
      if ((cls.checked_in_count ?? 0) >= threshold) {
        current.bonusEligible += 1
      }
      trainerClasses.set(cls.trainer_id, current)
    }

    // ─── Fetch Promo Conversions ───────────────────────────────
    // Aggregate from promo_attributions (the canonical source of truth for
    // actual conversions) rather than the denormalized promo_codes.times_used,
    // since attributions are what drive the per-trainer commission.
    const { data: promoAttributions } = await supabase
      .from('promo_attributions')
      .select('trainer_id')
      .eq('studio_id', studioId)
      .gte('created_at', period.period_start)
      .lte('created_at', period.period_end)

    const trainerPromos = new Map<string, number>()
    for (const att of promoAttributions ?? []) {
      if (!att.trainer_id) continue
      trainerPromos.set(
        att.trainer_id,
        (trainerPromos.get(att.trainer_id) ?? 0) + 1
      )
    }

    // ─── Build Line Items ──────────────────────────────────────
    // Line items are keyed by employees.id. For trainer-only rows (no
    // employees record) the clock_entries set is empty and pay comes from
    // per-class calculations. For dual-role (employee + trainer), both
    // contribute — hourly from employees, bonus + commission from trainers.
    const employeeIdSet = new Set<string>()
    for (const empId of employeeHours.keys()) employeeIdSet.add(empId)

    // For trainers without an employees row, we still want a payroll line
    // item. Use trainers.id as the employee_id fallback.
    for (const tId of trainerClasses.keys()) {
      const trainer = trainerById.get(tId)
      if (!trainer) continue
      // Only add if there's no existing employees row for this profile
      const existingEmployee = employees?.find((e) => e.profile_id === trainer.profile_id)
      if (!existingEmployee) {
        employeeIdSet.add(tId) // fall back to trainer id for orphan case
      }
    }

    // Helper: find the trainers.id for a given line-item key. Returns null
    // if neither the key itself nor the associated employee profile match.
    function resolveTrainerId(key: string): string | null {
      // Case 1: key IS a trainers.id (orphan trainer-only row)
      if (trainerById.has(key)) return key
      // Case 2: key is an employees.id — look up via profile_id
      const empInfo = employeeById.get(key)
      if (!empInfo) return null
      for (const [tId, t] of trainerById.entries()) {
        if (t.profile_id === empInfo.profile_id) return tId
      }
      return null
    }

    const lineItems = []

    for (const empId of employeeIdSet) {
      const hours = employeeRegularOT.get(empId) ?? { regular: 0, overtime: 0 }
      const employeeInfo = employeeById.get(empId)
      const trainerId = resolveTrainerId(empId)
      const trainerInfo = trainerId ? trainerById.get(trainerId) : null

      const hourlyRate = employeeInfo?.hourly_rate ?? 0
      const overtimeRate = employeeInfo?.overtime_rate ?? hourlyRate * 1.5

      const basePay = Math.round(hours.regular * hourlyRate * 100) / 100
      const overtimePay = Math.round(hours.overtime * overtimeRate * 100) / 100

      // Trainer per-class pay + bonus — only when we found a trainer row.
      const classInfo = trainerId
        ? (trainerClasses.get(trainerId) ?? { total: 0, bonusEligible: 0 })
        : { total: 0, bonusEligible: 0 }
      const perClassBase = trainerInfo?.base_pay_per_class ?? 0
      const trainerClassBasePay = Math.round(classInfo.total * perClassBase * 100) / 100
      const bonusAmount = trainerInfo?.bonus_amount ?? 25
      const trainerBonuses = Math.round(classInfo.bonusEligible * bonusAmount * 100) / 100
      const promoConversionCount = trainerId ? (trainerPromos.get(trainerId) ?? 0) : 0
      const promoCommissions = promoConversionCount * 5 // $5 per promo conversion

      const grossPay = basePay + overtimePay + trainerClassBasePay + trainerBonuses + promoCommissions

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
        federal_tax_estimate: federalEstimate,
        state_tax_estimate: stateEstimate,
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
