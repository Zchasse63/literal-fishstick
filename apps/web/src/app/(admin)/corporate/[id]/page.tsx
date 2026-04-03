import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'
import CompanyDetailClient from './_components/CompanyDetailClient'

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()

  const { data } = await supabase
    .from('company_accounts')
    .select('*')
    .eq('id', id)
    .eq('studio_id', DEFAULT_STUDIO_ID)
    .single()

  const initialCompany = data
    ? {
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
      }
    : null

  return <CompanyDetailClient initialCompany={initialCompany} />
}
