'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { MailX, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react'
import { fadeInUp } from '@/lib/motion'

type UnsubState = 'confirm' | 'processing' | 'success' | 'error' | 'invalid'

export default function UnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const [state, setState] = useState<UnsubState>('confirm')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleUnsubscribe() {
    setState('processing')
    try {
      const { token } = await params
      const res = await fetch(`/api/unsubscribe/${token}`, { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        if (res.status === 400 || res.status === 410) {
          setState('invalid')
          setErrorMsg(data.error ?? 'This unsubscribe link is invalid or expired.')
        } else {
          setState('error')
          setErrorMsg(data.error ?? 'Something went wrong.')
        }
        return
      }

      setState('success')
    } catch {
      setState('error')
      setErrorMsg('Unable to process your request. Please try again later.')
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-6">
      <motion.div
        {...fadeInUp}
        className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-sm p-8"
      >
        {state === 'confirm' && (
          <div className="text-center">
            <div className="h-14 w-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
              <MailX className="h-7 w-7 text-red-500" />
            </div>
            <h1 className="text-xl font-black text-gray-900 tracking-tight">Unsubscribe</h1>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">
              Are you sure you want to unsubscribe from marketing emails? You&apos;ll still receive
              transactional emails like booking confirmations and receipts.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <button
                onClick={handleUnsubscribe}
                className="w-full px-4 py-3 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors"
              >
                Yes, Unsubscribe Me
              </button>
              <a
                href="/"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Never Mind, Go Back
              </a>
            </div>
          </div>
        )}

        {state === 'processing' && (
          <div className="text-center py-4">
            <div className="h-10 w-10 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mx-auto mb-4" />
            <p className="text-sm font-medium text-gray-500">Processing your request...</p>
          </div>
        )}

        {state === 'success' && (
          <div className="text-center">
            <div className="h-14 w-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            </div>
            <h1 className="text-xl font-black text-gray-900 tracking-tight">You&apos;re Unsubscribed</h1>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">
              You won&apos;t receive any more marketing emails from us. If you change your mind,
              contact the studio to re-subscribe.
            </p>
            <p className="text-xs text-gray-400 mt-4">
              You&apos;ll still receive important transactional emails (booking confirmations, receipts, etc.)
            </p>
          </div>
        )}

        {state === 'invalid' && (
          <div className="text-center">
            <div className="h-14 w-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-7 w-7 text-amber-600" />
            </div>
            <h1 className="text-xl font-black text-gray-900 tracking-tight">Invalid Link</h1>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">
              {errorMsg}
            </p>
            <p className="text-xs text-gray-400 mt-4">
              If you need help, please contact the studio directly.
            </p>
          </div>
        )}

        {state === 'error' && (
          <div className="text-center">
            <div className="h-14 w-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-7 w-7 text-red-500" />
            </div>
            <h1 className="text-xl font-black text-gray-900 tracking-tight">Something Went Wrong</h1>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">
              {errorMsg}
            </p>
            <button
              onClick={() => setState('confirm')}
              className="mt-4 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">
            The Sauna Guys &middot; 123 Main Street, Tampa, FL 33602
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Powered by Meridian
          </p>
        </div>
      </motion.div>
    </div>
  )
}
