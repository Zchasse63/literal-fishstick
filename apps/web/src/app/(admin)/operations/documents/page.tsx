import { createServerClient } from '@/lib/supabase/server'
import { DEFAULT_STUDIO_ID } from '@/lib/constants'
import DocumentsClient from './_components/DocumentsClient'
import type { EmployeeDocument, EmployeeListItem } from './_components/DocumentsClient'

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export default async function DocumentsPage() {
  const supabase = await createServerClient()

  const [docsResult, profilesResult] = await Promise.all([
    supabase
      .from('employee_documents')
      .select('*')
      .eq('studio_id', DEFAULT_STUDIO_ID)
      .order('created_at', { ascending: false }),
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('studio_id', DEFAULT_STUDIO_ID),
  ])

  const documents: EmployeeDocument[] = (docsResult.data ?? []).map((d: any) => ({
    id: d.id,
    employeeId: d.employee_id ?? '',
    employeeName: d.employee_name ?? 'Unknown',
    employeeInitials: getInitials(d.employee_name ?? 'U'),
    documentType: d.document_type ?? 'W4',
    documentName: d.document_name ?? d.file_name ?? 'Untitled',
    taxYear: d.tax_year ?? new Date().getFullYear().toString(),
    status: d.status ?? 'pending',
    uploadedDate: d.created_at
      ? new Date(d.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : '\u2014',
    expiresDate: d.expires_at
      ? new Date(d.expires_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : null,
    fileUrl: d.file_url ?? null,
  }))

  const employees: EmployeeListItem[] = [
    { id: 'all', name: 'All Employees' },
    ...(profilesResult.data ?? []).map((p: any) => ({
      id: p.id,
      name: p.full_name ?? 'Unknown',
    })),
  ]

  return (
    <DocumentsClient
      initialDocuments={documents}
      initialEmployees={employees}
    />
  )
}
