import { format, formatDistanceToNow, differenceInMinutes, addDays, isAfter, isBefore } from 'date-fns'

export function formatDate(date: string | Date): string {
  return format(new Date(date), 'MMM d, yyyy')
}

export function formatTime(time: string): string {
  // Convert "17:00" → "5:00 PM"
  const [hours, minutes] = time.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
}

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), 'MMM d, yyyy h:mm a')
}

export function timeAgo(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

/**
 * Check if a cancellation is "late" (within the cancellation window).
 * Default window: 60 minutes before class start.
 */
export function isLateCancellation(
  classStartTime: Date,
  cancellationTime: Date = new Date(),
  windowMinutes: number = 60
): boolean {
  const minutesUntilClass = differenceInMinutes(classStartTime, cancellationTime)
  return minutesUntilClass < windowMinutes && minutesUntilClass >= 0
}

/**
 * Calculate credit expiry date with grace period.
 * Default: 7-day grace period.
 */
export function calculateGracePeriodEnd(expiryDate: string | Date, graceDays: number = 7): Date {
  return addDays(new Date(expiryDate), graceDays)
}

/**
 * Check if credits are in the grace period (expired but within grace window).
 */
export function isInGracePeriod(expiryDate: string | Date, graceDays: number = 7): boolean {
  const now = new Date()
  const expiry = new Date(expiryDate)
  const graceEnd = addDays(expiry, graceDays)
  return isAfter(now, expiry) && isBefore(now, graceEnd)
}

/**
 * Calculate waitlist claim deadline.
 * 15-min window, but shortened if class starts sooner.
 */
export function calculateClaimDeadline(
  classStartTime: Date,
  offerTime: Date = new Date(),
  maxWindowMinutes: number = 15
): Date {
  const minutesUntilClass = differenceInMinutes(classStartTime, offerTime)

  if (minutesUntilClass <= 0) {
    // Class already started — no claim window
    return offerTime
  }

  // Window is the shorter of: max window or (time until class - 5 min buffer)
  const effectiveWindow = Math.min(maxWindowMinutes, Math.max(minutesUntilClass - 5, 1))
  return new Date(offerTime.getTime() + effectiveWindow * 60 * 1000)
}
