'use client'

import { useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Command,
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
  Search,
  User,
  Flame,
  Loader2,
  History,
} from 'lucide-react'
import { NAV_ITEMS } from '@/lib/nav'
import { useCommandPalette } from '@/contexts/command-palette-context'
import { useEntitySearch } from '@/hooks/use-entity-search'
import { useRecentMembers } from '@/hooks/use-recent-members'
import type { SearchResult } from '@/app/api/search/route'

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

const RESULT_ICONS: Record<SearchResult['type'], React.ElementType> = {
  member: User,
  class: Flame,
  transaction: DollarSign,
  campaign: Mail,
  lead: UserPlus,
}

export function CommandPalette() {
  const { open, setOpen, mode, setMode, query, setQuery } = useCommandPalette()
  const router = useRouter()
  const { recents, addRecent } = useRecentMembers()

  // Tier 8.5.A6/A7 — only fetch entities in search mode (or command mode
  // with a non-trivial query that we also want to search live).
  const searchEnabled = open && query.trim().length >= 2
  const { results, loading } = useEntitySearch(query, searchEnabled)

  // Global shortcuts: Cmd+K (palette) and "/" (search mode). Registered
  // once on mount; guards against typing "/" into input fields.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Cmd/Ctrl+K — toggle palette in command mode
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (open) {
          setOpen(false)
        } else {
          setMode('command')
          setOpen(true)
        }
        return
      }
      // "/" — open in search mode (unless typing into an input)
      if (e.key === '/' && !open) {
        const target = document.activeElement as HTMLElement | null
        const isEditable =
          target?.tagName === 'INPUT' ||
          target?.tagName === 'TEXTAREA' ||
          target?.isContentEditable
        if (isEditable) return
        e.preventDefault()
        setMode('search')
        setOpen(true)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, setOpen, setMode])

  const runCommand = useCallback(
    (href: string) => {
      setOpen(false)
      router.push(href)
    },
    [router, setOpen]
  )

  const selectSearchResult = useCallback(
    (result: SearchResult) => {
      if (result.type === 'member') {
        // Track recents for members only (most valuable).
        // The href is `/members?focus=<profile_id>` — extract profile_id.
        const match = result.href.match(/focus=([0-9a-f-]+)/)
        const profileId = match?.[1] ?? ''
        addRecent({
          id: result.id,
          profileId,
          fullName: result.label,
          email: result.sublabel,
        })
      }
      runCommand(result.href)
    },
    [runCommand, addRecent]
  )

  const selectRecent = useCallback(
    (recent: (typeof recents)[number]) => {
      runCommand(`/members?focus=${recent.profileId}`)
    },
    [runCommand]
  )

  const hasQuery = query.trim().length >= 2
  const totalResults =
    results.members.length +
    results.classes.length +
    results.transactions.length +
    results.campaigns.length +
    results.leads.length

  const placeholder =
    mode === 'search'
      ? 'Search members, classes, transactions, campaigns, leads…'
      : 'Type a command or search…'

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title={mode === 'search' ? 'Universal Search' : 'Command Palette'}
      description={
        mode === 'search'
          ? 'Search across members, classes, transactions, campaigns, and leads.'
          : 'Search for pages, actions, and tools across Meridian.'
      }
    >
      <Command
        className="[&_[cmdk-root]]:bg-white dark:[&_[cmdk-root]]:bg-[#1A1A1F]"
        data-testid="palette-root"
        data-palette-mode={mode}
        shouldFilter={mode === 'command'}
      >
        <CommandInput
          placeholder={placeholder}
          value={query}
          onValueChange={setQuery}
          data-testid="palette-input"
        />
        <CommandList>
          <CommandEmpty data-testid="palette-empty-state">
            {loading ? 'Searching…' : 'No results found.'}
          </CommandEmpty>

          {/* ── Recent Members (empty state for both modes) ───────── */}
          {!hasQuery && recents.length > 0 && (
            <>
              <CommandGroup heading="Recent Members" data-testid="palette-recents-group">
                {recents.map((recent) => (
                  <CommandItem
                    key={recent.id}
                    value={`recent-${recent.fullName}`}
                    onSelect={() => selectRecent(recent)}
                    data-testid="palette-recent-item"
                    className="data-selected:bg-indigo-50 dark:data-selected:bg-indigo-950/40"
                  >
                    <History className="size-4 text-gray-400" />
                    <span>{recent.fullName}</span>
                    <span className="ml-auto text-[10px] text-gray-400 dark:text-gray-500">
                      {recent.email}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          {/* ── Live Entity Search Results (both modes) ──────────── */}
          {hasQuery && totalResults > 0 && (
            <>
              {results.members.length > 0 && (
                <CommandGroup
                  heading="Members"
                  data-testid="palette-search-group-members"
                >
                  {results.members.map((r) => (
                    <ResultItem key={r.id} result={r} onSelect={selectSearchResult} />
                  ))}
                  <SeeAllItem
                    type="member"
                    query={query}
                    count={results.members.length}
                    onSelect={runCommand}
                  />
                </CommandGroup>
              )}
              {results.classes.length > 0 && (
                <CommandGroup
                  heading="Classes"
                  data-testid="palette-search-group-classes"
                >
                  {results.classes.map((r) => (
                    <ResultItem key={r.id} result={r} onSelect={selectSearchResult} />
                  ))}
                </CommandGroup>
              )}
              {results.transactions.length > 0 && (
                <CommandGroup
                  heading="Transactions"
                  data-testid="palette-search-group-transactions"
                >
                  {results.transactions.map((r) => (
                    <ResultItem key={r.id} result={r} onSelect={selectSearchResult} />
                  ))}
                </CommandGroup>
              )}
              {results.campaigns.length > 0 && (
                <CommandGroup
                  heading="Campaigns"
                  data-testid="palette-search-group-campaigns"
                >
                  {results.campaigns.map((r) => (
                    <ResultItem key={r.id} result={r} onSelect={selectSearchResult} />
                  ))}
                </CommandGroup>
              )}
              {results.leads.length > 0 && (
                <CommandGroup
                  heading="Leads"
                  data-testid="palette-search-group-leads"
                >
                  {results.leads.map((r) => (
                    <ResultItem key={r.id} result={r} onSelect={selectSearchResult} />
                  ))}
                </CommandGroup>
              )}
              <CommandSeparator />
            </>
          )}

          {/* ── Loading indicator ────────────────────────────────── */}
          {loading && hasQuery && (
            <div
              className="py-3 flex items-center justify-center gap-2 text-xs text-gray-400 dark:text-gray-500"
              data-testid="palette-loading"
            >
              <Loader2 className="size-3 animate-spin" />
              <span>Searching entities…</span>
            </div>
          )}

          {/* ── Command mode: Navigation + Actions + Employee ────── */}
          {mode === 'command' && (
            <>
              <CommandGroup
                heading="Navigation"
                data-testid="palette-navigation-group"
              >
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

              <CommandGroup
                heading="Quick Actions"
                data-testid="palette-actions-group"
              >
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
            </>
          )}

          {/* ── Search mode with no query yet: show hint ─────────── */}
          {mode === 'search' && !hasQuery && recents.length === 0 && (
            <div className="py-6 text-center text-xs text-gray-400 dark:text-gray-500">
              <Search className="size-5 mx-auto mb-1.5 opacity-40" />
              <p>Start typing to search members, classes, transactions…</p>
              <p className="mt-0.5 text-[10px]">Press Esc to close · Cmd+K for commands</p>
            </div>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}

// ─── Sub-components ────────────────────────────────────────────

function ResultItem({
  result,
  onSelect,
}: {
  result: SearchResult
  onSelect: (r: SearchResult) => void
}) {
  const Icon = RESULT_ICONS[result.type]
  return (
    <CommandItem
      value={`${result.type}-${result.id}-${result.label}`}
      onSelect={() => onSelect(result)}
      data-testid="palette-option"
      data-option-id={result.id}
      data-option-type={result.type}
      className="data-selected:bg-indigo-50 dark:data-selected:bg-indigo-950/40"
    >
      <Icon className="size-4 text-[#4F46E5] shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900 dark:text-gray-100 truncate">
          {result.label}
        </p>
        {result.sublabel && (
          <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
            {result.sublabel}
          </p>
        )}
      </div>
    </CommandItem>
  )
}

function SeeAllItem({
  type,
  query,
  count,
  onSelect,
}: {
  type: SearchResult['type']
  query: string
  count: number
  onSelect: (href: string) => void
}) {
  const href = typeToListHref(type, query)
  return (
    <CommandItem
      value={`see-all-${type}`}
      onSelect={() => onSelect(href)}
      data-testid={`palette-see-all-${type}`}
      className="data-selected:bg-indigo-50 dark:data-selected:bg-indigo-950/40"
    >
      <Search className="size-3.5 text-gray-400" />
      <span className="text-xs text-gray-600 dark:text-gray-400 italic">
        See all {count}+ {type}{count === 1 ? '' : 's'} for &quot;{query}&quot;
      </span>
    </CommandItem>
  )
}

function typeToListHref(type: SearchResult['type'], query: string): string {
  const q = encodeURIComponent(query)
  switch (type) {
    case 'member':
      return `/members?search=${q}`
    case 'class':
      return `/schedule?search=${q}`
    case 'transaction':
      return `/revenue?search=${q}`
    case 'campaign':
      return `/marketing?search=${q}`
    case 'lead':
      return `/marketing?leadSearch=${q}`
  }
}
