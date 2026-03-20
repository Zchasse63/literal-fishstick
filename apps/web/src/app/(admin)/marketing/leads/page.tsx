'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  DndContext,
  closestCorners,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Plus,
  Code2,
  Filter,
  Search,
  Globe,
  Instagram,
  Users,
  Megaphone,
  UserPlus,
  X,
  GripVertical,
  Mail,
  Trash2,
  Tag,
  ChevronDown,
  ArrowLeft,
} from 'lucide-react'
import Link from 'next/link'

// ─── Animation ──────────────────────────────────────────────
const fadeInUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] as const },
}

// ─── Types ──────────────────────────────────────────────────
type LeadStatus = 'new' | 'contacted' | 'trial' | 'converted' | 'lost'
type LeadSource = 'website' | 'instagram' | 'referral' | 'walk_in' | 'campaign'

interface Lead {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  source: LeadSource
  score: number
  status: LeadStatus
  assignedTo?: { name: string; initials: string }
  lastActivity: string
  tags: string[]
}

interface Column {
  id: LeadStatus
  label: string
  color: string
  borderColor: string
}

// ─── Columns ────────────────────────────────────────────────
const COLUMNS: Column[] = [
  { id: 'new', label: 'New', color: 'bg-blue-500', borderColor: 'border-t-blue-500' },
  { id: 'contacted', label: 'Contacted', color: 'bg-amber-500', borderColor: 'border-t-amber-500' },
  { id: 'trial', label: 'Trial', color: 'bg-indigo-500', borderColor: 'border-t-indigo-500' },
  { id: 'converted', label: 'Converted', color: 'bg-emerald-500', borderColor: 'border-t-emerald-500' },
  { id: 'lost', label: 'Lost', color: 'bg-gray-400', borderColor: 'border-t-gray-400' },
]

// ─── Mock Data ──────────────────────────────────────────────
const INITIAL_LEADS: Lead[] = [
  { id: 'l1', firstName: 'Sarah', lastName: 'Mitchell', email: 'sarah.m@gmail.com', phone: '(813) 555-0142', source: 'website', score: 85, status: 'new', lastActivity: '2 min ago', tags: ['hot'], assignedTo: { name: 'Zach', initials: 'ZR' } },
  { id: 'l2', firstName: 'James', lastName: 'Rodriguez', email: 'jrod@outlook.com', source: 'instagram', score: 72, status: 'new', lastActivity: '15 min ago', tags: ['fitness'], assignedTo: { name: 'Whitney', initials: 'WC' } },
  { id: 'l3', firstName: 'Emily', lastName: 'Chen', email: 'echen@gmail.com', phone: '(813) 555-0199', source: 'referral', score: 91, status: 'new', lastActivity: '1h ago', tags: ['hot', 'referral'] },
  { id: 'l4', firstName: 'Marcus', lastName: 'Thompson', email: 'marcus.t@yahoo.com', source: 'campaign', score: 56, status: 'contacted', lastActivity: '3h ago', tags: [], assignedTo: { name: 'Zach', initials: 'ZR' } },
  { id: 'l5', firstName: 'Olivia', lastName: 'Park', email: 'olivia.park@gmail.com', source: 'website', score: 63, status: 'contacted', lastActivity: '5h ago', tags: ['corporate'], assignedTo: { name: 'Whitney', initials: 'WC' } },
  { id: 'l6', firstName: 'Daniel', lastName: 'Kim', email: 'dkim@proton.me', phone: '(813) 555-0221', source: 'walk_in', score: 78, status: 'contacted', lastActivity: '1d ago', tags: ['walk-in'] },
  { id: 'l7', firstName: 'Rachel', lastName: 'Foster', email: 'rachel.f@gmail.com', source: 'instagram', score: 44, status: 'trial', lastActivity: '2d ago', tags: [], assignedTo: { name: 'Zach', initials: 'ZR' } },
  { id: 'l8', firstName: 'Tyler', lastName: 'Washington', email: 'twash@gmail.com', phone: '(813) 555-0387', source: 'referral', score: 82, status: 'trial', lastActivity: '6h ago', tags: ['hot'] },
  { id: 'l9', firstName: 'Aisha', lastName: 'Patel', email: 'aisha.p@outlook.com', source: 'campaign', score: 35, status: 'trial', lastActivity: '3d ago', tags: [] },
  { id: 'l10', firstName: 'Connor', lastName: 'Murphy', email: 'cmurphy@gmail.com', phone: '(813) 555-0456', source: 'website', score: 95, status: 'converted', lastActivity: '1d ago', tags: ['unlimited'], assignedTo: { name: 'Whitney', initials: 'WC' } },
  { id: 'l11', firstName: 'Priya', lastName: 'Sharma', email: 'priya.s@gmail.com', source: 'referral', score: 88, status: 'converted', lastActivity: '4d ago', tags: ['10-class'] },
  { id: 'l12', firstName: 'Lucas', lastName: 'Brown', email: 'lbrown@yahoo.com', source: 'instagram', score: 76, status: 'converted', lastActivity: '1w ago', tags: ['drop-in'] },
  { id: 'l13', firstName: 'Megan', lastName: 'Davis', email: 'meg.d@gmail.com', source: 'walk_in', score: 22, status: 'lost', lastActivity: '2w ago', tags: ['price-sensitive'] },
  { id: 'l14', firstName: 'Brian', lastName: 'Wilson', email: 'bwilson@hotmail.com', source: 'campaign', score: 18, status: 'lost', lastActivity: '3w ago', tags: [] },
  { id: 'l15', firstName: 'Sophia', lastName: 'Lee', email: 'sophia.lee@gmail.com', source: 'website', score: 31, status: 'lost', lastActivity: '1w ago', tags: ['relocated'] },
]

