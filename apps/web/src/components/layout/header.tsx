'use client'

import { cn } from '@/lib/utils'
import {
  Search,
  Menu,
  Bell,
  Plus,
  Keyboard,
} from 'lucide-react'

interface HeaderProps {
  breadcrumb: string
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
}

export function Header({ breadcrumb, sidebarCollapsed, onToggleSidebar }: HeaderProps) {
  return (
    <header
      className={cn(
        'fixed top-0 right-0 z-30 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 transition-all duration-300',
        sidebarCollapsed ? 'left-[72px]' : 'left-[240px]'
      )}
    >
      {/* Left: Hamburger + Breadcrumb */}
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className="text-gray-500 hover:text-gray-700 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        <nav className="hidden md:flex items-center text-sm text-gray-500">
          <span className="font-medium text-gray-900">{breadcrumb}</span>
        </nav>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <button className="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors">
          <Search className="w-4 h-4" />
          <span>Search...</span>
          <kbd className="text-[10px] font-medium bg-white border border-gray-200 rounded px-1.5 py-0.5">⌘K</kbd>
        </button>

        {/* Keyboard shortcuts */}
        <button className="hidden lg:flex text-gray-400 hover:text-gray-600 p-2 rounded-xl hover:bg-gray-50 transition-colors">
          <Keyboard className="w-5 h-5" />
        </button>

        {/* Live status */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-xl">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span>Live</span>
          <span className="text-gray-400">·</span>
          <span className="text-emerald-600">Healthy</span>
        </div>

        {/* Notifications */}
        <button className="relative text-gray-400 hover:text-gray-600 p-2 rounded-xl hover:bg-gray-50 transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-500 rounded-full" />
        </button>

        {/* Quick Create */}
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 active:scale-95 transition-all shadow-sm">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:block">Quick Create</span>
        </button>
      </div>
    </header>
  )
}
