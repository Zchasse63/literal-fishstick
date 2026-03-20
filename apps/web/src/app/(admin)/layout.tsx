'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { CommandPalette } from '@/components/command-palette'
import { cn } from '@/lib/utils'

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
  '/segments': 'Members > Segments',
  '/engagement': 'Members > Engagement',
  '/settings': 'Settings > Studio Configuration',
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const pathname = usePathname()
  const breadcrumb = breadcrumbs[pathname] ?? 'Meridian'

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
