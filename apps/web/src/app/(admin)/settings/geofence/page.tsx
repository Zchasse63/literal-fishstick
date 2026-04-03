'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { createBrowserClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  Loader2,
  ArrowLeft,
  MapPin,
  Plus,
  Trash2,
  CheckCircle2,
  Info,
  Navigation,
  Clock,
  Shield,
  Smartphone,
  Radio,
} from 'lucide-react'
import { fadeInUp } from '@/lib/motion'

// ─── Types ──────────────────────────────────────────────────
interface GeofenceLocation {
  id: string
  name: string
  latitude: number
  longitude: number
  radius: number
  isActive: boolean
}

const STUDIO_ID = '11111111-1111-1111-1111-111111111111'

// ─── Component ──────────────────────────────────────────────
export default function GeofenceSettingsPage() {
  const [locations, setLocations] = useState<GeofenceLocation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchLocations() {
      const supabase = createBrowserClient()
      const { data } = await supabase
        .from('geofence_locations')
        .select('*')
        .eq('studio_id', STUDIO_ID)

      if (data && data.length > 0) {
        setLocations(data.map((loc: any) => ({
          id: loc.id,
          name: loc.name ?? 'Unnamed Location',
          latitude: loc.latitude ?? 0,
          longitude: loc.longitude ?? 0,
          radius: loc.radius ?? 150,
          isActive: loc.is_active ?? true,
        })))
      }
      setLoading(false)
    }
    fetchLocations()
  }, [])
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newLat, setNewLat] = useState('')
  const [newLng, setNewLng] = useState('')
  const [newRadius, setNewRadius] = useState(150)

  const handleToggle = (id: string) => {
    setLocations(prev =>
      prev.map(loc => loc.id === id ? { ...loc, isActive: !loc.isActive } : loc)
    )
  }

  const handleAddLocation = () => {
    if (!newName || !newLat || !newLng) return
    const newLocation: GeofenceLocation = {
      id: `loc-${Date.now()}`,
      name: newName,
      latitude: parseFloat(newLat),
      longitude: parseFloat(newLng),
      radius: newRadius,
      isActive: true,
    }
    setLocations(prev => [...prev, newLocation])
    setNewName('')
    setNewLat('')
    setNewLng('')
    setNewRadius(150)
    setShowAddForm(false)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <motion.div {...fadeInUp} className="min-h-screen bg-[#FAFAFA] p-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/settings"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Geofence Settings</h1>
          <p className="mt-0.5 text-sm text-gray-500">Configure clock-in/out location verification</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left Column: Locations */}
        <div className="col-span-2 space-y-6">
          {/* Locations List */}
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.05 }}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Locations</p>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Location
              </button>
            </div>

            {locations.map((location) => (
              <div
                key={location.id}
                className="mb-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
                      <MapPin className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900">{location.name}</h3>
                      <div className="mt-1 flex items-center gap-4">
                        <span className="text-xs tabular-nums text-gray-500">
                          {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                        </span>
                        <span className="text-xs text-gray-400">&middot;</span>
                        <span className="text-xs font-semibold text-gray-600">{location.radius}m radius</span>
                      </div>
                    </div>
                  </div>
                  {/* Active Toggle */}
                  <button
                    onClick={() => handleToggle(location.id)}
                    className={cn(
                      'relative h-6 w-11 rounded-full transition-colors duration-200',
                      location.isActive ? 'bg-indigo-600' : 'bg-gray-200'
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200',
                        location.isActive ? 'translate-x-5' : 'translate-x-0'
                      )}
                    />
                  </button>
                </div>

                {/* Radius Visual */}
                <div className="mt-5 flex items-center justify-center">
                  <div className="relative">
                    {/* Outer circle — geofence radius */}
                    <div
                      className="flex items-center justify-center rounded-full border-2 border-dashed border-indigo-300 bg-indigo-50/30"
                      style={{ width: `${Math.min(location.radius, 300)}px`, height: `${Math.min(location.radius, 300)}px` }}
                    >
                      {/* Grid lines for scale */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-full w-px bg-indigo-100" />
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-px w-full bg-indigo-100" />
                      </div>
                      {/* Half radius ring */}
                      <div
                        className="absolute rounded-full border border-indigo-100"
                        style={{
                          width: `${Math.min(location.radius, 300) / 2}px`,
                          height: `${Math.min(location.radius, 300) / 2}px`,
                        }}
                      />
                      {/* Center dot — studio location */}
                      <div className="relative flex flex-col items-center">
                        <div className="h-3 w-3 rounded-full bg-indigo-600 shadow-md ring-4 ring-indigo-200/50" />
                        <span className="mt-1 text-[9px] font-bold text-indigo-600">STUDIO</span>
                      </div>
                    </div>
                    {/* Radius label */}
                    <div className="absolute -right-1 top-1/2 -translate-y-1/2 translate-x-full">
                      <div className="flex items-center gap-1.5">
                        <div className="h-px w-4 bg-indigo-300" />
                        <span className="text-[10px] font-bold text-indigo-600">{location.radius}m</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div className="mt-4 flex items-center justify-center gap-1.5">
                  {location.isActive ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="text-xs font-semibold text-emerald-600">Active — enforcing location verification</span>
                    </>
                  ) : (
                    <>
                      <Shield className="h-3.5 w-3.5 text-gray-400" />
                      <span className="text-xs font-semibold text-gray-500">Disabled — clock actions not restricted by location</span>
                    </>
                  )}
                </div>
              </div>
            ))}

            {/* Add Location Form */}
            {showAddForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="rounded-2xl border border-indigo-200 bg-white p-6 shadow-sm"
              >
                <h3 className="mb-4 text-sm font-bold text-gray-900">Add New Location</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-gray-400">Location Name</label>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="e.g., Downtown Studio"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-gray-400">Latitude</label>
                    <input
                      type="text"
                      value={newLat}
                      onChange={(e) => setNewLat(e.target.value)}
                      placeholder="27.9506"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm tabular-nums text-gray-900 placeholder-gray-400 transition-colors focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-gray-400">Longitude</label>
                    <input
                      type="text"
                      value={newLng}
                      onChange={(e) => setNewLng(e.target.value)}
                      placeholder="-82.4572"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm tabular-nums text-gray-900 placeholder-gray-400 transition-colors focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-gray-400">
                      Radius: {newRadius}m
                    </label>
                    <input
                      type="range"
                      min={50}
                      max={500}
                      step={10}
                      value={newRadius}
                      onChange={(e) => setNewRadius(parseInt(e.target.value))}
                      className="h-2 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-indigo-600"
                    />
                    <div className="mt-1 flex justify-between text-[10px] text-gray-400">
                      <span>50m</span>
                      <span>150m</span>
                      <span>300m</span>
                      <span>500m</span>
                    </div>
                  </div>
                  <div className="col-span-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                    <p className="text-xs text-gray-500">
                      <span className="font-semibold text-gray-600">How to find coordinates:</span>{' '}
                      Open Google Maps, right-click your studio location, and click the coordinates to copy them.
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex justify-end gap-3">
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddLocation}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
                  >
                    Add Location
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>

        {/* Right Column: How It Works */}
        <div>
          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.1 }}
            className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <div className="flex items-center gap-2 mb-4">
              <Info className="h-4 w-4 text-indigo-500" />
              <h3 className="text-sm font-bold text-gray-900">How Geofencing Works</h3>
            </div>

            <div className="space-y-4">
              {[
                {
                  icon: Smartphone,
                  step: '1',
                  title: 'Employee opens portal',
                  description: 'On their phone or tablet, the employee navigates to the clock-in page.',
                },
                {
                  icon: Navigation,
                  step: '2',
                  title: 'Location permission',
                  description: 'The browser requests location access. The employee must grant permission to clock in.',
                },
                {
                  icon: Radio,
                  step: '3',
                  title: 'Distance check',
                  description: 'The system calculates the distance between the employee and the studio using GPS coordinates.',
                },
                {
                  icon: CheckCircle2,
                  step: '4',
                  title: 'Verification',
                  description: 'If within the configured radius, the clock action is allowed. Otherwise, it is blocked with a distance warning.',
                },
                {
                  icon: Clock,
                  step: '5',
                  title: 'Audit trail',
                  description: 'Every clock action records the GPS coordinates and distance for payroll verification.',
                },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50">
                    <item.icon className="h-3.5 w-3.5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-900">{item.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
              <p className="text-xs font-semibold text-amber-700">Privacy Note</p>
              <p className="mt-0.5 text-xs text-amber-600">
                Location data is only collected at clock-in/out events. Continuous tracking is never enabled.
                Employees can review their own location data in their portal.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  )
}
