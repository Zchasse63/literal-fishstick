'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import {
  LayoutDashboard,
  Calendar,
  Users,
  DollarSign,
  Megaphone,
  Building2,
  BarChart3,
  Target,
  Trophy,
  Plus,
  UserPlus,
  CreditCard,
  Mail,
  Clock,
  FileText,
  Briefcase,
  Settings,
} from 'lucide-react'

const navigationItems = [
  { label: 'Command Center', icon: LayoutDashboard, href: '/', shortcut: '1' },
  { label: 'Schedule', icon: Calendar, href: '/schedule', shortcut: '2' },
  { label: 'Members', icon: Users, href: '/members', shortcut: '3' },
  { label: 'Revenue', icon: DollarSign, href: '/revenue', shortcut: '4' },
  { label: 'Marketing', icon: Megaphone, href: '/marketing', shortcut: '5' },
  { label: 'Operations', icon: Building2, href: '/operations', shortcut: '6' },
  { label: 'Analytics', icon: BarChart3, href: '/analytics', shortcut: '7' },
  { label: 'Segments', icon: Target, href: '/segments', shortcut: '8' },
  { label: 'Engagement', icon: Trophy, href: '/engagement', shortcut: '9' },
]

const quickActions = [
  { label: 'New Class', icon: Plus, href: '/schedule?action=new-class', shortcut: 'N' },
  { label: 'Add Member', icon: UserPlus, href: '/members?action=add-member', shortcut: 'M' },
  { label: 'Record Payment', icon: CreditCard, href: '/revenue?action=record-payment' },
  { label: 'New Campaign', icon: Mail, href: '/marketing?action=new-campaign' },
]

const employeePortalItems = [
  { label: 'Clock In / Out', icon: Clock, href: '/operations/clock' },
  { label: 'Payroll', icon: FileText, href: '/operations/payroll' },
  { label: 'Staff Directory', icon: Briefcase, href: '/operations/staff' },
  { label: 'Settings', icon: Settings, href: '/operations/settings' },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const runCommand = useCallback(
    (href: string) => {
      setOpen(false)
      router.push(href)
    },
    [router]
  )

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command Palette"
      description="Search for pages, actions, and tools across Meridian."
    >
      <div className="[&_[cmdk-root]]:bg-white dark:[&_[cmdk-root]]:bg-[#1A1A1F]">
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          <CommandGroup heading="Navigation">
            {navigationItems.map((item) => (
              <CommandItem
                key={item.href}
                value={item.label}
                onSelect={() => runCommand(item.href)}
                className="data-selected:bg-indigo-50 dark:data-selected:bg-indigo-950/40"
              >
                <item.icon className="size-4 text-[#4F46E5]" />
                <span>{item.label}</span>
                {item.shortcut && (
                  <CommandShortcut>
                    <kbd className="pointer-events-none inline-flex h-5 items-center rounded border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-1.5 font-mono text-[10px] font-medium text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                      {item.shortcut}
                    </kbd>
                  </CommandShortcut>
                )}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Quick Actions">
            {quickActions.map((item) => (
              <CommandItem
                key={item.label}
                value={item.label}
                onSelect={() => runCommand(item.href)}
                className="data-selected:bg-indigo-50 dark:data-selected:bg-indigo-950/40"
              >
                <item.icon className="size-4 text-[#F59E0B]" />
                <span>{item.label}</span>
                {item.shortcut && (
                  <CommandShortcut>
                    <kbd className="pointer-events-none inline-flex h-5 items-center rounded border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-1.5 font-mono text-[10px] font-medium text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                      {item.shortcut}
                    </kbd>
                  </CommandShortcut>
                )}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Employee Portal">
            {employeePortalItems.map((item) => (
              <CommandItem
                key={item.label}
                value={item.label}
                onSelect={() => runCommand(item.href)}
                className="data-selected:bg-indigo-50 dark:data-selected:bg-indigo-950/40"
              >
                <item.icon className="size-4 text-[#10B981]" />
                <span>{item.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </div>
    </CommandDialog>
  )
}
