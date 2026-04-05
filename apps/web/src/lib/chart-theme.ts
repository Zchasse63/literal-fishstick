/**
 * Shared chart color constants for Recharts.
 * All chart components should import from here for consistency.
 */

export const CHART_COLORS = {
  primary: '#4F46E5',    // indigo-600
  secondary: '#8B5CF6',  // violet-500
  success: '#10B981',    // emerald-500
  warning: '#F59E0B',    // amber-400
  danger: '#EF4444',     // red-500
  muted: '#C7D2FE',      // indigo-200
}

export const CHART_GRID = { light: '#F3F4F6', dark: '#374151' }
export const CHART_AXIS = { light: '#6B7280', dark: '#9CA3AF' }
export const CHART_TICK = { light: '#6B7280', dark: '#D1D5DB' }

/** Returns true if the document has the `dark` class on <html>. SSR-safe. */
export function isDarkMode(): boolean {
  return typeof window !== 'undefined' && document.documentElement.classList.contains('dark')
}

/** Returns resolved chart theme values for the current color scheme. */
export function getChartTheme() {
  const dark = isDarkMode()
  return {
    gridColor: dark ? CHART_GRID.dark : CHART_GRID.light,
    axisColor: dark ? CHART_AXIS.dark : CHART_AXIS.light,
    tickColor: dark ? CHART_TICK.dark : CHART_TICK.light,
  }
}
