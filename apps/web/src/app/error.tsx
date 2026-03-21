'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Application error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        {/* Logo */}
        <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <span className="text-white font-black text-2xl">M</span>
        </div>

        <h1 className="text-2xl font-black text-gray-900 mb-2">Something went wrong</h1>
        <p className="text-sm text-gray-500 mb-6">
          An unexpected error occurred. Please try again.
        </p>

        {process.env.NODE_ENV === 'development' && (
          <details className="mb-6 text-left bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <summary className="text-xs font-semibold text-gray-500 cursor-pointer">
              Error details
            </summary>
            <pre className="mt-2 text-xs text-red-600 whitespace-pre-wrap break-words overflow-auto max-h-48">
              {error.message}
              {error.digest && `\nDigest: ${error.digest}`}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </details>
        )}

        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
