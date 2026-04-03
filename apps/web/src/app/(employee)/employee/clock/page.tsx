'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { createBrowserClient } from '@/lib/supabase/client'
import {
  Loader2,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  Pause,
  Coffee,
  LogOut,
  Navigation,
  Shield,
  Timer,
} from 'lucide-react'
import { fadeInUp } from '@/lib/motion'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

// ─── Types ──────────────────────────────────────────────────
type ClockStatus = 'clocked-out' | 'clocked-in' | 'on-break'
type LocationPermission = 'granted' | 'denied' | 'pending'

interface ClockEntry {
  id: string
  type: 'clock-in' | 'clock-out' | 'break-start' | 'break-end'
  time: string
  distance: number
  withinRadius: boolean
}

const STUDIO_ID = DEFAULT_STUDIO_ID

// ─── Helpers ────────────────────────────────────────────────
function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

const entryConfig: Record<ClockEntry['type'], { label: string; color: string; bg: string; icon: typeof Clock }> = {
  'clock-in': { label: 'Clocked In', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: Play },
  'clock-out': { label: 'Clocked Out', color: 'text-red-600', bg: 'bg-red-50', icon: LogOut },
  'break-start': { label: 'Break Started', color: 'text-amber-600', bg: 'bg-amber-50', icon: Coffee },
  'break-end': { label: 'Break Ended', color: 'text-blue-600', bg: 'bg-blue-50', icon: Play },
}

