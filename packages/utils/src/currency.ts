/**
 * Format cents to a dollar string.
 * formatCents(22500) → "$225.00"
 * formatCents(3900) → "$39.00"
 */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

/**
 * Format cents to a compact dollar string (no decimals if whole).
 * formatCentsCompact(22500) → "$225"
 * formatCentsCompact(3950) → "$39.50"
 */
export function formatCentsCompact(cents: number): string {
  const dollars = cents / 100
  if (Number.isInteger(dollars)) {
    return `$${dollars}`
  }
  return formatCents(cents)
}

/**
 * Calculate member discount (10%).
 * Returns the discount amount in cents.
 */
export function calculateMemberDiscount(subtotalCents: number): number {
  return Math.round(subtotalCents * 0.10)
}

/**
 * Calculate trainer promo commission (10%).
 * Returns the commission amount in cents.
 */
export function calculatePromoCommission(saleAmountCents: number): number {
  return Math.round(saleAmountCents * 0.10)
}
