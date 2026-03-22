'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { createBrowserClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  ArrowLeft,
  Edit3,
  Building2,
  Mail,
  Phone,
  Globe,
  Calendar,
  CreditCard,
  Users,
  FileText,
  CheckCircle2,
  Clock,
  Trash2,
  Send,
  Eye,
  XCircle,
  RefreshCw,
} from 'lucide-react'

// ─── Animation ──────────────────────────────────────────────
const fadeInUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] as const },
}

// ─── Types ──────────────────────────────────────────────────
type Tab = 'overview' | 'members' | 'events' | 'invoices'
type MemberRole = 'primary' | 'admin' | 'member'
type EventStatus = 'confirmed' | 'deposit_paid' | 'completed' | 'inquiry'
type EventType = 'team_building' | 'corporate' | 'workshop' | 'private_party'
type InvoiceStatus = 'paid' | 'sent' | 'overdue' | 'draft'

const STUDIO_ID = '11111111-1111-1111-1111-111111111111'

// ─── Helpers ────────────────────────────────────────────────
const statusConfig = {
  active: { label: 'Active', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  paused: { label: 'Paused', className: 'bg-amber-50 text-amber-700 border border-amber-200' },
  prospect: { label: 'Prospect', className: 'bg-blue-50 text-blue-700 border border-blue-200' },
  churned: { label: 'Churned', className: 'bg-gray-100 text-gray-600' },
}

const memberRoleConfig: Record<MemberRole, { label: string; className: string }> = {
  primary: { label: 'Primary', className: 'bg-indigo-50 text-indigo-700 border border-indigo-200' },
  admin: { label: 'Admin', className: 'bg-violet-50 text-violet-700 border border-violet-200' },
  member: { label: 'Member', className: 'bg-gray-100 text-gray-600' },
}

const eventStatusConfig: Record<EventStatus, { label: string; className: string }> = {
  inquiry: { label: 'Inquiry', className: 'bg-blue-50 text-blue-700 border border-blue-200' },
  confirmed: { label: 'Confirmed', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  deposit_paid: { label: 'Deposit Paid', className: 'bg-indigo-50 text-indigo-700 border border-indigo-200' },
  completed: { label: 'Completed', className: 'bg-gray-100 text-gray-600' },
}

const eventTypeConfig: Record<EventType, { label: string; className: string }> = {
  corporate: { label: 'Corporate', className: 'bg-indigo-50 text-indigo-700' },
  team_building: { label: 'Team Building', className: 'bg-emerald-50 text-emerald-700' },
  workshop: { label: 'Workshop', className: 'bg-amber-50 text-amber-700' },
  private_party: { label: 'Private Party', className: 'bg-violet-50 text-violet-700' },
}

const invoiceStatusConfig: Record<InvoiceStatus, { label: string; className: string }> = {
  paid: { label: 'Paid', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  sent: { label: 'Sent', className: 'bg-blue-50 text-blue-700 border border-blue-200' },
  overdue: { label: 'Overdue', className: 'bg-red-50 text-red-700 border border-red-200' },
  draft: { label: 'Draft', className: 'border border-gray-300 text-gray-500 bg-white' },
}

const TABS: { value: Tab; label: string; icon: typeof FileText }[] = [
  { value: 'overview', label: 'Overview', icon: Building2 },
  { value: 'members', label: 'Members', icon: Users },
  { value: 'events', label: 'Events', icon: Calendar },
  { value: 'invoices', label: 'Invoices', icon: FileText },
]

// ─── Page ───────────────────────────────────────────────────
export default function CompanyDetailPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [COMPANY, setCOMPANY] = useState<any>(null)
  const [MEMBERS, setMEMBERS] = useState<any[]>([])
  const [EVENTS, setEVENTS] = useState<any[]>([])
  const [INVOICES, setINVOICES] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const supabase = createBrowserClient()
    const companyId = typeof window !== 'undefined' ? window.location.pathname.split('/').pop() : ''

    async function loadCompany() {
      const { data } = await supabase
        .from('company_accounts')
        .select('*')
        .eq('id', companyId)
        .eq('studio_id', STUDIO_ID)
        .single()

      if (cancelled) return

      if (data) {
        setCOMPANY({
          id: data.id,
          name: data.name || 'Unnamed Company',
          status: data.stage || 'prospect',
          contact: data.contact_name || '',
          email: data.contact_email || '',
          phone: data.contact_phone || '',
          website: data.website || '',
          industry: data.industry || '',
          companySize: data.company_size || '',
          billingEmail: data.billing_email || '',
          address: data.address || '',
          paymentTerms: data.payment_terms || 'Net 30',
          contractStart: data.contract_start ? new Date(data.contract_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '',
          contractEnd: data.contract_end ? new Date(data.contract_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '',
          contractValue: data.contract_value ?? 0,
          monthlyCredits: data.credits_total ?? 1,
          creditsRemaining: data.credits_remaining ?? 0,
          rolloverCap: data.rollover_cap ?? 0,
          autoRenew: data.auto_renew ?? false,
          notes: data.notes || '',
        })
      }

      setLoading(false)
    }

    loadCompany()
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading company details...</p>
        </div>
      </div>
    )
  }

  if (!COMPANY) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <div className="text-center">
          <Building2 className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-900 mb-1">Company not found</h3>
          <p className="text-sm text-gray-400">This company may have been deleted.</p>
          <Link href="/corporate" className="inline-flex items-center gap-2 mt-4 text-sm font-semibold text-indigo-600 hover:text-indigo-700">
            <ArrowLeft className="h-4 w-4" /> Back to Corporate
          </Link>
        </div>
      </div>
    )
  }

  const creditsPercent = COMPANY.monthlyCredits > 0 ? (COMPANY.creditsRemaining / COMPANY.monthlyCredits) * 100 : 0
  const companyStatus = statusConfig[COMPANY.status as keyof typeof statusConfig]

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
      className="min-h-screen bg-[#FAFAFA]"
    >
      {/* Back Link */}
      <Link
        href="/corporate"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Corporate
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-indigo-50 flex items-center justify-center">
            <Building2 className="h-7 w-7 text-indigo-600" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">{COMPANY.name}</h1>
              <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', companyStatus.className)}>
                {companyStatus.label}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-1.5">
              <span className="inline-flex items-center gap-1.5 text-sm text-gray-500">
                <Mail className="h-3.5 w-3.5" />
                {COMPANY.email}
              </span>
              <span className="inline-flex items-center gap-1.5 text-sm text-gray-500">
                <Phone className="h-3.5 w-3.5" />
                {COMPANY.phone}
              </span>
              <span className="inline-flex items-center gap-1.5 text-sm text-gray-500">
                <Globe className="h-3.5 w-3.5" />
                {COMPANY.website}
              </span>
            </div>
          </div>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:border-gray-300 hover:text-gray-900 transition-colors">
          <Edit3 className="h-4 w-4" />
          Edit
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 mb-6 bg-white rounded-xl border border-gray-200 p-1 w-fit">
        {TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all',
                activeTab === tab.value
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <motion.div {...fadeInUp} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Contract Details */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-base font-bold text-gray-900 mb-4">Contract Details</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-5 gap-x-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Start Date</p>
                <p className="text-sm font-semibold text-gray-900">{COMPANY.contractStart}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">End Date</p>
                <p className="text-sm font-semibold text-gray-900">{COMPANY.contractEnd}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Contract Value</p>
                <p className="text-sm font-semibold text-gray-900">${COMPANY.contractValue.toLocaleString()}/yr</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Payment Terms</p>
                <p className="text-sm font-semibold text-gray-900">{COMPANY.paymentTerms}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Rollover Cap</p>
                <p className="text-sm font-semibold text-gray-900">{COMPANY.rolloverCap} credits</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Auto-Renew</p>
                <div className="flex items-center gap-1.5">
                  {COMPANY.autoRenew ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <p className="text-sm font-semibold text-emerald-700">Yes</p>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-gray-400" />
                      <p className="text-sm font-semibold text-gray-500">No</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Credit Balance */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-base font-bold text-gray-900 mb-4">Credit Balance</h3>
            <div className="text-center mb-4">
              <p className="text-[42px] font-black text-gray-900 tabular-nums leading-none">{COMPANY.creditsRemaining}</p>
              <p className="text-sm text-gray-400 mt-1">of {COMPANY.monthlyCredits} monthly credits</p>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3 mb-2">
              <div
                className="bg-indigo-600 h-3 rounded-full transition-all"
                style={{ width: `${creditsPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>{COMPANY.creditsRemaining} remaining</span>
              <span>{COMPANY.monthlyCredits - COMPANY.creditsRemaining} used</span>
            </div>
          </div>

          {/* Notes */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-base font-bold text-gray-900 mb-3">Notes</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{COMPANY.notes}</p>
          </div>
        </motion.div>
      )}

      {activeTab === 'members' && (
        <motion.div {...fadeInUp} className="bg-white rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div>
              <h3 className="text-base font-bold text-gray-900">Linked Members</h3>
              <p className="text-xs text-gray-400 mt-0.5">{MEMBERS.length} members</p>
            </div>
            <button className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors">
              <Users className="h-3.5 w-3.5" />
              Add Member
            </button>
          </div>

          {/* Table header */}
          <div className="flex items-center gap-4 px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100">
            <div className="flex-1 min-w-0">Name</div>
            <div className="w-48">Email</div>
            <div className="w-20 text-center">Role</div>
            <div className="w-28 text-right">Added</div>
            <div className="w-16 text-center">Action</div>
          </div>

          <div className="divide-y divide-gray-50">
            {MEMBERS.map((member) => (
              <div key={member.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/80 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{member.name}</p>
                </div>
                <div className="w-48">
                  <p className="text-sm text-gray-500 truncate">{member.email}</p>
                </div>
                <div className="w-20 flex justify-center">
                  <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold', memberRoleConfig[member.role as MemberRole].className)}>
                    {memberRoleConfig[member.role as MemberRole].label}
                  </span>
                </div>
                <div className="w-28 text-right">
                  <p className="text-xs text-gray-400">{member.addedDate}</p>
                </div>
                <div className="w-16 flex justify-center">
                  <button className="h-7 w-7 rounded-lg bg-red-50 flex items-center justify-center hover:bg-red-100 transition-colors">
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {activeTab === 'events' && (
        <motion.div {...fadeInUp} className="bg-white rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div>
              <h3 className="text-base font-bold text-gray-900">Event History</h3>
              <p className="text-xs text-gray-400 mt-0.5">{EVENTS.length} events</p>
            </div>
          </div>

          {/* Table header */}
          <div className="flex items-center gap-4 px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100">
            <div className="flex-1 min-w-0">Event</div>
            <div className="w-28">Date</div>
            <div className="w-24 text-center">Type</div>
            <div className="w-16 text-center">Guests</div>
            <div className="w-24 text-center">Status</div>
            <div className="w-20 text-right">Total</div>
          </div>

          <div className="divide-y divide-gray-50">
            {EVENTS.map((event) => (
              <Link
                key={event.id}
                href={`/corporate/events/${event.id}`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/80 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-indigo-600 transition-colors">{event.name}</p>
                </div>
                <div className="w-28">
                  <p className="text-sm text-gray-500">{event.date}</p>
                </div>
                <div className="w-24 flex justify-center">
                  <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold', eventTypeConfig[event.type as EventType].className)}>
                    {eventTypeConfig[event.type as EventType].label}
                  </span>
                </div>
                <div className="w-16 text-center">
                  <p className="text-sm text-gray-700 tabular-nums">{event.guests}</p>
                </div>
                <div className="w-24 flex justify-center">
                  <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold', eventStatusConfig[event.status as EventStatus].className)}>
                    {eventStatusConfig[event.status as EventStatus].label}
                  </span>
                </div>
                <div className="w-20 text-right">
                  <p className="text-sm font-semibold text-gray-900 tabular-nums">${event.total.toLocaleString()}</p>
                </div>
              </Link>
            ))}
          </div>
        </motion.div>
      )}

      {activeTab === 'invoices' && (
        <motion.div {...fadeInUp} className="bg-white rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div>
              <h3 className="text-base font-bold text-gray-900">Invoices</h3>
              <p className="text-xs text-gray-400 mt-0.5">{INVOICES.length} invoices</p>
            </div>
            <button className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors">
              <FileText className="h-3.5 w-3.5" />
              New Invoice
            </button>
          </div>

          {/* Table header */}
          <div className="flex items-center gap-4 px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100">
            <div className="w-32">Invoice</div>
            <div className="w-28">Date</div>
            <div className="flex-1 text-right">Amount</div>
            <div className="w-20 text-center">Status</div>
            <div className="w-28 flex justify-end">Actions</div>
          </div>

          <div className="divide-y divide-gray-50">
            {INVOICES.map((invoice) => (
              <div key={invoice.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/80 transition-colors">
                <div className="w-32">
                  <p className="text-sm font-mono font-semibold text-gray-900 tabular-nums">{invoice.number}</p>
                </div>
                <div className="w-28">
                  <p className="text-sm text-gray-500">{invoice.date}</p>
                </div>
                <div className="flex-1 text-right">
                  <p className="text-sm font-semibold text-gray-900 tabular-nums">${invoice.amount.toLocaleString()}</p>
                </div>
                <div className="w-20 flex justify-center">
                  <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold', invoiceStatusConfig[invoice.status as InvoiceStatus].className)}>
                    {invoiceStatusConfig[invoice.status as InvoiceStatus].label}
                  </span>
                </div>
                <div className="w-28 flex justify-end gap-1.5">
                  <button className="h-7 w-7 rounded-lg bg-gray-50 flex items-center justify-center hover:bg-gray-100 transition-colors" title="View">
                    <Eye className="h-3.5 w-3.5 text-gray-500" />
                  </button>
                  <button className="h-7 w-7 rounded-lg bg-gray-50 flex items-center justify-center hover:bg-gray-100 transition-colors" title="Send">
                    <Send className="h-3.5 w-3.5 text-gray-500" />
                  </button>
                  <button className="h-7 w-7 rounded-lg bg-gray-50 flex items-center justify-center hover:bg-red-50 transition-colors" title="Void">
                    <XCircle className="h-3.5 w-3.5 text-gray-500 hover:text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
