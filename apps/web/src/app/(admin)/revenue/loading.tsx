/**
 * Revenue page loading skeleton (LOW-002).
 * Shown by Next.js while the revenue route segment loads.
 */
export default function RevenueLoading() {
  return (
    <div className="animate-pulse p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-6 w-32 bg-gray-200 dark:bg-gray-800 rounded" />
        <div className="h-3 w-48 bg-gray-100 dark:bg-gray-800 rounded" />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4 space-y-2">
            <div className="h-3 w-16 bg-gray-100 dark:bg-gray-800 rounded" />
            <div className="h-7 w-28 bg-gray-200 dark:bg-gray-800 rounded" />
            <div className="h-3 w-20 bg-gray-100 dark:bg-gray-800 rounded" />
          </div>
        ))}
      </div>

      {/* Chart placeholder */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-6">
        <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded" />
      </div>
    </div>
  )
}
