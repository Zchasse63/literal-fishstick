'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { CommandPalette } from '@/components/command-palette'
import { cn } from '@/lib/utils'

/** Keyboard shortcut map: Cmd+{key} -> route */
const shortcutRoutes: Record<string, string> = {
  '1': '/',
  '2': '/schedule',
  '3': '/members',
  '4': '/revenue',
  '5': '/marketing',
  '6': '/corporate',
  '7': '/operations',
  '8': '/analytics',
  '9': '/segments',
  '0': '/engagement',
}

const breadcrumbs: Record<string, string> = {
  '/': 'Command Center',
  '/schedule': 'Schedule > Class Calendar',
  '/members': 'Members > Directory',
  '/revenue': 'Revenue > Dashboard',
  '/marketing': 'Marketing > Overview',
  '/marketing/campaigns': 'Marketing > Campaigns',
  '/marketing/campaigns/new': 'Marketing > Campaigns > New',
  '/marketing/automations': 'Marketing > Automations',
  '/marketing/automations/new': 'Marketing > Automations > New',
  '/marketing/leads': 'Marketing > Lead Pipeline',
  '/marketing/content': 'Marketing > Content Hub',
  '/operations': 'Operations > Employee Management',
  '/analytics': 'Analytics > Overview',
  '/analytics/dashboards': 'Analytics > Dashboards',
  '/analytics/dashboards/executive': 'Analytics > Dashboards > Executive Overview',
  '/analytics/dashboards/operations': 'Analytics > Dashboards > Daily Operations',
  '/analytics/dashboards/growth': 'Analytics > Dashboards > Growth & Retention',
  '/analytics/reports': 'Analytics > Reports',
  '/analytics/reports/new': 'Analytics > Reports > New',
  '/analytics/insights': 'Analytics > AI Insights',
  '/analytics/trainers': 'Analytics > Trainer Performance',
  '/analytics/pricing': 'Analytics > Pricing Simulator',
  '/analytics/migration': 'Analytics > Data Migration',
  '/corporate': 'Corporate > Accounts',
  '/corporate/new': 'Corporate > New Account',
  '/corporate/events': 'Corporate > Events',
  '/segments': 'Members > Segments',
  '/engagement': 'Members > Engagement',
  '/settings': 'Settings > Studio Configuration',
  '/settings/sms': 'Settings > SMS Configuration',
  '/settings/geofence': 'Settings > Geofence',
  '/revenue/products': 'Revenue > Products',
  '/revenue/orders': 'Revenue > Orders',
  '/operations/payroll': 'Operations > Payroll',
  '/operations/documents': 'Operations > Documents',
  '/docs/api': 'Documentation > API',
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  // Wire up Cmd+1 through Cmd+0 keyboard shortcuts for navigation
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
  const getBreadcrumb = (path: string): string => {
    if (breadcrumbs[path]) return breadcrumbs[path]
    // Dynamic routes
    if (/^\/revenue\/products\/[^/]+$/.test(path)) return 'Revenue > Products > Product Details'
    if (/^\/corporate\/events\/[^/]+$/.test(path)) return 'Corporate > Events > Event Details'
    if (/^\/corporate\/[^/]+$/.test(path) && path !== '/corporate/new' && path !== '/corporate/events') return 'Corporate > Accounts > Company Details'
    return 'Meridian'
  }
  const breadcrumb = getBreadcrumb(pathname)

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <CommandPalette />
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <Header
        breadcrumb={breadcrumb}
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
  )
}