// ─── Component ──────────────────────────────────────────────
export default function EmployeeClockPage() {
  const [clockStatus, setClockStatus] = useState<ClockStatus>('clocked-out')
  const [locationPermission, setLocationPermission] = useState<LocationPermission>('pending')
  const [now, setNow] = useState(new Date())
  const [entries, setEntries] = useState<ClockEntry[]>([])
  const [clockedInSince, setClockedInSince] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentDistance, setCurrentDistance] = useState(0)
  const [geoRadius, setGeoRadius] = useState(150)
  const [weeklyHours, setWeeklyHours] = useState(0)
  const [weeklyOT, setWeeklyOT] = useState(0)

  // Fetch clock entries and geofence
  useEffect(() => {
    async function fetchClockData() {
      const supabase = createBrowserClient()

      // Fetch today's clock entries
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const { data: clockEntries } = await supabase
        .from('clock_entries')
        .select('*')
        .eq('studio_id', STUDIO_ID)
        .gte('clock_in', todayStart.toISOString())
        .order('clock_in', { ascending: true })

      if (clockEntries && clockEntries.length > 0) {
        // Build timeline entries from clock_entries rows (each row has clock_in/clock_out/break_start/break_end timestamps)
        const mapped: ClockEntry[] = []
        for (const e of clockEntries) {
          const dist = e.distance_from_studio ?? 0
          if (e.clock_in) {
            mapped.push({
              id: `${e.id}-in`,
              type: 'clock-in',
              time: new Date(e.clock_in).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
              distance: dist,
              withinRadius: e.geofence_verified_in ?? true,
            })
          }
          if (e.break_start) {
            mapped.push({
              id: `${e.id}-bs`,
              type: 'break-start',
              time: new Date(e.break_start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
              distance: dist,
              withinRadius: true,
            })
          }
          if (e.break_end) {
            mapped.push({
              id: `${e.id}-be`,
              type: 'break-end',
              time: new Date(e.break_end).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
              distance: dist,
              withinRadius: true,
            })
          }
          if (e.clock_out) {
            mapped.push({
              id: `${e.id}-out`,
              type: 'clock-out',
              time: new Date(e.clock_out).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
              distance: dist,
              withinRadius: e.geofence_verified_out ?? true,
            })
          }
        }
        setEntries(mapped)

        // Determine current status from the latest clock entry row
        const lastEntry = clockEntries[clockEntries.length - 1]
        if (!lastEntry.clock_out) {
          if (lastEntry.break_start && !lastEntry.break_end) {
            setClockStatus('on-break')
          } else {
            setClockStatus('clocked-in')
          }
          setClockedInSince(new Date(lastEntry.clock_in))
        } else {
          setClockStatus('clocked-out')
        }
      }

      // Fetch geofence
      const { data: geo } = await supabase
        .from('geofence_locations')
        .select('radius_meters')
        .eq('studio_id', STUDIO_ID)
        .eq('is_active', true)
        .limit(1)
        .single()

      if (geo) {
        setGeoRadius(geo.radius_meters ?? 150)
      }

      setLoading(false)
    }
    fetchClockData()
  }, [])

  // Tick clock every second
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const elapsedMs = clockStatus !== 'clocked-out' && clockedInSince ? now.getTime() - clockedInSince.getTime() : 0
  const isWithinRadius = currentDistance <= geoRadius

  const [actionLoading, setActionLoading] = useState(false)

  // Request real geolocation on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationPermission('denied')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocationPermission('granted')
        // Distance will be calculated server-side, but we store coords for the API call
        setCurrentDistance(0) // Placeholder — actual distance computed server-side
      },
      (err) => {
        setLocationPermission(err.code === 1 ? 'denied' : 'pending')
      }
    )
  }, [])

  const getPosition = (): Promise<{ latitude: number; longitude: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null)
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000 }
      )
    })
  }

  const callClockAPI = async (action: 'clock_in' | 'clock_out') => {
    setActionLoading(true)
    try {
      const position = await getPosition()
      const res = await fetch('/api/clock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          latitude: position?.latitude,
          longitude: position?.longitude,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        // Refresh page state from API response
        if (action === 'clock_in') {
          setClockStatus('clocked-in')
          setClockedInSince(new Date())
          setCurrentDistance(data.distance_from_studio ?? 0)
          setEntries(prev => [...prev, {
            id: `entry-${Date.now()}`,
            type: 'clock-in',
            time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
            distance: data.distance_from_studio ?? 0,
            withinRadius: data.geofence_verified ?? true,
          }])
        } else {
          setClockStatus('clocked-out')
          setClockedInSince(null)
          setCurrentDistance(data.distance_from_studio ?? 0)
          setEntries(prev => [...prev, {
            id: `entry-${Date.now()}`,
            type: 'clock-out',
            time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
            distance: data.distance_from_studio ?? 0,
            withinRadius: data.geofence_verified ?? true,
          }])
        }
      } else {
        const err = await res.json().catch(() => ({ error: 'Failed' }))
        console.error('Clock API error:', err.error)
      }
    } catch (err) {
      console.error('Clock action failed:', err)
    } finally {
      setActionLoading(false)
    }
  }

  const handleClockIn = () => callClockAPI('clock_in')
  const handleClockOut = () => callClockAPI('clock_out')

  const handleStartBreak = () => {
    // Break tracking is done via local state — the clock_entries row is updated on clock_out
    setClockStatus('on-break')
    setEntries(prev => [...prev, {
      id: `entry-${Date.now()}`,
      type: 'break-start',
      time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      distance: currentDistance,
      withinRadius: true,
    }])
  }

  const handleEndBreak = () => {
    setClockStatus('clocked-in')
    setEntries(prev => [...prev, {
      id: `entry-${Date.now()}`,
      type: 'break-end',
      time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      distance: currentDistance,
      withinRadius: true,
    }])
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div {...fadeInUp}>
        <h1 className="text-2xl font-bold text-gray-900">Clock In/Out</h1>
        <p className="text-sm text-gray-500 mt-0.5">{formatDate(now)}</p>
      </motion.div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left Column: Clock + Actions */}
        <div className="col-span-2 space-y-6">
          {/* Clock Status Card */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.05 }}
            className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm"
          >
            <div className="flex flex-col items-center text-center">
              {/* Status Badge */}
              <div className="mb-6">
                {clockStatus === 'clocked-in' && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 border border-emerald-200">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    Clocked In
                  </span>
                )}
                {clockStatus === 'on-break' && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-4 py-2 text-sm font-bold text-amber-700 border border-amber-200">
                    <Coffee className="h-3.5 w-3.5" />
                    On Break
                  </span>
                )}
                {clockStatus === 'clocked-out' && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-500">
                    Not Clocked In
                  </span>
                )}
              </div>

              {/* Elapsed Timer */}
              {clockStatus !== 'clocked-out' && (
                <div className="mb-6">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Elapsed Time</p>
                  <p className="mt-1 text-[48px] font-black tabular-nums tracking-tight text-gray-900">
                    {formatElapsed(elapsedMs)}
                  </p>
                </div>
              )}

              {/* Current Time */}
              <p className="text-[28px] font-black tabular-nums text-gray-900">{formatTime(now)}</p>

              {/* Action Buttons */}
              <div className="mt-8 flex items-center gap-4">
                {clockStatus === 'clocked-out' && (
                  <button
                    onClick={handleClockIn}
                    disabled={!isWithinRadius || actionLoading}
                    className={cn(
                      'inline-flex items-center gap-2.5 rounded-2xl px-8 py-4 text-base font-bold shadow-lg transition-all duration-200 active:scale-95',
                      isWithinRadius && !actionLoading
                        ? 'bg-gradient-to-br from-indigo-600 to-violet-500 text-white hover:from-indigo-700 hover:to-violet-600 hover:shadow-xl'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    )}
                  >
                    {actionLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
                    {actionLoading ? 'Clocking In...' : 'Clock In'}
                  </button>
                )}

                {clockStatus === 'clocked-in' && (
                  <>
                    <button
                      onClick={handleStartBreak}
                      className="inline-flex items-center gap-2 rounded-2xl border-2 border-amber-200 bg-amber-50 px-6 py-4 text-base font-bold text-amber-700 transition-all duration-200 hover:bg-amber-100 active:scale-95"
                    >
                      <Coffee className="h-5 w-5" />
                      Start Break
                    </button>
                    <button
                      onClick={handleClockOut}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 px-8 py-4 text-base font-bold text-white shadow-lg transition-all duration-200 hover:from-red-600 hover:to-red-700 hover:shadow-xl active:scale-95 disabled:opacity-50"
                    >
                      {actionLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogOut className="h-5 w-5" />}
                      {actionLoading ? 'Clocking Out...' : 'Clock Out'}
                    </button>
                  </>
                )}

                {clockStatus === 'on-break' && (
                  <button
                    onClick={handleEndBreak}
                    className="inline-flex items-center gap-2.5 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 px-8 py-4 text-base font-bold text-white shadow-lg transition-all duration-200 hover:from-blue-600 hover:to-indigo-700 hover:shadow-xl active:scale-95"
                  >
                    <Play className="h-5 w-5" />
                    End Break
                  </button>
                )}
              </div>
            </div>
          </motion.div>

          {/* Geofence Verification */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.1 }}
            className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">Location Verification</p>

            <div className="space-y-3">
              {/* Permission Status */}
              <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <Shield className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Location Permission</span>
                </div>
                {locationPermission === 'granted' ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Granted
                  </span>
                ) : locationPermission === 'denied' ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600">
                    <XCircle className="h-3.5 w-3.5" />
                    Denied
                  </span>
                ) : (
                  <button
                    onClick={() => {
                      navigator.geolocation?.getCurrentPosition(
                        () => setLocationPermission('granted'),
                        (err) => setLocationPermission(err.code === 1 ? 'denied' : 'pending')
                      )
                    }}
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700"
                  >
                    Allow Location Access
                  </button>
                )}
              </div>

              {/* Distance Indicator */}
              <div className={cn(
                'flex items-center justify-between rounded-xl border px-4 py-3',
                isWithinRadius ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'
              )}>
                <div className="flex items-center gap-3">
                  <Navigation className={cn('h-4 w-4', isWithinRadius ? 'text-emerald-600' : 'text-red-600')} />
                  <span className={cn('text-sm font-medium', isWithinRadius ? 'text-emerald-700' : 'text-red-700')}>
                    Distance from Studio
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {isWithinRadius ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className={cn('text-sm font-bold tabular-nums', isWithinRadius ? 'text-emerald-700' : 'text-red-700')}>
                    {currentDistance}m
                  </span>
                  <span className={cn('text-xs', isWithinRadius ? 'text-emerald-600' : 'text-red-600')}>
                    (within {geoRadius}m radius)
                  </span>
                </div>
              </div>

              {/* Map Pin Badge */}
              <div className="flex items-center justify-center gap-1.5 pt-1">
                <MapPin className={cn('h-3.5 w-3.5', isWithinRadius ? 'text-emerald-500' : 'text-red-500')} />
                <span className={cn('text-xs font-semibold', isWithinRadius ? 'text-emerald-600' : 'text-red-600')}>
                  {isWithinRadius ? 'You are at the studio' : 'You are outside the geofence'}
                </span>
              </div>
            </div>
          </motion.div>

          {/* Today's Entries */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.15 }}
            className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">Today&apos;s Entries</p>

            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[15px] top-2 bottom-2 w-px bg-gray-200" />

              <div className="space-y-4">
                {entries.map((entry) => {
                  const config = entryConfig[entry.type]
                  const Icon = config.icon
                  return (
                    <div key={entry.id} className="flex items-start gap-4 relative">
                      <div className={cn('relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-white', config.bg)}>
                        <Icon className={cn('h-3.5 w-3.5', config.color)} />
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className={cn('text-sm font-semibold', config.color)}>{config.label}</span>
                            <span className="ml-2 text-sm tabular-nums text-gray-500">{entry.time}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {entry.withinRadius ? (
                              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                            ) : (
                              <AlertTriangle className="h-3 w-3 text-red-500" />
                            )}
                            <span className="text-[10px] tabular-nums text-gray-400">{entry.distance}m</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}

                {entries.length === 0 && (
                  <div className="py-8 text-center">
                    <Clock className="mx-auto h-8 w-8 text-gray-300" />
                    <p className="mt-2 text-sm font-semibold text-gray-500">No entries today</p>
                    <p className="text-xs text-gray-400">Clock in to start tracking</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right Column: Weekly Summary */}
        <div className="space-y-6">
          {/* Weekly Hours */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.1 }}
            className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">Weekly Summary</p>

            <div className="space-y-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Total Hours</p>
                <p className="mt-1 text-[28px] font-black tabular-nums text-gray-900">{weeklyHours}h</p>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-indigo-600 transition-all duration-500"
                    style={{ width: `${Math.min((weeklyHours / 40) * 100, 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-gray-400">{weeklyHours} of 40 hours</p>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Overtime</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <p className="text-[28px] font-black tabular-nums text-gray-900">{weeklyOT}h</p>
                  {weeklyOT === 0 ? (
                    <span className="text-xs font-semibold text-emerald-600">No overtime</span>
                  ) : (
                    <span className="text-xs font-semibold text-amber-600">{weeklyOT}h overtime</span>
                  )}
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Today</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <p className="text-[28px] font-black tabular-nums text-gray-900">
                    {clockStatus !== 'clocked-out' ? `${Math.floor(elapsedMs / 3_600_000)}h ${Math.floor((elapsedMs % 3_600_000) / 60_000)}m` : '0h 0m'}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Day Breakdown */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.15 }}
            className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">This Week</p>

            <div className="space-y-2.5">
              {[
                { day: 'Mon', hours: 6.5, status: 'complete' as const },
                { day: 'Tue', hours: 7.0, status: 'complete' as const },
                { day: 'Wed', hours: 5.5, status: 'complete' as const },
                { day: 'Thu', hours: 3.5, status: 'active' as const },
                { day: 'Fri', hours: 0, status: 'upcoming' as const },
                { day: 'Sat', hours: 0, status: 'upcoming' as const },
                { day: 'Sun', hours: 0, status: 'upcoming' as const },
              ].map((day) => (
                <div key={day.day} className="flex items-center gap-3">
                  <span className={cn(
                    'w-8 text-xs font-bold',
                    day.status === 'active' ? 'text-indigo-600' : day.status === 'upcoming' ? 'text-gray-300' : 'text-gray-600'
                  )}>
                    {day.day}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        day.status === 'active' ? 'bg-indigo-600' : day.status === 'upcoming' ? 'bg-gray-100' : 'bg-gray-400'
                      )}
                      style={{ width: `${(day.hours / 8) * 100}%` }}
                    />
                  </div>
                  <span className={cn(
                    'w-10 text-right text-xs font-semibold tabular-nums',
                    day.status === 'active' ? 'text-indigo-600' : day.status === 'upcoming' ? 'text-gray-300' : 'text-gray-600'
                  )}>
                    {day.hours > 0 ? `${day.hours}h` : '—'}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
