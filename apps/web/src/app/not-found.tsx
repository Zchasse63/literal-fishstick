import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        {/* Logo */}
        <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <span className="text-white font-black text-2xl">M</span>
        </div>

        <h1 className="text-[64px] font-black text-gray-900 leading-none mb-2">404</h1>
        <h2 className="text-lg font-bold text-gray-900 mb-2">Page not found</h2>
        <p className="text-sm text-gray-500 mb-8">
          The page you are looking for does not exist or has been moved.
        </p>

        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
}
