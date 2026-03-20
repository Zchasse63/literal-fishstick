'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'

const STUDIO_ID = '11111111-1111-1111-1111-111111111111'

// ---------------------------------------------------------------------------
// Shared Supabase instance
// ---------------------------------------------------------------------------

function useSupabaseClient() {
  return useMemo(() => createBrowserClient(), [])
}

// ---------------------------------------------------------------------------
// useEmployeeProfile — get employee + trainer record for current user
// ---------------------------------------------------------------------------

export interface EmployeeRecord {
  id: string
  profile_id: string
  studio_id: string
  employment_type: string
  department: string | null
  hire_date: string | null
  pay_rate: number | null
  pay_type: string | null
  status: string
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  emergency_contact_relationship: string | null
  bank_routing_last4: string | null
  bank_account_last4: string | null
}

export interface TrainerRecord {
  id: string
  profile_id: string
  studio_id: string
  bio: string | null
  specialties: string[] | null
  promo_code: string | null
  base_pay_per_class: number | null
  bonus_amount: number | null
  bonus_threshold: number | null
  commission_rate: number | null
  is_public: boolean
  photo_url: string | null
  total_classes_led: number | null
  total_bonus_earned: number | null
  total_commission_earned: number | null
}

export interface EmployeeProfile {
  employee: EmployeeRecord | null
  trainer: TrainerRecord | null
  profileId: string | null
  fullName: string
  email: string
  phone: string | null
  avatarUrl: string | null
}

export function useEmployeeProfile() {
  const supabase = useSupabaseClient()
  const { profile, loading: authLoading } = useAuth()
  const [employee, setEmployee] = useState<EmployeeRecord | null>(null)
  const [trainer, setTrainer] = useState<TrainerRecord | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!profile?.id) {
      setLoading(false)
      return
    }

    async function fetchRecords() {
      const [empRes, trainerRes] = await Promise.all([
        supabase
          .from('employees')
          .select('*')
          .eq('profile_id', profile!.id)
          .eq('studio_id', STUDIO_ID)
          .maybeSingle(),
        supabase
          .from('trainers')
          .select('*')
          .eq('profile_id', profile!.id)
          .eq('studio_id', STUDIO_ID)
          .maybeSingle(),
      ])

      setEmployee(empRes.data as EmployeeRecord | null)
      setTrainer(trainerRes.data as TrainerRecord | null)
      setLoading(false)
    }

    fetchRecords()
  }, [supabase, profile, authLoading])

  return {
    employee,
    trainer,
    profileId: profile?.id ?? null,
    fullName: profile?.full_name ?? 'Employee',
    email: profile?.email ?? '',
    phone: (profile as any)?.phone ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    loading: authLoading || loading,
  }
}

// ---------------------------------------------------------------------------
// useEmployeeClasses — classes assigned to this trainer
// ---------------------------------------------------------------------------

export interface ClassWithType {
  id: string
  title: string
  starts_at: string
  ends_at: string
  capacity: number
  booked_count: number
  checked_in_count: number
  status: string
  trainer_id: string
  class_types: { name: string; type: string; color: string } | null
}

export function useEmployeeClasses(trainerId: string | null | undefined) {
  const supabase = useSupabaseClient()
  const [upcoming, setUpcoming] = useState<ClassWithType[]>([])
  const [past, setPast] = useState<ClassWithType[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!trainerId) {
      setLoading(false)
      return
    }
    setLoading(true)
    const now = new Date().toISOString()

    const [upRes, pastRes] = await Promise.all([
      supabase
        .from('classes')
        .select('*, class_types:class_type_id ( name, type, color )')
        .eq('trainer_id', trainerId)
        .eq('studio_id', STUDIO_ID)
        .gte('starts_at', now)
        .order('starts_at', { ascending: true })
        .limit(20),
      supabase
        .from('classes')
        .select('*, class_types:class_type_id ( name, type, color )')
        .eq('trainer_id', trainerId)
        .eq('studio_id', STUDIO_ID)
        .lt('starts_at', now)
        .order('starts_at', { ascending: false })
        .limit(20),
    ])

    setUpcoming((upRes.data as ClassWithType[]) ?? [])
    setPast((pastRes.data as ClassWithType[]) ?? [])
    setLoading(false)
  }, [supabase, trainerId])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { upcoming, past, loading, refetch: fetch }
}

// ---------------------------------------------------------------------------
// useClockEntries — time entries for current employee
// ---------------------------------------------------------------------------

export interface ClockEntry {
  id: string
  employee_id: string
  clock_in: string
  clock_out: string | null
  break_start: string | null
  break_end: string | null
  break_duration_minutes: number | null
  total_hours: number | null
  geofence_verified_in: boolean
  geofence_verified_out: boolean | null
  status: string
  notes: string | null
  created_at: string
}

