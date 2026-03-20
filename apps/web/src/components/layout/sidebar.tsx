'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Calendar,
  Users,
  DollarSign,
  Megaphone,
  Building2,
  Briefcase,
  BarChart3,
  Target,
  Trophy,
  Search,
  Sun,
  Moon,
  LogOut,
  Menu,
} from 'lucide-react'

const navItems = [
  { id: 'dashboard', label: 'Command Center', icon: LayoutDashboard, href: '/', shortcut: '1' },
  { id: 'schedule', label: 'Schedule', icon: Calendar, href: '/schedule', shortcut: '2' },
  { id: 'members', label: 'Members', icon: Users, href: '/members', shortcut: '3' },
  { id: 'revenue', label: 'Revenue', icon: DollarSign, href: '/revenue', shortcut: '4' },
  { id: 'marketing', label: 'Marketing', icon: Megaphone, href: '/marketing', shortcut: '5' },
  { id: 'corporate', label: 'Corporate', icon: Briefcase, href: '/corporate', shortcut: '6' },
  { id: 'operations', label: 'Operations', icon: Building2, href: '/operations', shortcut: '7' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, href: '/analytics', shortcut: '8' },
  { id: 'segments', label: 'Segments', icon: Target, href: '/segments', shortcut: '8' },
  { id: 'engagement', label: 'Engagement', icon: Trophy, href: '/engagement', shortcut: '9' },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname()

  const getActiveId = () => {
    if (pathname === '/') return 'dashboard'
    const segment = pathname.split('/')[1]
    return navItems.find(item => item.href === `/${segment}`)?.id ?? 'dashboard'
  }

  const activeId = getActiveId()

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-white border-r border-gray-200 flex flex-col transition-all duration-300',
        collapsed ? 'w-[72px]' : 'w-[240px]'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-gray-100">
        <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
          <span className="text-white font-black text-lg">M</span>
        </div>
        {!collapsed && (
          <span className="font-bold text-gray-900 text-lg">Meridian</span>
        )}
      </div>

      {/* Search */}
      {!collapsed && (
        <div className="px-4 py-3">
          <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-400 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
            <Search className="w-4 h-4" />
            <span>Search...</span>
            <kbd className="ml-auto text-[10px] font-medium bg-white border border-gray-200 rounded px-1.5 py-0.5">
              ⌘K
            </kbd>
          </button>
        </div>
      )}

      {/* Nav Items */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = activeId === item.id
          const Icon = item.icon

          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                'relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors group',
                isActive
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="nav-pill"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-indigo-600 rounded-r-full"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                />
              )}
              <Icon className={cn('w-5 h-5 flex-shrink-0', isActive ? 'text-indigo-600' : '')} />
              {!collapsed && <span>{item.label}</span>}
              {collapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                  {item.label}
                  <span className="ml-2 text-gray-400">⌘{item.shortcut}</span>
                </div>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-gray-100 p-3 space-y-2">
        {/* Dark mode toggle */}
        <button className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-50 w-full transition-colors">
          <Sun className="w-5 h-5" />
          {!collapsed && <span>Light Mode</span>}
        </button>

        {/* User */}
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-indigo-700 text-xs font-bold">ZM</span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">Zach M.</p>
              <p className="text-xs text-gray-500">Studio Owner</p>
            </div>
          )}
          {!collapsed && (
            <button className="text-gray-400 hover:text-gray-600">
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
