/**
 * Shared navigation constants — single source of truth for sidebar, command
 * palette, and keyboard-shortcut routing in AdminShell.
 *
 * Segments and Engagement are intentionally omitted from top-level nav since
 * they belong under Members (per breadcrumbs). Settings is included.
 */

export const NAV_ITEMS = [
  { label: 'Command Center', path: '/', icon: 'LayoutDashboard', shortcut: '1' },
  { label: 'Schedule', path: '/schedule', icon: 'Calendar', shortcut: '2' },
  { label: 'Members', path: '/members', icon: 'Users', shortcut: '3' },
  { label: 'Revenue', path: '/revenue', icon: 'DollarSign', shortcut: '4' },
  { label: 'Marketing', path: '/marketing', icon: 'Megaphone', shortcut: '5' },
  { label: 'Corporate', path: '/corporate', icon: 'Building2', shortcut: '6' },
  { label: 'Operations', path: '/operations', icon: 'Settings2', shortcut: '7' },
  { label: 'Analytics', path: '/analytics', icon: 'BarChart3', shortcut: '8' },
  { label: 'Settings', path: '/settings', icon: 'Settings', shortcut: '9' },
] as const

export type NavItem = (typeof NAV_ITEMS)[number]
