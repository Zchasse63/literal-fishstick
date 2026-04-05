'use client'

import { useCallback, useEffect, useState } from 'react'

const POLL_INTERVAL = 60_000 // 60 seconds

// ─── Types ──────────────────────────────────────────────────────

interface HeroMetric {
  value: number
  delta: number
  deltaLabel: string
}

export interface HeroData {
  revenue: HeroMetric
  attendance: HeroMetric
  fillRate: HeroMetric
  newFaces: HeroMetric
}

interface WeekMetric {
  value: number
  prior: number
  delta: number
}

export interface WeekData {
  revenue: WeekMetric
  attendance: WeekMetric
  signups: WeekMetric
  newFaceRatio: WeekMetric
  revenuePerVisit: WeekMetric
  fillRate: WeekMetric
  returningMembers: WeekMetric
  cancellationRate: WeekMetric
}

export interface KpiDataResult {
  hero: HeroData | null
  week: WeekData | null
  isLoading: boolean
  error: string | null
}

// ─── Currency formatter (cents -> display) ──────────────────────
function fmtCurrency(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  })
}

// ─── Pre-formatted hero data for the cards ──────────────────────

export interface FormattedHero {
  revenue: { value: string; delta: number; deltaLabel: string }
  attendance: { value: string; delta: number; deltaLabel: string }
  fillRate: { value: string; delta: number; deltaLabel: string }
  newFaces: { value: string; delta: number; deltaLabel: string }
}

export interface FormattedWeekMetric {
  label: string
  value: string
  prior: string
  delta: number
}

export interface FormattedKpiData {
  hero: FormattedHero | null
  week: FormattedWeekMetric[] | null
  isLoading: boolean
  error: string | null
}

function formatHero(hero: HeroData): FormattedHero {
  return {
    revenue: {
      value: fmtCurrency(hero.revenue.value),
      delta: hero.revenue.delta,
      deltaLabel: hero.revenue.deltaLabel,
    },
    attendance: {
      value: String(hero.attendance.value),
      delta: hero.attendance.delta,
      deltaLabel: hero.attendance.deltaLabel,
    },
    fillRate: {
      value: `${hero.fillRate.value}%`,
      delta: hero.fillRate.delta,
      deltaLabel: hero.fillRate.deltaLabel,
    },
    newFaces: {
      value: String(hero.newFaces.value),
      delta: hero.newFaces.delta,
      deltaLabel: hero.newFaces.deltaLabel,
    },
  }
}

function formatWeek(week: WeekData): FormattedWeekMetric[] {
  return [
    {
      label: 'Revenue',
      value: fmtCurrency(week.revenue.value),
      prior: fmtCurrency(week.revenue.prior),
      delta: week.revenue.delta,
    },
    {
      label: 'Attendance',
      value: String(week.attendance.value),
      prior: String(week.attendance.prior),
      delta: week.attendance.delta,
    },
    {
      label: 'Signups',
      value: String(week.signups.value),
      prior: String(week.signups.prior),
      delta: week.signups.delta,
    },
    {
      label: 'New Face Ratio',
      value: `${week.newFaceRatio.value}%`,
      prior: `${week.newFaceRatio.prior}%`,
      delta: week.newFaceRatio.delta,
    },
    {
      label: 'Revenue / Visit',
      value: fmtCurrency(week.revenuePerVisit.value),
      prior: fmtCurrency(week.revenuePerVisit.prior),
      delta: week.revenuePerVisit.delta,
    },
    {
      label: 'Fill Rate',
      value: `${week.fillRate.value}%`,
      prior: `${week.fillRate.prior}%`,
      delta: week.fillRate.delta,
    },
    {
      label: 'Returning Members',
      value: String(week.returningMembers.value),
      prior: String(week.returningMembers.prior),
      delta: week.returningMembers.delta,
    },
    {
      label: 'Cancellation Rate',
      value: `${week.cancellationRate.value}%`,
      prior: `${week.cancellationRate.prior}%`,
      delta: week.cancellationRate.delta,
    },
  ]
}

// ─── Hook ───────────────────────────────────────────────────────

export function useKpiData(): FormattedKpiData {
  const [hero, setHero] = useState<FormattedHero | null>(null)
  const [week, setWeek] = useState<FormattedWeekMetric[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/analytics/kpi-overview', {
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) {
        throw new Error(`KPI fetch failed: ${res.status}`)
      }
      const json = await res.json()
      if (json.hero) setHero(formatHero(json.hero))
      if (json.week) setWeek(formatWeek(json.week))
      setError(null)
    } catch (err) {
      console.error('useKpiData fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load KPIs')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchData])

  return { hero, week, isLoading, error }
}
