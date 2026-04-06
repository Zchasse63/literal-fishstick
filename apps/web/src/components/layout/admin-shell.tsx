'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { CommandPalette } from '@/components/command-palette'
import { CommandPaletteProvider } from '@/contexts/command-palette-context'
import { NAV_ITEMS } from '@/lib/nav'
import { cn } from '@/lib/utils'

/** Build the shortcutRoutes map from the shared NAV_ITEMS constant. */
const shortcutRoutes: Record<string, string> = Object.fromEntries(
  NAV_ITEMS.map((item) => [item.shortcut, item.path])
)

/**
 * AdminShell — client component that owns all interactive state for the admin layout.
 *
 * Extracted from the admin layout (MED-009) so that layout.tsx can be a React
 * Server Component, enabling streaming SSR for child routes.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const router = useRouter()

  // Wire up Cmd+1 through Cmd+9 keyboard shortcuts for navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      const route = shortcutRoutes[e.key]
      if (route) {
        e.preventDefault()
        router.push(route)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [router])

  return (
    <CommandPaletteProvider>
      <div className="min-h-screen bg-[var(--background)]">
        <CommandPalette />
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        <Header
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        <main
          className={cn(
            'pt-16 min-h-screen transition-all duration-300',
            sidebarCollapsed ? 'pl-[72px]' : 'pl-[240px]'
          )}
        >
          <div className="p-5 md:p-7 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </CommandPaletteProvider>
  )
}
