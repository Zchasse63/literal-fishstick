'use client'

import { cn } from '@/lib/utils'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { useCommandPalette } from '@/contexts/command-palette-context'
import { NotificationDropdown } from '@/components/layout/NotificationDropdown'
import {
  Search,
  Menu,
  Plus,
  Keyboard,
} from 'lucide-react'

interface HeaderProps {
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
}

export function Header({ sidebarCollapsed, onToggleSidebar }: HeaderProps) {
  const { openWithMode } = useCommandPalette()

  return (
    <header
      className={cn(
        'fixed top-0 right-0 z-30 h-16 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-6 transition-all duration-300',
        sidebarCollapsed ? 'left-[72px]' : 'left-[240px]'
      )}
    >
      {/* Left: Hamburger + Breadcrumbs */}
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
          className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden md:block">
          <Breadcrumbs />
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* Search — opens universal search mode */}
        <button
          aria-label="Open search"
          onClick={() => openWithMode('search')}
          data-testid="header-search-btn"
          className="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <Search className="w-4 h-4" />
          <span>Search...</span>
          <kbd className="text-[10px] font-medium bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded px-1.5 py-0.5">/</kbd>
        </button>

        {/* Keyboard shortcuts — opens command mode */}
        <button
          aria-label="Keyboard shortcuts"
          onClick={() => openWithMode('command')}
          data-testid="header-keyboard-btn"
          className="hidden lg:flex text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <Keyboard className="w-5 h-5" />
        </button>

        {/* Live status */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span>Live</span>
          <span className="text-gray-400 dark:text-gray-500">·</span>
          <span className="text-emerald-600">Healthy</span>
        </div>

        {/* Tier 8.5.A8 — Live notification dropdown with unread badge */}
        <NotificationDropdown />

        {/* Quick Create — opens command mode (actions + navigation) */}
        <button
          onClick={() => openWithMode('command')}
          data-testid="header-quick-create-btn"
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 active:scale-95 transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:block">Quick Create</span>
        </button>
      </div>
    </header>
  )
}
