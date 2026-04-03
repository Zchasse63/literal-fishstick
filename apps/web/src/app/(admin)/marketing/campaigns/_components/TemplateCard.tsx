'use client'

import { cn } from '@/lib/utils'
import type { Template } from './types'

export default function TemplateCard({
  template,
  onSelect,
}: {
  template: Template
  onSelect: (t: Template) => void
}) {
  const Icon = template.icon
  return (
    <button
      onClick={() => onSelect(template)}
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl border text-left transition-all',
        'hover:shadow-sm hover:border-indigo-200 hover:bg-indigo-50/30',
        'bg-white border-gray-200'
      )}
    >
      <div
        className={cn(
          'h-9 w-9 rounded-lg flex items-center justify-center shrink-0 border',
          template.color
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900">{template.name}</p>
        <p className="text-xs text-gray-400 truncate">{template.subject}</p>
      </div>
    </button>
  )
}
