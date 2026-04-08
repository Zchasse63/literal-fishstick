'use client'

import { useEffect, useCallback } from 'react'
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
  Settings2,
  BarChart3,
  Settings,
  Plus,
  UserPlus,
  CreditCard,
  Mail,
  Clock,
  FileText,
  Briefcase,
  Zap,
  Filter,
} from 'lucide-react'
import { NAV_ITEMS } from '@/lib/nav'
import { useCommandPalette } from '@/contexts/command-palette-context'

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

const quickActions = [
  { label: 'New Class', icon: Plus, href: '/schedule?action=new-class', shortcut: 'N' },
  { label: 'Add Member', icon: UserPlus, href: '/members?action=add-member', shortcut: 'M' },
  { label: 'Record Payment', icon: CreditCard, href: '/revenue?action=record-payment' },
  { label: 'New Campaign', icon: Mail, href: '/marketing?action=new-campaign' },
  { label: 'Smart Segments', icon: Filter, href: '/segments' },
  { label: 'Engagement', icon: Zap, href: '/engagement' },
]

const employeePortalItems = [
  { label: 'Clock In / Out', icon: Clock, href: '/employee/clock' },
  { label: 'Payroll', icon: FileText, href: '/operations/payroll' },
  { label: 'Staff Directory', icon: Briefcase, href: '/operations?tab=directory' },
  { label: 'Settings', icon: Settings, href: '/settings' },
]

export function CommandPalette() {
  const { open, setOpen } = useCommandPalette()
  const router = useRouter()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(!open)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, setOpen])

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
            {NAV_ITEMS.map((item) => {
              const Icon = ICON_MAP[item.icon] ?? LayoutDashboard
              return (
                <CommandItem
                  key={item.path}
                  value={item.label}
                  onSelect={() => runCommand(item.path)}
                  className="data-selected:bg-indigo-50 dark:data-selected:bg-indigo-950/40"
                >
                  <Icon className="size-4 text-[#4F46E5]" />
                  <span>{item.label}</span>
                  {item.shortcut && (
                    <CommandShortcut>
                      <kbd className="pointer-events-none inline-flex h-5 items-center rounded border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-1.5 font-mono text-[10px] font-medium text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                        {item.shortcut}
                      </kbd>
                    </CommandShortcut>
                  )}
                </CommandItem>
              )
            })}
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
