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
  Loader2,
  DollarSign,
  Coins,
  Plus,
} from 'lucide-react'
import { fadeInUp } from '@/lib/motion'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'

// ─── Types ──────────────────────────────────────────────────
type Tab = 'overview' | 'members' | 'events' | 'invoices' | 'credits'
type MemberRole = 'primary' | 'admin' | 'member'
type EventStatus = 'confirmed' | 'deposit_paid' | 'completed' | 'inquiry'
type EventType = 'team_building' | 'corporate' | 'workshop' | 'private_party'
type InvoiceStatus = 'paid' | 'sent' | 'overdue' | 'draft'

const STUDIO_ID = DEFAULT_STUDIO_ID

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
  { value: 'credits', label: 'Credits', icon: CreditCard },
]

// ─── Page ───────────────────────────────────────────────────
export default function CompanyDetailPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [COMPANY, setCOMPANY] = useState<any>(null)
  const [MEMBERS, setMEMBERS] = useState<any[]>([])
  const [EVENTS, setEVENTS] = useState<any[]>([])
  const [INVOICES, setINVOICES] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Invoice action state
  const [invoiceActionLoading, setInvoiceActionLoading] = useState<Record<string, boolean>>({})
  const [invoiceErrors, setInvoiceErrors] = useState<Record<string, string>>({})
  const [paymentDialogId, setPaymentDialogId] = useState<string | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('stripe')

  // Credits state
  const [creditHistory, setCreditHistory] = useState<any[]>([])
  const [creditsLoading, setCreditsLoading] = useState(false)
  const [allocAmount, setAllocAmount] = useState('')
  const [allocReason, setAllocReason] = useState('')
  const [allocating, setAllocating] = useState(false)
  const [allocError, setAllocError] = useState<string | null>(null)

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

  // Load credits when credits tab is active
  useEffect(() => {
    if (activeTab !== 'credits' || !COMPANY) return
    const companyId = COMPANY.id
    const supabase = createBrowserClient()
    setCreditsLoading(true)
    supabase
      .from('activity_log')
      .select('*')
      .eq('subject_type', 'company_account')
      .eq('subject_id', companyId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setCreditHistory(data || [])
        setCreditsLoading(false)
      })
  }, [activeTab, COMPANY])

  // Invoice action handlers
  async function handleSendInvoice(invoiceId: string) {
    setInvoiceActionLoading(prev => ({ ...prev, [invoiceId]: true }))
    setInvoiceErrors(prev => { const n = { ...prev }; delete n[invoiceId]; return n })
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/send`, { method: 'POST' })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Send failed') }
      setINVOICES(prev => prev.map(inv => inv.id === invoiceId ? { ...inv, status: 'sent' } : inv))
    } catch (err: any) {
      setInvoiceErrors(prev => ({ ...prev, [invoiceId]: err.message }))
    } finally {
      setInvoiceActionLoading(prev => ({ ...prev, [invoiceId]: false }))
    }
  }

  async function handleVoidInvoice(invoiceId: string) {
    if (!window.confirm('Are you sure you want to void this invoice? This cannot be undone.')) return
    setInvoiceActionLoading(prev => ({ ...prev, [invoiceId]: true }))
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/void`, { method: 'POST' })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Void failed') }
      setINVOICES(prev => prev.map(inv => inv.id === invoiceId ? { ...inv, status: 'void' as InvoiceStatus } : inv))
    } catch (err: any) {
      setInvoiceErrors(prev => ({ ...prev, [invoiceId]: err.message }))
    } finally {
      setInvoiceActionLoading(prev => ({ ...prev, [invoiceId]: false }))
    }
  }

  async function handleRecordPayment() {
    if (!paymentDialogId || !paymentAmount) return
    const amountCents = Math.round(parseFloat(paymentAmount) * 100)
    if (isNaN(amountCents) || amountCents <= 0) return
    setInvoiceActionLoading(prev => ({ ...prev, [paymentDialogId]: true }))
    try {
      const res = await fetch(`/api/invoices/${paymentDialogId}/record-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amountCents, payment_method: paymentMethod }),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Payment failed') }
      setINVOICES(prev => prev.map(inv => inv.id === paymentDialogId ? { ...inv, status: 'paid' as InvoiceStatus } : inv))
      setPaymentDialogId(null)
      setPaymentAmount('')
      setPaymentMethod('stripe')
    } catch (err: any) {
      setInvoiceErrors(prev => ({ ...prev, [paymentDialogId]: err.message }))
    } finally {
      setInvoiceActionLoading(prev => ({ ...prev, [paymentDialogId!]: false }))
    }
  }

  async function handleAllocateCredits() {
    if (!COMPANY || !allocAmount || !allocReason.trim()) return
    const amount = Number(allocAmount)
    if (isNaN(amount) || amount === 0) return
    if (amount < 0 && Math.abs(amount) > COMPANY.creditsRemaining) {
      setAllocError(`Cannot deduct more than current balance (${COMPANY.creditsRemaining} credits)`)
      return
    }
    setAllocating(true)
    setAllocError(null)
    try {
      const res = await fetch(`/api/corporate/${COMPANY.id}/credits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, reason: allocReason }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Allocation failed')
      setCOMPANY((prev: any) => ({ ...prev, creditsRemaining: json.data?.new_balance ?? prev.creditsRemaining + amount }))
      setAllocAmount('')
      setAllocReason('')
      // Refresh credit history
      const supabase = createBrowserClient()
      const { data } = await supabase.from('activity_log').select('*').eq('subject_type', 'company_account').eq('subject_id', COMPANY.id).order('created_at', { ascending: false }).limit(50)
      setCreditHistory(data || [])
    } catch (err: any) {
      setAllocError(err.message)
    } finally {
      setAllocating(false)
    }
  }

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
                  {(invoice.status === 'draft' || invoice.status === 'sent') && (
                    <button
                      onClick={() => handleSendInvoice(invoice.id)}
                      disabled={invoiceActionLoading[invoice.id]}
                      className="h-7 w-7 rounded-lg bg-gray-50 flex items-center justify-center hover:bg-indigo-50 transition-colors disabled:opacity-50"
                      title="Send"
                    >
                      {invoiceActionLoading[invoice.id] ? <Loader2 className="h-3.5 w-3.5 text-gray-400 animate-spin" /> : <Send className="h-3.5 w-3.5 text-indigo-500" />}
                    </button>
                  )}
                  {invoice.status !== 'paid' && (invoice.status as string) !== 'void' && (
                    <button
                      onClick={() => { setPaymentDialogId(invoice.id); setPaymentAmount(''); setPaymentMethod('stripe') }}
                      className="h-7 w-7 rounded-lg bg-gray-50 flex items-center justify-center hover:bg-emerald-50 transition-colors"
                      title="Record Payment"
                    >
                      <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                    </button>
                  )}
                  {(invoice.status === 'draft' || invoice.status === 'sent' || invoice.status === 'overdue') && (
                    <button
                      onClick={() => handleVoidInvoice(invoice.id)}
                      disabled={invoiceActionLoading[invoice.id]}
                      className="h-7 w-7 rounded-lg bg-gray-50 flex items-center justify-center hover:bg-red-50 transition-colors disabled:opacity-50"
                      title="Void"
                    >
                      <XCircle className="h-3.5 w-3.5 text-red-500" />
                    </button>
                  )}
                </div>
                {invoiceErrors[invoice.id] && (
                  <div className="col-span-full mt-1 text-xs text-red-600">{invoiceErrors[invoice.id]}</div>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {activeTab === 'credits' && (
        <motion.div {...fadeInUp} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Credit History */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm">
            <div className="px-5 pt-5 pb-3">
              <h3 className="text-base font-bold text-gray-900">Credit History</h3>
              <p className="text-xs text-gray-400 mt-0.5">Allocations and deductions</p>
            </div>
            {creditsLoading ? (
              <div className="px-5 py-8 text-center">
                <Loader2 className="h-5 w-5 text-gray-300 animate-spin mx-auto" />
              </div>
            ) : creditHistory.length === 0 ? (
              <div className="py-12 text-center">
                <CreditCard className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-gray-500">No credit adjustments yet</p>
                <p className="text-xs text-gray-400 mt-0.5">Allocations and deductions will appear here</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {creditHistory.map((entry: any) => (
                  <div key={entry.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{entry.type?.includes('allocated') ? 'Allocated' : entry.type?.includes('deducted') ? 'Deducted' : entry.type}</p>
                      <p className="text-xs text-gray-400">{entry.created_at ? new Date(entry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</p>
                    </div>
                    <div className="text-right">
                      <p className={cn('text-sm font-bold tabular-nums', entry.type?.includes('allocated') ? 'text-emerald-600' : 'text-red-600')}>
                        {entry.type?.includes('allocated') ? '+' : '-'}{Math.abs(entry.metadata?.amount ?? 0)}
                      </p>
                      {entry.metadata?.reason && <p className="text-[10px] text-gray-400">{entry.metadata.reason}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Credits Sidebar */}
          <div className="space-y-4">
            {/* Balance */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-base font-bold text-gray-900 mb-4">Credit Balance</h3>
              <div className="text-center mb-4">
                <p className="text-[42px] font-black text-gray-900 tabular-nums leading-none">{COMPANY.creditsRemaining}</p>
                <p className="text-sm text-gray-400 mt-1">of {COMPANY.monthlyCredits} monthly credits</p>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3 mb-2">
                <div className="bg-indigo-600 h-3 rounded-full transition-all" style={{ width: `${creditsPercent}%` }} />
              </div>
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>{COMPANY.creditsRemaining} remaining</span>
                <span>{COMPANY.monthlyCredits - COMPANY.creditsRemaining} used</span>
              </div>
            </div>

            {/* Allocate Credits */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Adjust Credits</h3>
              {allocError && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700 mb-3">{allocError}</div>
              )}
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Amount</label>
                  <input
                    type="number"
                    value={allocAmount}
                    onChange={(e) => setAllocAmount(e.target.value)}
                    placeholder="Positive to add, negative to deduct"
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Reason</label>
                  <input
                    value={allocReason}
                    onChange={(e) => setAllocReason(e.target.value)}
                    placeholder="e.g., Monthly renewal"
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
                <button
                  onClick={handleAllocateCredits}
                  disabled={allocating || !allocAmount || !allocReason.trim()}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {allocating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Apply Adjustment
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Record Payment Dialog */}
      {paymentDialogId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl border border-gray-200 shadow-xl p-6 w-full max-w-sm mx-4"
          >
            <h3 className="text-base font-bold text-gray-900 mb-1">Record Payment</h3>
            <p className="text-xs text-gray-400 mb-4">Record a manual payment for this invoice</p>

            {invoiceErrors[paymentDialogId] && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700 mb-3">{invoiceErrors[paymentDialogId]}</div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="stripe">Stripe</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="check">Check</option>
                  <option value="cash">Cash</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={handleRecordPayment}
                disabled={invoiceActionLoading[paymentDialogId] || !paymentAmount}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {invoiceActionLoading[paymentDialogId] && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Record Payment
              </button>
              <button
                onClick={() => { setPaymentDialogId(null); setPaymentAmount(''); setPaymentMethod('stripe') }}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  )
}
