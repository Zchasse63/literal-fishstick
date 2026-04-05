'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/contexts/theme-context'
import { NAV_ITEMS } from '@/lib/nav'
import {
  LayoutDashboard,
  Calendar,
  Users,
  DollarSign,
  Megaphone,
  Building2,
  Settings2,
  BarChart3,
  Settings,
  Search,
  Sun,
  Moon,
  LogOut,
} from 'lucide-react'

/** Map icon name strings from NAV_ITEMS to actual Lucide components. */
const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard,
  Calendar,
  Users,
  DollarSign,
  Megaphone,
  Building2,
  Settings2,
  BarChart3,
  Settings,
}

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const { profile } = useAuth()
  const { isDark, toggle: toggleDark } = useTheme()

  // User identity
  const userName = profile?.full_name || 'User'
  const userInitials = userName.split(/\s+/).map((p: string) => p[0]).join('').toUpperCase().slice(0, 2)
  const userRole = profile?.roles?.[0] === 'owner' ? 'Studio Owner' : profile?.roles?.[0] === 'admin' ? 'Admin' : profile?.roles?.[0] || 'Member'

  const getActivePath = () => {
    if (pathname === '/') return '/'
    const segment = pathname.split('/')[1]
    return NAV_ITEMS.find(item => item.path === `/${segment}`)?.path ?? '/'
  }

  const activePath = getActivePath()

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 flex flex-col transition-all duration-300',
        collapsed ? 'w-[72px]' : 'w-[240px]'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-gray-100 dark:border-gray-800">
        <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
          <span className="text-white font-black text-lg">M</span>
        </div>
        {!collapsed && (
          <span className="font-bold text-gray-900 dark:text-gray-100 text-lg">Meridian</span>
        )}
      </div>

      {/* Search */}
      {!collapsed && (
        <div className="px-4 py-3">
          <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-900 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <Search className="w-4 h-4" />
            <span>Search...</span>
            <kbd className="ml-auto text-[10px] font-medium bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded px-1.5 py-0.5">
              ⌘K
            </kbd>
          </button>
        </div>
      )}

      {/* Nav Items */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = activePath === item.path
          const Icon = ICON_MAP[item.icon] ?? LayoutDashboard

          return (
            <Link
              key={item.path}
              href={item.path}
              className={cn(
                'relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors group',
                isActive
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
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
                  <span className="ml-2 text-gray-400 dark:text-gray-500">⌘{item.shortcut}</span>
                </div>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-gray-100 dark:border-gray-800 p-3 space-y-2">
        {/* Dark mode toggle */}
        <button
          onClick={toggleDark}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 w-full transition-colors"
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          {!collapsed && <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>

        {/* User */}
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-indigo-700 text-xs font-bold">{userInitials}</span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{userName}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{userRole}</p>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={async () => {
                const { createBrowserClient } = await import('@/lib/supabase/client')
                const supabase = createBrowserClient()
                await supabase.auth.signOut()
                window.location.href = '/login'
              }}
              aria-label="Sign out"
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
