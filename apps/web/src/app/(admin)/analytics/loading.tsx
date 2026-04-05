/**
 * Analytics page loading skeleton (LOW-002).
 * Shown by Next.js while the analytics route segment loads.
 */
export default function AnalyticsLoading() {
  return (
    <div className="animate-pulse p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-6 w-32 bg-gray-200 dark:bg-gray-800 rounded" />
        <div className="h-3 w-56 bg-gray-100 dark:bg-gray-800 rounded" />
      </div>

      {/* Dashboard grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-6 space-y-4">
            <div className="h-4 w-24 bg-gray-100 dark:bg-gray-800 rounded" />
            <div className="h-48 bg-gray-100 dark:bg-gray-800 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
