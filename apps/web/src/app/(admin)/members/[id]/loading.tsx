/**
 * Member detail page loading skeleton (LOW-002).
 * Shown by Next.js while the member profile route segment loads.
 */
export default function MemberDetailLoading() {
  return (
    <div className="animate-pulse p-6 lg:p-8 space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-gray-200 dark:bg-gray-800" />
        <div className="space-y-2">
          <div className="h-5 w-48 bg-gray-200 dark:bg-gray-800 rounded" />
          <div className="h-3 w-32 bg-gray-100 dark:bg-gray-800 rounded" />
        </div>
      </div>

      {/* Stats row skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4 space-y-2">
            <div className="h-3 w-16 bg-gray-100 dark:bg-gray-800 rounded" />
            <div className="h-6 w-24 bg-gray-200 dark:bg-gray-800 rounded" />
          </div>
        ))}
      </div>

      {/* Content area skeleton */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-6 space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-4 bg-gray-100 dark:bg-gray-800 rounded" style={{ width: `${80 - i * 10}%` }} />
        ))}
      </div>
    </div>
  )
}
