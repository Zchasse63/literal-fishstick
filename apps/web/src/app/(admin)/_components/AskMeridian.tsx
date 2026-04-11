'use client'

import { useState } from 'react'
import {
  Sparkles,
  Send,
  Loader2,
  ChevronDown,
  ChevronUp,
  Database,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAISearch } from '@/hooks/use-ai-search'

/**
 * Tier 8.5.A10 — "Ask Meridian" natural-language query surface.
 *
 * Claude translates English into Postgres queries against the studio's data
 * via the existing /api/ai/search pipeline (Tier 1 infra). This component
 * is the UI shell: big input, prompt examples, results table, collapsible
 * SQL explanation.
 *
 * Zero new backend — rides on `useAISearch` + `/api/ai/search`.
 */
const EXAMPLE_PROMPTS = [
  'How many members joined in the last 30 days?',
  'Show me at-risk unlimited members',
  'What was my revenue last week vs this week?',
  'Which classes had the highest fill rate this month?',
  'List members with failed payments in the last 14 days',
]

export function AskMeridian() {
  const [query, setQuery] = useState('')
  const [showSql, setShowSql] = useState(false)
  const {
    results,
    sql,
    explanation,
    resultType,
    isSearching,
    error,
    executeSearch,
  } = useAISearch()

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    const trimmed = query.trim()
    if (!trimmed || isSearching) return
    executeSearch(trimmed)
  }

  const pickExample = (example: string) => {
    setQuery(example)
    executeSearch(example)
  }

  const hasResults = Array.isArray(results) && results.length > 0
  const hasRun = sql.length > 0 || error !== null

  return (
    <div
      className="rounded-2xl p-[1px] bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500"
      data-testid="ask-meridian-root"
    >
      <div className="rounded-[15px] bg-white dark:bg-gray-950 p-5">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
              Ask Meridian
            </h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Natural language queries against your studio data — powered by Claude
            </p>
          </div>
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='"How many members joined last month?"'
            data-testid="ask-meridian-input"
            disabled={isSearching}
            className="w-full pl-4 pr-12 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 disabled:opacity-50 transition-all"
          />
          <button
            type="submit"
            disabled={isSearching || !query.trim()}
            data-testid="ask-meridian-submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Run query"
          >
            {isSearching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </button>
        </form>

        {/* Example prompts (shown only before first query) */}
        {!hasRun && !isSearching && (
          <div className="mt-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5">
              Try asking
            </p>
            <div className="flex flex-wrap gap-1.5" data-testid="ask-meridian-examples">
              {EXAMPLE_PROMPTS.map((example) => (
                <button
                  key={example}
                  onClick={() => pickExample(example)}
                  className="text-[11px] px-2 py-1 rounded-md border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Explanation (before results) */}
        {explanation && !error && (
          <div className="mt-4 p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30">
            <p className="text-xs text-indigo-900 dark:text-indigo-300">{explanation}</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            className="mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 flex items-start gap-2"
            data-testid="ask-meridian-error"
          >
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-red-900 dark:text-red-200">Query failed</p>
              <p className="text-[11px] text-red-800 dark:text-red-300 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Results */}
        {hasResults && (
          <div className="mt-4" data-testid="ask-meridian-results">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                {results!.length} result{results!.length === 1 ? '' : 's'} · {resultType}
              </p>
            </div>
            <ResultsTable rows={results!} />
          </div>
        )}

        {/* Empty-but-successful */}
        {hasRun && !hasResults && !error && !isSearching && (
          <div className="mt-4 p-4 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Query ran but returned no rows.
            </p>
          </div>
        )}

        {/* Collapsible SQL footer */}
        {sql && (
          <div className="mt-3 border-t border-gray-100 dark:border-gray-800 pt-3">
            <button
              onClick={() => setShowSql((prev) => !prev)}
              data-testid="ask-meridian-toggle-sql"
              className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              <Database className="h-3 w-3" />
              {showSql ? 'Hide' : 'Show'} generated SQL
              {showSql ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>
            {showSql && (
              <pre className="mt-2 p-3 rounded-lg bg-gray-900 dark:bg-gray-950 border border-gray-800 text-[10px] text-gray-300 font-mono overflow-x-auto whitespace-pre-wrap">
                {sql}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Results table ─────────────────────────────────────────────

function ResultsTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (rows.length === 0) return null
  const columns = Object.keys(rows[0])
  // Cap to 20 rows to keep the dashboard responsive
  const visible = rows.slice(0, 20)

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div className="overflow-x-auto max-h-80">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-3 py-2 text-left font-bold text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400 whitespace-nowrap"
                >
                  {col.replace(/_/g, ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {visible.map((row, i) => (
              <tr
                key={i}
                className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
              >
                {columns.map((col) => (
                  <td
                    key={col}
                    className="px-3 py-2 text-gray-700 dark:text-gray-300 tabular-nums"
                  >
                    {formatValue(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 20 && (
        <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 text-[11px] text-gray-500 dark:text-gray-400">
          Showing first 20 of {rows.length} rows
        </div>
      )}
    </div>
  )
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (typeof v === 'number') return v.toLocaleString()
  if (typeof v === 'string') {
    // Detect ISO timestamps and format them
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) {
      const d = new Date(v)
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      }
    }
    return v
  }
  return JSON.stringify(v)
}