const SOURCE_ICONS: Record<LeadSource, typeof Globe> = {
  website: Globe,
  instagram: Instagram,
  referral: Users,
  walk_in: UserPlus,
  campaign: Megaphone,
}

const SOURCE_LABELS: Record<LeadSource, string> = {
  website: 'Website',
  instagram: 'Instagram',
  referral: 'Referral',
  walk_in: 'Walk-in',
  campaign: 'Campaign',
}

// ─── Sortable Lead Card ─────────────────────────────────────
function SortableLeadCard({
  lead,
  isSelected,
  onToggleSelect,
}: {
  lead: Lead
  isSelected: boolean
  onToggleSelect: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    data: { lead },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const SourceIcon = SOURCE_ICONS[lead.source]
  const scoreColor = lead.score >= 70 ? 'bg-emerald-100 text-emerald-700' : lead.score >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative rounded-xl border bg-white p-3 shadow-sm transition-all',
        isDragging ? 'z-50 opacity-50 shadow-lg' : 'hover:shadow-md',
        isSelected ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-gray-200'
      )}
    >
      <div className="flex items-start gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleSelect(lead.id)
          }}
          className={cn(
            'mt-0.5 h-4 w-4 shrink-0 rounded border transition-all',
            isSelected ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300 hover:border-gray-400'
          )}
        >
          {isSelected && (
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <Link
              href={`/marketing/leads/${lead.id}`}
              className="truncate text-sm font-semibold text-gray-900 hover:text-indigo-600 transition-colors"
            >
              {lead.firstName} {lead.lastName}
            </Link>
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <GripVertical className="h-4 w-4 text-gray-400" />
            </div>
          </div>

          <p className="truncate text-xs text-gray-500 mt-0.5">{lead.email}</p>

          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
              <SourceIcon className="h-3 w-3" />
              {SOURCE_LABELS[lead.source]}
            </span>
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums', scoreColor)}>
              {lead.score}
            </span>
          </div>

          <div className="mt-2 flex items-center justify-between">
            <span className="text-[10px] text-gray-400">{lead.lastActivity}</span>
            {lead.assignedTo && (
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[9px] font-bold text-indigo-700">
                {lead.assignedTo.initials}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Droppable Column ───────────────────────────────────────
function KanbanColumn({
  column,
  leads,
  selectedIds,
  onToggleSelect,
}: {
  column: Column
  leads: Lead[]
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
}) {
  return (
    <div className="flex w-72 shrink-0 flex-col lg:w-auto lg:flex-1">
      <div className={cn('mb-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm border-t-4', column.borderColor)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">{column.label}</span>
            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-gray-100 px-1.5 text-[10px] font-bold text-gray-600">
              {leads.length}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto rounded-xl bg-gray-50/50 p-2" style={{ minHeight: 200 }}>
        <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          {leads.map((lead) => (
            <SortableLeadCard
              key={lead.id}
              lead={lead}
              isSelected={selectedIds.has(lead.id)}
              onToggleSelect={onToggleSelect}
            />
          ))}
        </SortableContext>
        {leads.length === 0 && (
          <div className="flex flex-1 items-center justify-center py-8">
            <p className="text-xs text-gray-400">No leads</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Drag Overlay Card ──────────────────────────────────────
function DragOverlayCard({ lead }: { lead: Lead }) {
  const SourceIcon = SOURCE_ICONS[lead.source]
  const scoreColor = lead.score >= 70 ? 'bg-emerald-100 text-emerald-700' : lead.score >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'

  return (
    <div className="w-72 rounded-xl border border-indigo-200 bg-white p-3 shadow-xl ring-2 ring-indigo-100 lg:w-56">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900">
            {lead.firstName} {lead.lastName}
          </p>
          <p className="truncate text-xs text-gray-500 mt-0.5">{lead.email}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
              <SourceIcon className="h-3 w-3" />
              {SOURCE_LABELS[lead.source]}
            </span>
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums', scoreColor)}>
              {lead.score}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Quick Add Modal ────────────────────────────────────────
function QuickAddModal({ onClose, onAdd }: { onClose: () => void; onAdd: (lead: Omit<Lead, 'id' | 'score' | 'lastActivity' | 'tags'>) => void }) {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    source: 'website' as LeadSource,
  })

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-gray-900">Add New Lead</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100 transition-colors">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">First Name</label>
              <input
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                placeholder="Sarah"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Last Name</label>
              <input
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                placeholder="Mitchell"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              placeholder="sarah@example.com"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              placeholder="(813) 555-0100"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Source</label>
            <div className="relative mt-1">
              <select
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value as LeadSource })}
                className="w-full appearance-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                <option value="website">Website</option>
                <option value="instagram">Instagram</option>
                <option value="referral">Referral</option>
                <option value="walk_in">Walk-in</option>
                <option value="campaign">Campaign</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => {
              if (form.firstName && form.email) {
                onAdd({
                  firstName: form.firstName,
                  lastName: form.lastName,
                  email: form.email,
                  phone: form.phone || undefined,
                  source: form.source,
                  status: 'new',
                })
                onClose()
              }
            }}
            className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors shadow-sm"
          >
            Add Lead
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Main Page ──────────────────────────────────────────────
export default function LeadPipelinePage() {
  const [leads, setLeads] = useState<Lead[]>(INITIAL_LEADS)
  const [activeLead, setActiveLead] = useState<Lead | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showAddModal, setShowAddModal] = useState(false)
  const [sourceFilter, setSourceFilter] = useState<LeadSource | 'all'>('all')
  const [assignedFilter, setAssignedFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const filteredLeads = leads.filter((lead) => {
    if (sourceFilter !== 'all' && lead.source !== sourceFilter) return false
    if (assignedFilter !== 'all') {
      if (assignedFilter === 'unassigned' && lead.assignedTo) return false
      if (assignedFilter !== 'unassigned' && lead.assignedTo?.name !== assignedFilter) return false
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return (
        lead.firstName.toLowerCase().includes(q) ||
        lead.lastName.toLowerCase().includes(q) ||
        lead.email.toLowerCase().includes(q)
      )
    }
    return true
  })

  const getColumnLeads = useCallback(
    (status: LeadStatus) => filteredLeads.filter((l) => l.status === status),
    [filteredLeads]
  )

  const handleDragStart = (event: DragStartEvent) => {
    const lead = leads.find((l) => l.id === event.active.id)
    if (lead) setActiveLead(lead)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveLead(null)
    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    // Determine target column
    let targetStatus: LeadStatus | null = null

    // Check if dropped over a column
    const col = COLUMNS.find((c) => c.id === overId)
    if (col) {
      targetStatus = col.id
    } else {
      // Dropped over another card — find that card's status
      const overLead = leads.find((l) => l.id === overId)
      if (overLead) targetStatus = overLead.status
    }

    if (targetStatus) {
      setLeads((prev) =>
        prev.map((l) => (l.id === activeId ? { ...l, status: targetStatus } : l))
      )
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleAddLead = (data: Omit<Lead, 'id' | 'score' | 'lastActivity' | 'tags'>) => {
    const newLead: Lead = {
      ...data,
      id: `l${Date.now()}`,
      score: Math.floor(Math.random() * 40) + 30,
      lastActivity: 'Just now',
      tags: [],
    }
    setLeads((prev) => [newLead, ...prev])
  }

  const handleBulkDelete = () => {
    setLeads((prev) => prev.filter((l) => !selectedIds.has(l.id)))
    setSelectedIds(new Set())
  }

  const handleBulkStatusChange = (status: LeadStatus) => {
    setLeads((prev) => prev.map((l) => (selectedIds.has(l.id) ? { ...l, status } : l)))
    setSelectedIds(new Set())
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <div className="mx-auto max-w-[1440px] px-6 py-8">
        {/* Header */}
        <motion.div {...fadeInUp} className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-black text-gray-900">Lead Pipeline</h1>
            <p className="mt-1 text-sm text-gray-500">
              {leads.length} leads &middot; {leads.filter((l) => l.status === 'converted').length} converted this month
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors">
              <Code2 className="h-4 w-4" />
              Embed Form
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Lead
            </button>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div {...fadeInUp} transition={{ ...fadeInUp.transition, delay: 0.05 }} className="mb-6 flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search leads..."
              className="w-56 rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div className="relative">
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as LeadSource | 'all')}
              className="appearance-none rounded-xl border border-gray-200 bg-white px-4 py-2 pr-8 text-sm text-gray-700 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            >
              <option value="all">All Sources</option>
              <option value="website">Website</option>
              <option value="instagram">Instagram</option>
              <option value="referral">Referral</option>
              <option value="walk_in">Walk-in</option>
              <option value="campaign">Campaign</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>

          <div className="relative">
            <select
              value={assignedFilter}
              onChange={(e) => setAssignedFilter(e.target.value)}
              className="appearance-none rounded-xl border border-gray-200 bg-white px-4 py-2 pr-8 text-sm text-gray-700 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            >
              <option value="all">All Assigned</option>
              <option value="Zach">Zach</option>
              <option value="Whitney">Whitney</option>
              <option value="unassigned">Unassigned</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 shadow-sm">
            <Filter className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-500">Score: 0 &ndash; 100</span>
          </div>
        </motion.div>

        {/* Kanban Board */}
        <motion.div {...fadeInUp} transition={{ ...fadeInUp.transition, delay: 0.1 }}>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-4 overflow-x-auto pb-4 lg:overflow-x-visible">
              {COLUMNS.map((col) => (
                <KanbanColumn
                  key={col.id}
                  column={col}
                  leads={getColumnLeads(col.id)}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelect}
                />
              ))}
            </div>

            <DragOverlay>
              {activeLead && <DragOverlayCard lead={activeLead} />}
            </DragOverlay>
          </DndContext>
        </motion.div>

        {/* Bulk Actions Bar */}
        <AnimatePresence>
          {selectedIds.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-gray-200 bg-white px-6 py-3 shadow-xl"
            >
              <span className="text-sm font-semibold text-gray-900">{selectedIds.size} selected</span>
              <div className="h-5 w-px bg-gray-200" />
              <button
                onClick={() => handleBulkStatusChange('contacted')}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Assign
              </button>
              <button className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors">
                <Tag className="h-3.5 w-3.5" />
                Tag
              </button>
              <button className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors">
                <Mail className="h-3.5 w-3.5" />
                Email
              </button>
              <button
                onClick={handleBulkDelete}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="rounded-lg p-1.5 hover:bg-gray-100 transition-colors"
              >
                <X className="h-4 w-4 text-gray-400" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick Add Modal */}
        <AnimatePresence>
          {showAddModal && <QuickAddModal onClose={() => setShowAddModal(false)} onAdd={handleAddLead} />}
        </AnimatePresence>
      </div>
    </div>
  )
}