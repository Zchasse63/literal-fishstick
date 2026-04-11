import { AdminShell } from '@/components/layout/admin-shell'

/**
 * Admin layout — React Server Component.
 *
 * All interactive state (sidebar toggle, keyboard shortcuts, pathname-based
 * breadcrumbs) lives in the AdminShell client component. Keeping this layout
 * as an RSC enables streaming SSR for child routes. See MED-009.
 *
 * All admin routes are force-dynamic: they rely on the authenticated user's
 * session to scope RLS queries, so static pre-rendering at build time would
 * always fetch an anonymous view (or fail). This also skips the page-generation
 * phase on Netlify which has had compatibility issues with Next 16.
 */
export const dynamic = 'force-dynamic'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AdminShell>{children}</AdminShell>
}
