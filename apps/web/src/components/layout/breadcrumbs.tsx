'use client'

/**
 * Breadcrumbs — path-based navigation breadcrumbs (LOW-004).
 *
 * Renders based on the current pathname. For dynamic route segments
 * (e.g. /members/[id]), displays the segment ID as a short label.
 * Entity names can be passed in via the `entityName` prop for richer labels.
 */
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Map of path segments to human-readable labels. */
const SEGMENT_LABELS: Record<string, string> = {
  '': 'Dashboard',
  members: 'Members',
  revenue: 'Revenue',
  schedule: 'Schedule',
  marketing: 'Marketing',
  campaigns: 'Campaigns',
  automations: 'Automations',
  leads: 'Leads',
  content: 'Content',
  corporate: 'Corporate',
  operations: 'Operations',
  analytics: 'Analytics',
  dashboards: 'Dashboards',
  executive: 'Executive',
  segments: 'Segments',
  engagement: 'Engagement',
  settings: 'Settings',
  new: 'New',
  report: 'Report',
}

function isUuid(segment: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)
}

interface BreadcrumbsProps {
  /** Override label for the last dynamic segment (e.g. member name). */
  entityName?: string
  className?: string
}

export function Breadcrumbs({ entityName, className }: BreadcrumbsProps) {
  const pathname = usePathname()

  // Split path and filter empty segments
  const segments = pathname.split('/').filter(Boolean)

  // Build crumbs: always start with Home
  const crumbs: { label: string; href: string }[] = [
    { label: 'Home', href: '/' },
  ]

  let currentPath = ''
  segments.forEach((segment, index) => {
    currentPath += `/${segment}`
    const isLast = index === segments.length - 1

    let label: string
    if (isLast && entityName) {
      label = entityName
    } else if (SEGMENT_LABELS[segment]) {
      label = SEGMENT_LABELS[segment]
    } else if (isUuid(segment)) {
      label = entityName || `${segment.slice(0, 8)}...`
    } else {
      // Capitalize unknown segments
      label = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ')
    }

    crumbs.push({ label, href: currentPath })
  })

  // Don't render breadcrumbs on the dashboard root
  if (crumbs.length <= 1) return null

  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center gap-1.5 text-sm', className)}>
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1
        return (
          <span key={crumb.href} className="flex items-center gap-1.5">
            {index > 0 && (
              <ChevronRight className="h-3.5 w-3.5 text-gray-300 dark:text-gray-600 flex-shrink-0" />
            )}
            {index === 0 ? (
              <Link
                href={crumb.href}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <Home className="h-3.5 w-3.5" />
              </Link>
            ) : isLast ? (
              <span className="text-gray-900 dark:text-gray-100 font-medium truncate max-w-[200px]">
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors truncate max-w-[150px]"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
