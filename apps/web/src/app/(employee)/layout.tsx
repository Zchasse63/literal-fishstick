'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Home,
  Calendar,
  Clock,
  DollarSign,
  User,
  Dumbbell,
  BarChart3,
  Tag,
  ArrowLeftRight,
  Sun,
  Moon,
  Bell,
  ChevronLeft,
  ChevronRight,
  Circle,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/contexts/theme-context'
import { useEmployeeProfile, useClockAction } from '@/hooks/use-employee'

const mainNav = [
  { label: 'Home', href: '/employee', icon: Home },
  { label: 'My Schedule', href: '/employee/schedule', icon: Calendar },
  { label: 'Timesheets', href: '/employee/timesheets', icon: Clock },
  { label: 'Pay & Taxes', href: '/employee/pay', icon: DollarSign },
  { label: 'My Profile', href: '/employee/profile', icon: User },
]

const trainerNav = [
  { label: 'My Classes', href: '/employee/classes', icon: Dumbbell },
  { label: 'Performance', href: '/employee/performance', icon: BarChart3 },
  { label: 'Promo Code', href: '/employee/promo', icon: Tag },
]

export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const { isDark, toggle: toggleDark } = useTheme()

  // Auth + employee data
  const { profile } = useAuth()
  const { employee, fullName, loading: empLoading } = useEmployeeProfile()
  const { isClockedIn, loading: clockLoading, clockIn, clockOut } = useClockAction(employee?.id)

  // Clock toggle handler
  const [clockBusy, setClockBusy] = useState(false)
  const handleClockToggle = async () => {
    if (clockBusy || clockLoading) return
    setClockBusy(true)
    try {
      if (isClockedIn) {
        await clockOut()
      } else {
        await clockIn()
      }
    } catch (err) {
      console.error('Clock toggle failed:', err)
    } finally {
      setClockBusy(false)
    }
  }

  // User identity
  const displayName = fullName || 'Employee'
  const displayInitials = displayName.split(/\s+/).map((p: string) => p[0]).join('').toUpperCase().slice(0, 2)
  const displayRole = profile?.roles?.includes('trainer') ? 'Trainer' : 'Employee'

  const isActive = (href: string) => {
    if (href === '/employee') return pathname === '/employee'
    return pathname.startsWith(href)
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0F0F11]">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 h-full bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 z-50 flex flex-col transition-all duration-300',
          collapsed ? 'w-16' : 'w-[220px]'
        )}
      >
        {/* Logo */}
        <div className={cn('flex items-center gap-2.5 px-4 h-16 border-b border-gray-100 dark:border-gray-800', collapsed && 'justify-center px-0')}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-500 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-black text-sm">M</span>
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight">Meridian</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Employee Portal</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {mainNav.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                  active ? 'text-indigo-600' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800',
                  collapsed && 'justify-center px-0'
                )}
              >
                {active && (
                  <motion.div
                    layoutId="employee-nav-pill"
                    className="absolute inset-0 bg-indigo-50 rounded-xl"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <item.icon className={cn('w-[18px] h-[18px] relative z-10 flex-shrink-0', active && 'text-indigo-600')} />
                {!collapsed && <span className="relative z-10 truncate">{item.label}</span>}
              </Link>
            )
          })}

          {/* Trainer Section */}
          <div className="pt-4 pb-1">
            {!collapsed && (
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 px-3">
                Trainer
              </span>
            )}
            {collapsed && <div className="w-6 h-px bg-gray-200 mx-auto" />}
          </div>
          {trainerNav.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                  active ? 'text-indigo-600' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800',
                  collapsed && 'justify-center px-0'
                )}
              >
                {active && (
                  <motion.div
                    layoutId="employee-trainer-nav-pill"
                    className="absolute inset-0 bg-indigo-50 rounded-xl"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <item.icon className={cn('w-[18px] h-[18px] relative z-10 flex-shrink-0', active && 'text-indigo-600')} />
                {!collapsed && <span className="relative z-10 truncate">{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Bottom */}
        <div className="border-t border-gray-100 dark:border-gray-800 p-2 space-y-1">
          <Link
            href="/"
            className={cn(
              'flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors',
              collapsed && 'justify-center px-0'
            )}
          >
            <ArrowLeftRight className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Switch to Admin</span>}
          </Link>
          <button
            onClick={toggleDark}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 w-full transition-colors',
              collapsed && 'justify-center px-0'
            )}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {!collapsed && <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>
          <div className={cn('flex items-center gap-2.5 px-3 py-2', collapsed && 'justify-center px-0')}>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">{displayInitials}</span>
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{displayName}</p>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-700 text-[10px] font-bold uppercase tracking-wider">
                  {displayRole}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Collapse Toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute -right-3 top-20 w-6 h-6 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-full flex items-center justify-center shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 z-50"
        >
          {collapsed ? <ChevronRight className="w-3 h-3 text-gray-400 dark:text-gray-500" /> : <ChevronLeft className="w-3 h-3 text-gray-400 dark:text-gray-500" />}
        </button>
      </aside>

      {/* Top Header */}
      <header
        className={cn(
          'fixed top-0 right-0 h-16 bg-white dark:bg-gray-950/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800 z-40 flex items-center justify-between px-6 transition-all duration-300',
          collapsed ? 'left-16' : 'left-[220px]'
        )}
      >
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Employee Portal</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleClockToggle}
            disabled={clockBusy || clockLoading}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors',
              isClockedIn
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-800',
              (clockBusy || clockLoading) && 'opacity-60 cursor-not-allowed'
            )}
          >
            {clockBusy ? (
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
            ) : (
              <Circle className={cn('w-2 h-2 fill-current', isClockedIn ? 'text-emerald-500' : 'text-gray-400 dark:text-gray-500')} />
            )}
            {isClockedIn ? 'Clocked In' : 'Clocked Out'}
          </button>
          <button aria-label="Notifications" className="relative p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <Bell className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main
        className={cn(
          'pt-16 min-h-screen transition-all duration-300',
          collapsed ? 'pl-16' : 'pl-[220px]'
        )}
      >
        <div className="p-5 md:p-7 max-w-5xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