export function useClockEntries(employeeId: string | null | undefined, dateRange?: { from: string; to: string }) {
  const supabase = useSupabaseClient()
  const [entries, setEntries] = useState<ClockEntry[]>([])
  const [loading, setLoading] = useState(true)

  const rangeKey = dateRange ? `${dateRange.from}-${dateRange.to}` : 'all'

  const fetch = useCallback(async () => {
    if (!employeeId) {
      setLoading(false)
      return
    }
    setLoading(true)

    let query = supabase
      .from('clock_entries')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('studio_id', STUDIO_ID)
      .order('clock_in', { ascending: false })

    if (dateRange) {
      query = query.gte('clock_in', dateRange.from).lte('clock_in', dateRange.to + 'T23:59:59')
    }

    const { data } = await query.limit(50)
    setEntries((data as ClockEntry[]) ?? [])
    setLoading(false)
  }, [supabase, employeeId, rangeKey])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { entries, loading, refetch: fetch }
}

// ---------------------------------------------------------------------------
// useTrainerClassLog — performance records
// ---------------------------------------------------------------------------

export interface TrainerClassLogEntry {
  id: string
  trainer_id: string
  class_id: string
  check_in_count: number
  bonus_earned: boolean
  bonus_amount: number
  base_pay: number
  created_at: string
  classes?: {
    title: string
    starts_at: string
    ends_at: string
    capacity: number
    class_types: { name: string } | null
  } | null
}

export function useTrainerClassLog(trainerId: string | null | undefined) {
  const supabase = useSupabaseClient()
  const [entries, setEntries] = useState<TrainerClassLogEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!trainerId) {
      setLoading(false)
      return
    }

    async function fetchLog() {
      const { data } = await supabase
        .from('trainer_class_log')
        .select('*, classes:class_id ( title, starts_at, ends_at, capacity, class_types:class_type_id ( name ) )')
        .eq('trainer_id', trainerId)
        .eq('studio_id', STUDIO_ID)
        .order('created_at', { ascending: false })
        .limit(100)

      setEntries((data as TrainerClassLogEntry[]) ?? [])
      setLoading(false)
    }

    fetchLog()
  }, [supabase, trainerId])

  return { entries, loading }
}

// ---------------------------------------------------------------------------
// usePromoAttributions — promo code redemption log
// ---------------------------------------------------------------------------

export interface PromoAttribution {
  id: string
  trainer_id: string
  member_id: string
  promo_code: string
  attributed_sale_amount: number
  commission_amount: number
  commission_paid: boolean
  plan_purchased: string | null
  created_at: string
  members?: { profiles?: { full_name: string } | null } | null
}

export function usePromoAttributions(trainerId: string | null | undefined) {
  const supabase = useSupabaseClient()
  const [attributions, setAttributions] = useState<PromoAttribution[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!trainerId) {
      setLoading(false)
      return
    }

    async function fetch() {
      const { data } = await supabase
        .from('promo_attributions')
        .select('*, members:member_id ( profiles:profile_id ( full_name ) )')
        .eq('trainer_id', trainerId)
        .eq('studio_id', STUDIO_ID)
        .order('created_at', { ascending: false })
        .limit(50)

      setAttributions((data as PromoAttribution[]) ?? [])
      setLoading(false)
    }

    fetch()
  }, [supabase, trainerId])

  return { attributions, loading }
}

// ---------------------------------------------------------------------------
// usePayrollPeriods — pay stub data
// ---------------------------------------------------------------------------

export interface PayrollPeriod {
  id: string
  studio_id: string
  period_start: string
  period_end: string
  status: string
  total_gross: number | null
  total_bonuses: number | null
  total_commissions: number | null
  total_payroll: number | null
  created_at: string
}

export function usePayrollPeriods() {
  const supabase = useSupabaseClient()
  const [periods, setPeriods] = useState<PayrollPeriod[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('payroll_periods')
        .select('*')
        .eq('studio_id', STUDIO_ID)
        .order('period_start', { ascending: false })
        .limit(20)

      setPeriods((data as PayrollPeriod[]) ?? [])
      setLoading(false)
    }

    fetch()
  }, [supabase])

  return { periods, loading }
}

// ---------------------------------------------------------------------------
// useEmployeeDocuments — signed docs / certifications
// ---------------------------------------------------------------------------

export interface EmployeeDocument {
  id: string
  employee_id: string
  type: string
  name: string
  file_url: string | null
  status: string
  expires_at: string | null
  uploaded_at: string | null
  created_at: string
}

export function useEmployeeDocuments(employeeId: string | null | undefined) {
  const supabase = useSupabaseClient()
  const [documents, setDocuments] = useState<EmployeeDocument[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!employeeId) {
      setLoading(false)
      return
    }

    async function fetch() {
      const { data } = await supabase
        .from('employee_documents')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('studio_id', STUDIO_ID)
        .order('created_at', { ascending: false })

      setDocuments((data as EmployeeDocument[]) ?? [])
      setLoading(false)
    }

    fetch()
  }, [supabase, employeeId])

  return { documents, loading }
}

