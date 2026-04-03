'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { createBrowserClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import {
  Briefcase,
  DollarSign,
  CreditCard,
  AlertTriangle,
  Plus,
  ArrowUpRight,
  ArrowRight,
  Calendar,
  Users,
  ChevronRight,
  Building2,
} from 'lucide-react'

// ─── Animation ──────────────────────────────────────────────
const fadeInUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] as const },
}

// ─── Types ──────────────────────────────────────────────────
type PipelineStage = 'prospect' | 'active' | 'paused' | 'churned'
type EventStatus = 'confirmed' | 'deposit_paid' | 'inquiry' | 'quoted' | 'completed'
type InvoiceStatus = 'paid' | 'sent' | 'overdue' | 'draft'
type EventType = 'corporate' | 'private_party' | 'team_building' | 'birthday' | 'workshop'

interface Company {
  id: string
  name: string
  contact: string
  contractValue: number
  creditsRemaining: number
  creditsTotal: number
  stage: PipelineStage
}

interface UpcomingEvent {
  id: string
  date: string
  company: string
  eventType: EventType
  guests: number
  status: EventStatus
}

interface Invoice {
  id: string
  number: string
  company: string
  amount: number
  status: InvoiceStatus
  dueDate: string
}

const STUDIO_ID = '11111111-1111-1111-1111-111111111111'

