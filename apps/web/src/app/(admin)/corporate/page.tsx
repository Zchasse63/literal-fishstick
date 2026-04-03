import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'
import CorporateClient from './_components/CorporateClient'

export default async function CorporatePage() {
  const supabase = await createServerClient()

  const [companiesRes, eventsRes, invoicesRes, dashRes] = await Promise.all([
    supabase.from('company_accounts').select('*').eq('studio_id', DEFAULT_STUDIO_ID).order('name'),
    supabase.from('events').select('*').eq('studio_id', DEFAULT_STUDIO_ID).order('event_date', { ascending: true }).limit(5),
    supabase.from('corporate_invoices').select('*').eq('studio_id', DEFAULT_STUDIO_ID).order('created_at', { ascending: false }).limit(5),
    fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/corporate/dashboard`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({ data: null })),
  ])

  const companies = (companiesRes.data ?? []).map((c: any) => ({
    id: c.id,
    name: c.name || 'Unnamed Company',
    contact: c.contact_name || '',
    contractValue: c.contract_value ?? 0,
    creditsRemaining: c.credits_remaining ?? 0,
    creditsTotal: c.credits_total ?? 0,
    stage: (c.stage || 'prospect') as string,
  }))

  const events = (eventsRes.data ?? []).map((e: any) => ({
    id: e.id,
    date: e.event_date ? new Date(e.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '',
    company: e.company_name || '',
    eventType: (e.event_type || 'corporate') as string,
    guests: e.guest_count ?? 0,
    status: (e.status || 'inquiry') as string,
  }))

  const invoices = (invoicesRes.data ?? []).map((inv: any) => ({
    id: inv.id,
    number: inv.invoice_number || '',
    company: inv.company_name || '',
    amount: inv.amount ?? 0,
    status: (inv.status || 'draft') as string,
    dueDate: inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '',
  }))

  const dashMetrics = dashRes?.data ?? null

  return (
    <CorporateClient
      initialCompanies={companies}
      initialEvents={events}
      initialInvoices={invoices}
      initialDashMetrics={dashMetrics}
    />
  )
}
