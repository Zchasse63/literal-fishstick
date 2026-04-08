'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import {
  Loader2,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Heart,
  AlertTriangle,
  ShieldCheck,
  Lightbulb,
} from 'lucide-react'

interface AIDetailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  memberId: string
  memberName: string
}

interface ChurnPrediction {
  risk_level: string
  risk_score: number
  narrative: string
  factors: string[]
  recommendations: string[]
}

interface HealthScore {
  score: number
  grade: string
  dimensions: Record<string, number>
  summary: string
}

interface Recommendation {
  recommendations: Array<{
    type: string
    title: string
    description: string
    priority: string
  }>
}

export default function AIDetailModal({
  open,
  onOpenChange,
  memberId,
  memberName,
}: AIDetailModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [churn, setChurn] = useState<ChurnPrediction | null>(null)
  const [health, setHealth] = useState<HealthScore | null>(null)
  const [recs, setRecs] = useState<Recommendation | null>(null)

  useEffect(() => {
    if (!open || !memberId) return

    let cancelled = false
    setLoading(true)
    setError(null)
    setChurn(null)
    setHealth(null)
    setRecs(null)

    async function fetchAIData() {
      try {
        const [churnRes, healthRes, recsRes] = await Promise.all([
          fetch('/api/ai/churn-prediction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ member_id: memberId }),
          }),
          fetch('/api/ai/health-score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ member_id: memberId }),
          }),
          fetch('/api/ai/recommendations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ member_id: memberId }),
          }),
        ])

        if (cancelled) return

        if (churnRes.ok) {
          const churnData = await churnRes.json()
          setChurn(churnData)
        }
        if (healthRes.ok) {
          const healthData = await healthRes.json()
          setHealth(healthData)
        }
        if (recsRes.ok) {
          const recsData = await recsRes.json()
          setRecs(recsData)
        }

        if (!churnRes.ok && !healthRes.ok && !recsRes.ok) {
          setError('Failed to fetch AI insights. Please try again.')
        }
      } catch {
        if (!cancelled) {
          setError('Network error while fetching AI insights.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchAIData()

    return () => {
      cancelled = true
    }
  }, [open, memberId])

  const riskColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'high':
        return 'text-red-600 bg-red-50 border-red-200'
      case 'medium':
        return 'text-orange-600 bg-orange-50 border-orange-200'
      case 'low':
        return 'text-emerald-600 bg-emerald-50 border-emerald-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const gradeColor = (grade: string) => {
    if (grade === 'A' || grade === 'A+') return 'text-emerald-600'
    if (grade === 'B' || grade === 'B+') return 'text-blue-600'
    if (grade === 'C' || grade === 'C+') return 'text-amber-600'
    return 'text-red-600'
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            AI Insights for {memberName}
          </DialogTitle>
          <DialogDescription>
            Predictive analytics and personalized recommendations
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            <p className="text-sm text-gray-500">Analyzing member data...</p>
          </div>
        )}

        {error && !loading && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-5">
            {/* Churn Prediction */}
            {churn && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-gray-500" />
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Churn Prediction</h3>
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      'inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border',
                      riskColor(churn.risk_level)
                    )}>
                      {churn.risk_level} Risk
                    </span>
                    <span className="text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">
                      {typeof churn.risk_score === 'number' ? `${Math.round(churn.risk_score * 100)}%` : '--'}
                    </span>
                  </div>
                  {churn.narrative && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{churn.narrative}</p>
                  )}
                  {churn.factors?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Contributing Factors</p>
                      <ul className="space-y-1">
                        {churn.factors.map((f, i) => (
                          <li key={i} className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-1.5">
                            <span className="text-gray-300 mt-0.5">-</span>
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Health Score */}
            {health && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Heart className="h-4 w-4 text-gray-500" />
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Health Score</h3>
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className={cn('text-3xl font-black tabular-nums', gradeColor(health.grade ?? ''))}>
                      {health.grade ?? '--'}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                        {typeof health.score === 'number' ? `${health.score}/100` : '--'}
                      </p>
                      <p className="text-[10px] text-gray-400">Overall Health</p>
                    </div>
                  </div>
                  {health.summary && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{health.summary}</p>
                  )}
                  {health.dimensions && Object.keys(health.dimensions).length > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(health.dimensions).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-900 px-3 py-2">
                          <span className="text-[11px] text-gray-500 capitalize">{key.replace(/_/g, ' ')}</span>
                          <span className="text-xs font-bold text-gray-900 dark:text-gray-100 tabular-nums">{value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {recs?.recommendations?.length ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-gray-500" />
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Recommendations</h3>
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
                  {recs.recommendations.map((rec, i) => (
                    <div key={i} className="p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">{rec.title}</p>
                        <span className={cn(
                          'text-[10px] font-bold uppercase px-1.5 py-0.5 rounded',
                          rec.priority === 'high' ? 'bg-red-50 text-red-600' :
                          rec.priority === 'medium' ? 'bg-amber-50 text-amber-600' :
                          'bg-gray-50 text-gray-500'
                        )}>
                          {rec.priority}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">{rec.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Empty state */}
            {!churn && !health && !recs && (
              <div className="py-8 text-center">
                <ShieldCheck className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No AI insights available for this member yet.</p>
                <p className="text-xs text-gray-400 mt-1">Insights are generated as member activity data accumulates.</p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
