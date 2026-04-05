'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import {
  TrendingUp,
  CalendarCheck,
  Users,
  ChevronRight,
} from 'lucide-react'
import { fadeInUp } from '@/lib/motion'

const DASHBOARDS = [
  {
    title: 'Executive Overview',
    description: 'High-level KPIs, revenue trends, cohort retention, and top AI insights for leadership review.',
    icon: TrendingUp,
    href: '/analytics/dashboards/executive',
    color: 'bg-indigo-50 text-indigo-600',
    borderColor: 'hover:border-indigo-200',
  },
  {
    title: 'Daily Operations',
    description: 'Today\'s bookings, check-ins, walk-ins, no-shows, attendance heatmap, and real-time activity feed.',
    icon: CalendarCheck,
    href: '/analytics/dashboards/operations',
    color: 'bg-emerald-50 text-emerald-600',
    borderColor: 'hover:border-emerald-200',
  },
  {
    title: 'Growth & Retention',
    description: 'Member movement trends, cohort comparisons, at-risk members, lead funnel, and trainer performance.',
    icon: Users,
    href: '/analytics/dashboards/growth',
    color: 'bg-violet-50 text-violet-600',
    borderColor: 'hover:border-violet-200',
  },
]

export function DashboardsClient() {
  return (
    <div className="space-y-6">
      <div className="space-y-6">
        {/* --- Header --- */}
        <motion.div {...fadeInUp}>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboards</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Pre-built dashboards for different roles and use cases
          </p>
        </motion.div>

        {/* --- Dashboard Cards --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {DASHBOARDS.map((dashboard, i) => {
            const Icon = dashboard.icon
            return (
              <motion.div
                key={dashboard.title}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + i * 0.05, duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
              >
                <Link
                  href={dashboard.href}
                  className={cn(
                    'block bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 transition-all hover:shadow-md group',
                    dashboard.borderColor
                  )}
                >
                  <div
                    className={cn(
                      'w-12 h-12 rounded-2xl flex items-center justify-center mb-4',
                      dashboard.color
                    )}
                  >
                    <Icon className="w-6 h-6" />
                  </div>

                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">{dashboard.title}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-4">{dashboard.description}</p>

                  <div className="flex items-center gap-1 text-sm font-semibold text-indigo-600 group-hover:text-indigo-700 transition-colors">
                    View Dashboard
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </Link>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
