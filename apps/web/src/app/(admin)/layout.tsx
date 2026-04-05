import { AdminShell } from '@/components/layout/admin-shell'

/**
 * Admin layout — React Server Component.
 *
 * All interactive state (sidebar toggle, keyboard shortcuts, pathname-based
 * breadcrumbs) lives in the AdminShell client component. Keeping this layout
 * as an RSC enables streaming SSR for child routes. See MED-009.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AdminShell>{children}</AdminShell>
}
