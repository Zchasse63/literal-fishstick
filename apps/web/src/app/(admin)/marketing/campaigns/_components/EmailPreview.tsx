'use client'

import { cn } from '@/lib/utils'
import { Mail } from 'lucide-react'
import type { PreviewMode } from './types'

export default function EmailPreview({
  subject,
  previewText,
  body,
  mode,
}: {
  subject: string
  previewText: string
  body: string
  mode: PreviewMode
}) {
  const renderedBody = body
    .replace(/\{\{first_name\}\}/g, 'Sarah')
    .replace(/\{\{last_name\}\}/g, 'Chen')
    .replace(/\{\{email\}\}/g, 'sarah@example.com')
    .replace(/\{\{membership_name\}\}/g, 'Unlimited')
    .replace(/\{\{credits_remaining\}\}/g, '4')
    .replace(/\{\{studio_name\}\}/g, 'The Sauna Guys')
    .replace(/\{\{next_class_date\}\}/g, 'Thursday, Mar 21')
    .replace(/\{\{streak_count\}\}/g, '12')

  const renderedSubject = subject
    .replace(/\{\{first_name\}\}/g, 'Sarah')
    .replace(/\{\{studio_name\}\}/g, 'The Sauna Guys')
    .replace(/\{\{membership_name\}\}/g, 'Unlimited')
    .replace(/\{\{credits_remaining\}\}/g, '4')

  return (
    <div
      className={cn(
        'bg-white border border-gray-200 rounded-xl overflow-hidden transition-all duration-300 mx-auto',
        mode === 'desktop' ? 'max-w-full' : 'max-w-[375px]'
      )}
    >
      <div className="border-b border-gray-100 px-4 py-3 bg-gray-50/50">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-6 w-6 rounded-full bg-indigo-600 flex items-center justify-center">
            <span className="text-[10px] font-bold text-white">M</span>
          </div>
          <span className="text-xs font-semibold text-gray-700">The Sauna Guys</span>
          <span className="text-[10px] text-gray-400 ml-auto">Just now</span>
        </div>
        <p className="text-sm font-semibold text-gray-900 truncate">
          {renderedSubject || 'No subject'}
        </p>
        {previewText && (
          <p className="text-xs text-gray-400 truncate mt-0.5">{previewText}</p>
        )}
      </div>
      <div className="p-4">
        {renderedBody ? (
          <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
            {renderedBody}
          </div>
        ) : (
          <div className="text-center py-8">
            <Mail className="h-8 w-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Start typing to see preview</p>
          </div>
        )}
      </div>
    </div>
  )
}