// ---------------------------------------------------------------------------
// useClockAction — clock in/out/break mutations
// ---------------------------------------------------------------------------

export function useClockAction(employeeId: string | null | undefined) {
  const supabase = useSupabaseClient()
  const [activeEntry, setActiveEntry] = useState<ClockEntry | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchActive = useCallback(async () => {
    if (!employeeId) {
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from('clock_entries')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('studio_id', STUDIO_ID)
      .is('clock_out', null)
      .order('clock_in', { ascending: false })
      .limit(1)
      .maybeSingle()

    setActiveEntry(data as ClockEntry | null)
    setLoading(false)
  }, [supabase, employeeId])

  useEffect(() => {
    fetchActive()
  }, [fetchActive])

  const clockIn = useCallback(async (lat?: number, lng?: number) => {
    if (!employeeId) return
    const { data, error } = await supabase
      .from('clock_entries')
      .insert({
        employee_id: employeeId,
        studio_id: STUDIO_ID,
        clock_in: new Date().toISOString(),
        geofence_verified_in: true,
        latitude_in: lat ?? null,
        longitude_in: lng ?? null,
        status: 'active',
      })
      .select()
      .single()

    if (!error && data) {
      setActiveEntry(data as ClockEntry)
    }
    return { data, error }
  }, [supabase, employeeId])

  const clockOut = useCallback(async (lat?: number, lng?: number) => {
    if (!activeEntry) return
    const clockIn = new Date(activeEntry.clock_in)
    const now = new Date()
    const breakMins = activeEntry.break_duration_minutes ?? 0
    const totalHours = (now.getTime() - clockIn.getTime()) / 3_600_000 - breakMins / 60

    const { data, error } = await supabase
      .from('clock_entries')
      .update({
        clock_out: now.toISOString(),
        total_hours: Math.round(totalHours * 100) / 100,
        geofence_verified_out: true,
        latitude_out: lat ?? null,
        longitude_out: lng ?? null,
        status: 'completed',
      })
      .eq('id', activeEntry.id)
      .select()
      .single()

    if (!error) {
      setActiveEntry(null)
    }
    return { data, error }
  }, [supabase, activeEntry])

  const startBreak = useCallback(async () => {
    if (!activeEntry) return
    const { error } = await supabase
      .from('clock_entries')
      .update({ break_start: new Date().toISOString() })
      .eq('id', activeEntry.id)

    if (!error) {
      setActiveEntry({ ...activeEntry, break_start: new Date().toISOString() })
    }
  }, [supabase, activeEntry])

  const endBreak = useCallback(async () => {
    if (!activeEntry || !activeEntry.break_start) return
    const breakStart = new Date(activeEntry.break_start)
    const now = new Date()
    const breakMins = Math.round((now.getTime() - breakStart.getTime()) / 60_000)
    const totalBreak = (activeEntry.break_duration_minutes ?? 0) + breakMins

    const { error } = await supabase
      .from('clock_entries')
      .update({
        break_end: now.toISOString(),
        break_start: null,
        break_duration_minutes: totalBreak,
      })
      .eq('id', activeEntry.id)

    if (!error) {
      setActiveEntry({
        ...activeEntry,
        break_start: null,
        break_end: now.toISOString(),
        break_duration_minutes: totalBreak,
      })
    }
  }, [supabase, activeEntry])

  const isClockedIn = !!activeEntry
  const isOnBreak = !!activeEntry?.break_start

  // Calculate elapsed time
  let elapsedMs = 0
  if (activeEntry) {
    elapsedMs = Date.now() - new Date(activeEntry.clock_in).getTime()
  }

  return {
    activeEntry,
    isClockedIn,
    isOnBreak,
    elapsedMs,
    loading,
    clockIn,
    clockOut,
    startBreak,
    endBreak,
    refetch: fetchActive,
  }
}

// ---------------------------------------------------------------------------
// useScheduleClasses — classes for a given week
// ---------------------------------------------------------------------------

export function useScheduleClasses(trainerId: string | null | undefined, weekStart: string, weekEnd: string) {
  const supabase = useSupabaseClient()
  const [classes, setClasses] = useState<ClassWithType[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!trainerId) {
      setLoading(false)
      return
    }

    async function fetch() {
      const { data } = await supabase
        .from('classes')
        .select('*, class_types:class_type_id ( name, type, color )')
        .eq('trainer_id', trainerId)
        .eq('studio_id', STUDIO_ID)
        .gte('starts_at', weekStart)
        .lte('starts_at', weekEnd + 'T23:59:59')
        .order('starts_at', { ascending: true })

      setClasses((data as ClassWithType[]) ?? [])
      setLoading(false)
    }

    fetch()
  }, [supabase, trainerId, weekStart, weekEnd])

  return { classes, loading }
}