// ─── Helpers ────────────────────────────────────────────────
const stageConfig: Record<PipelineStage, { label: string; className: string }> = {
  prospect: { label: 'Prospect', className: 'bg-blue-50 text-blue-700 border border-blue-200' },
  active: { label: 'Active', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  paused: { label: 'Paused', className: 'bg-amber-50 text-amber-700 border border-amber-200' },
  churned: { label: 'Churned', className: 'bg-gray-100 text-gray-600' },
}

const eventStatusConfig: Record<EventStatus, { label: string; className: string }> = {
  inquiry: { label: 'Inquiry', className: 'bg-blue-50 text-blue-700 border border-blue-200' },
  quoted: { label: 'Quoted', className: 'bg-amber-50 text-amber-700 border border-amber-200' },
  confirmed: { label: 'Confirmed', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  deposit_paid: { label: 'Deposit Paid', className: 'bg-indigo-50 text-indigo-700 border border-indigo-200' },
  completed: { label: 'Completed', className: 'bg-gray-100 text-gray-600' },
}

const eventTypeConfig: Record<EventType, { label: string; className: string }> = {
  corporate: { label: 'Corporate', className: 'bg-indigo-50 text-indigo-700' },
  private_party: { label: 'Private Party', className: 'bg-violet-50 text-violet-700' },
  team_building: { label: 'Team Building', className: 'bg-emerald-50 text-emerald-700' },
  birthday: { label: 'Birthday', className: 'bg-pink-50 text-pink-700' },
  workshop: { label: 'Workshop', className: 'bg-amber-50 text-amber-700' },
}

const invoiceStatusConfig: Record<InvoiceStatus, { label: string; className: string }> = {
  paid: { label: 'Paid', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  sent: { label: 'Sent', className: 'bg-blue-50 text-blue-700 border border-blue-200' },
  overdue: { label: 'Overdue', className: 'bg-red-50 text-red-700 border border-red-200' },
  draft: { label: 'Draft', className: 'border border-gray-300 text-gray-500 bg-white' },
}

// ─── Components ─────────────────────────────────────────────
interface DashboardMetrics {
  companies_by_status: Record<string, number>
  total_companies: number
  total_contract_value: number
  credits: { monthly_allocated: number; remaining: number; used: number }
  upcoming_events_count: number
  overdue_invoices: { count: number; total_outstanding: number }
}

function MetricCard({
  label,
  value,
  subtitle,
  icon: Icon,
  delay = 0,
  subtitleColor,
}: {
  label: string
  value: string
  subtitle: string
  icon: typeof Briefcase
  delay?: number
  subtitleColor?: string
}) {
  return (
    <motion.div
      {...fadeInUp}
      transition={{ ...fadeInUp.transition, delay }}
      className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
        <div className="h-8 w-8 rounded-xl bg-indigo-50 flex items-center justify-center">
          <Icon className="h-4 w-4 text-indigo-600" />
        </div>
      </div>
      <div className="flex items-end justify-between">
        <p className="text-[28px] font-black text-gray-900 tabular-nums leading-none">{value}</p>
        <span className={cn('text-xs font-semibold', subtitleColor || 'text-gray-400')}>
          {subtitle}
        </span>
      </div>
    </motion.div>
  )
}

function MetricSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col gap-3 animate-pulse">
      <div className="h-3 w-24 bg-gray-100 rounded" />
      <div className="h-8 w-16 bg-gray-100 rounded" />
    </div>
  )
}

function PipelineColumn({ stage, companies }: { stage: PipelineStage; companies: Company[] }) {
  const config = stageConfig[stage]
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', config.className)}>
            {config.label}
          </span>
          <span className="text-xs font-semibold text-gray-400 tabular-nums">{companies.length}</span>
        </div>
      </div>
      <div className="space-y-2">
        {companies.map((company) => (
          <Link
            key={company.id}
            href={`/corporate/${company.id}`}
            className="block bg-gray-50 rounded-xl p-3.5 hover:bg-gray-100/80 transition-colors group"
          >
            <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-indigo-600 transition-colors">
              {company.name}
            </p>
            <p className="text-xs text-gray-400 mt-1">{company.contact}</p>
            {company.contractValue > 0 && (
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs font-semibold text-gray-600 tabular-nums">
                  ${company.contractValue.toLocaleString()}/yr
                </p>
                {company.creditsTotal > 0 && (
                  <p className="text-[10px] font-bold text-gray-400 tabular-nums">
                    {company.creditsRemaining}/{company.creditsTotal} credits
                  </p>
                )}
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────
export default function CorporatePage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [events, setEvents] = useState<UpcomingEvent[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [dashMetrics, setDashMetrics] = useState<DashboardMetrics | null>(null)
  const pipelineStages: PipelineStage[] = ['prospect', 'active', 'paused', 'churned']

  useEffect(() => {
    let cancelled = false
    const supabase = createBrowserClient()

    async function loadData() {
      const [companiesRes, eventsRes, invoicesRes, dashRes] = await Promise.all([
        supabase.from('company_accounts').select('*').eq('studio_id', STUDIO_ID).order('name'),
        supabase.from('events').select('*').eq('studio_id', STUDIO_ID).order('event_date', { ascending: true }).limit(5),
        supabase.from('corporate_invoices').select('*').eq('studio_id', STUDIO_ID).order('created_at', { ascending: false }).limit(5),
        fetch('/api/corporate/dashboard').then(r => r.json()).catch(() => ({ data: null })),
      ])

      if (cancelled) return

      if (dashRes?.data) setDashMetrics(dashRes.data)

      if (companiesRes.data) {
        setCompanies(companiesRes.data.map((c: any) => ({
          id: c.id,
          name: c.name || 'Unnamed Company',
          contact: c.contact_name || '',
          contractValue: c.contract_value ?? 0,
          creditsRemaining: c.credits_remaining ?? 0,
          creditsTotal: c.credits_total ?? 0,
          stage: (c.stage || 'prospect') as PipelineStage,
        })))
      }

      if (eventsRes.data) {
        setEvents(eventsRes.data.map((e: any) => ({
          id: e.id,
          date: e.event_date ? new Date(e.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '',
          company: e.company_name || '',
          eventType: (e.event_type || 'corporate') as EventType,
          guests: e.guest_count ?? 0,
          status: (e.status || 'inquiry') as EventStatus,
        })))
      }

      if (invoicesRes.data) {
        setInvoices(invoicesRes.data.map((inv: any) => ({
          id: inv.id,
          number: inv.invoice_number || '',
          company: inv.company_name || '',
          amount: inv.amount ?? 0,
          status: (inv.status || 'draft') as InvoiceStatus,
          dueDate: inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '',
        })))
      }

      setLoading(false)
    }

    loadData()
    return () => { cancelled = true }
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
      className="min-h-screen bg-[#FAFAFA]"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Corporate Accounts</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage company partnerships, events, and invoicing</p>
        </div>
        <Link
          href="/corporate/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          New Account
        </Link>
      </div>

      {/* ─── Metrics Row ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {!dashMetrics ? (
          <>
            <MetricSkeleton />
            <MetricSkeleton />
            <MetricSkeleton />
            <MetricSkeleton />
          </>
        ) : (
          <>
            <MetricCard
              icon={Building2}
              label="Active Companies"
              value={String(dashMetrics.companies_by_status?.active ?? 0)}
              subtitle={`${dashMetrics.total_companies ?? 0} total`}
              delay={0}
            />
            <MetricCard
              icon={DollarSign}
              label="Contract Value"
              value={`$${(dashMetrics.total_contract_value ?? 0).toLocaleString()}`}
              subtitle="Per year"
              delay={0.05}
            />
            <MetricCard
              icon={CreditCard}
              label="Credits Remaining"
              value={String(dashMetrics.credits?.remaining ?? 0)}
              subtitle={`of ${dashMetrics.credits?.monthly_allocated ?? 0} allocated`}
              delay={0.1}
            />
            <MetricCard
              icon={AlertTriangle}
              label="Overdue Invoices"
              value={String(dashMetrics.overdue_invoices?.count ?? 0)}
              subtitle={(dashMetrics.overdue_invoices?.count ?? 0) > 0 ? `$${(dashMetrics.overdue_invoices.total_outstanding ?? 0).toLocaleString()} outstanding` : 'None'}
              subtitleColor={(dashMetrics.overdue_invoices?.count ?? 0) > 0 ? 'text-amber-600' : 'text-gray-400'}
              delay={0.15}
            />
          </>
        )}
      </div>

      {/* ─── Pipeline View ──────────────────────────────────── */}
      <motion.div
        {...fadeInUp}
        transition={{ ...fadeInUp.transition, delay: 0.1 }}
        className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-gray-900">Pipeline</h3>
            <p className="text-xs text-gray-400 mt-0.5">Company accounts by stage</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {pipelineStages.map((stage) => (
            <PipelineColumn
              key={stage}
              stage={stage}
              companies={companies.filter((c) => c.stage === stage)}
            />
          ))}
        </div>
      </motion.div>

      {/* ─── Upcoming Events + Recent Invoices ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Upcoming Events */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.15 }}
          className="bg-white rounded-2xl border border-gray-200 shadow-sm"
        >
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div>
              <h3 className="text-base font-bold text-gray-900">Upcoming Events</h3>
              <p className="text-xs text-gray-400 mt-0.5">Next 5 scheduled events</p>
            </div>
            <Link
              href="/corporate/events"
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              View all
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="divide-y divide-gray-50">
            {events.length === 0 && (
              <div className="py-12 text-center">
                <Calendar className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-gray-500">No upcoming events</p>
                <p className="text-xs text-gray-400 mt-0.5">Events will appear here once created</p>
              </div>
            )}
            {events.map((event) => (
              <Link
                key={event.id}
                href={`/corporate/events/${event.id}`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/80 transition-colors group"
              >
                <div className="h-10 w-10 rounded-xl bg-gray-50 flex flex-col items-center justify-center shrink-0">
                  <Calendar className="h-4 w-4 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-indigo-600 transition-colors">
                      {event.company}
                    </p>
                    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold', eventTypeConfig[event.eventType].className)}>
                      {eventTypeConfig[event.eventType].label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{event.date}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Users className="h-3 w-3" />
                    <span className="tabular-nums">{event.guests}</span>
                  </div>
                  <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold', eventStatusConfig[event.status].className)}>
                    {eventStatusConfig[event.status].label}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Recent Invoices */}
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.2 }}
          className="bg-white rounded-2xl border border-gray-200 shadow-sm"
        >
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div>
              <h3 className="text-base font-bold text-gray-900">Recent Invoices</h3>
              <p className="text-xs text-gray-400 mt-0.5">Latest corporate invoices</p>
            </div>
          </div>

          {/* Table header */}
          <div className="flex items-center gap-4 px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100">
            <div className="w-28">Invoice</div>
            <div className="flex-1 min-w-0">Company</div>
            <div className="w-20 text-right">Amount</div>
            <div className="w-20 text-center">Status</div>
            <div className="w-24 text-right">Due Date</div>
          </div>

          <div className="divide-y divide-gray-50">
            {invoices.length === 0 && (
              <div className="py-12 text-center">
                <CreditCard className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-gray-500">No invoices yet</p>
                <p className="text-xs text-gray-400 mt-0.5">Corporate invoices will appear here</p>
              </div>
            )}
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/80 transition-colors"
              >
                <div className="w-28">
                  <p className="text-sm font-mono font-semibold text-gray-900 tabular-nums">{invoice.number}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 truncate">{invoice.company}</p>
                </div>
                <div className="w-20 text-right">
                  <p className="text-sm font-semibold text-gray-900 tabular-nums">${invoice.amount.toLocaleString()}</p>
                </div>
                <div className="w-20 flex justify-center">
                  <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold', invoiceStatusConfig[invoice.status].className)}>
                    {invoiceStatusConfig[invoice.status].label}
                  </span>
                </div>
                <div className="w-24 text-right">
                  <p className="text-xs text-gray-400">{invoice.dueDate}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}
