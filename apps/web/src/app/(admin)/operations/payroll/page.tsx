import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'
import PayrollClient from './_components/PayrollClient'
import type { PayrollPeriod } from './_components/PayrollClient'

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export default async function PayrollPage() {
  const supabase = await createServerClient()

  const { data } = await supabase
    .from('payroll_periods')
    .select('*')
    .eq('studio_id', DEFAULT_STUDIO_ID)
    .order('start_date', { ascending: false })

  const periods: PayrollPeriod[] = (data ?? []).map((pp: any) => ({
    id: pp.id,
    startDate: new Date(pp.start_date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    endDate: new Date(pp.end_date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    payDate: pp.pay_date
      ? new Date(pp.pay_date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : '\u2014',
    status: pp.status ?? 'open',
    totalGross: pp.total_gross ?? 0,
    totalBonuses: pp.total_bonuses ?? 0,
    totalCommissions: pp.total_commissions ?? 0,
    totalPayroll: pp.total_payroll ?? 0,
    employeesCalculated: pp.employees_calculated ?? 0,
    totalEmployees: pp.total_employees ?? 0,
    lineItems: (pp.line_items ?? []).map((li: any) => ({
      employeeId: li.employee_id ?? '',
      name: li.name ?? '',
      initials: getInitials(li.name ?? 'U'),
      role: li.role ?? 'Trainer',
      regularHours: li.regular_hours ?? 0,
      overtimeHours: li.overtime_hours ?? 0,
      basePay: li.base_pay ?? 0,
      overtimePay: li.overtime_pay ?? 0,
      bonuses: li.bonuses ?? 0,
      commissions: li.commissions ?? 0,
      grossPay: li.gross_pay ?? 0,
      estimatedTaxes: li.estimated_taxes ?? 0,
      estimatedNet: li.estimated_net ?? 0,
    })),
  }))

  return <PayrollClient initialPeriods={periods} />
}
