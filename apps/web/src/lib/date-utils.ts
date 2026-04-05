/**
 * Centralized date formatting utilities.
 *
 * TODO: Migrate existing inline date formatting across the codebase
 * (e.g. `new Date(x).toLocaleDateString(...)`) to use these helpers
 * for consistent output and easier i18n in the future.
 */

/**
 * Formats a date as a human-readable relative time string.
 * Examples: "Just now", "5 min ago", "3 hours ago", "2 days ago", "1 week ago"
 */
export function formatRelativeTime(date: string | Date): string {
  const now = Date.now()
  const then = new Date(date).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60_000)

  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin} min ago`

  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr} hour${diffHr > 1 ? 's' : ''} ago`

  const diffDays = Math.floor(diffHr / 24)
  if (diffDays === 1) return '1 day ago'
  if (diffDays < 7) return `${diffDays} days ago`

  const diffWeeks = Math.floor(diffDays / 7)
  return `${diffWeeks} week${diffWeeks > 1 ? 's' : ''} ago`
}

/**
 * Formats a date as a short localized string.
 * Example: "Apr 5, 2026"
 */
export function formatShortDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * Formats a date's time component.
 * Example: "5:00 PM"
 */
export function formatTime(date: string | Date): string {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}
