import { AIInsightsClient } from './_components/AIInsightsClient'

export default function AIInsightsPage() {
  // Insights are fetched from internal API routes (/api/ai/insights) which
  // cannot be called from RSC without a full URL. The client component handles
  // its own data fetching via those API routes. We pass empty initial data and
  // the client fetches on mount.
  return <AIInsightsClient initialInsights={[]} initialHistory={[]} />
}
