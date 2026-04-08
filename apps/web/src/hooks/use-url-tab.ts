'use client'

import { useMemo, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

/**
 * Shared hook for URL-based tab navigation.
 * Stores the active tab in the URL query string so it survives page refresh
 * and supports deep-linking.
 *
 * Usage:
 *   const [activeTab, setActiveTab] = useUrlTab(['Overview', 'Members', 'Settings'], 'Overview', '/revenue')
 */
export function useUrlTab<T extends string>(
  validTabs: readonly T[],
  defaultTab: T,
  basePath: string,
  paramName = 'tab',
): [T, (tab: T) => void] {
  const searchParams = useSearchParams()
  const router = useRouter()

  const activeTab = useMemo(() => {
    const param = searchParams.get(paramName)
    if (param && (validTabs as readonly string[]).includes(param)) return param as T
    return defaultTab
  }, [searchParams, paramName, validTabs, defaultTab])

  const setActiveTab = useCallback(
    (tab: T) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set(paramName, tab)
      router.replace(`${basePath}?${params.toString()}`, { scroll: false })
    },
    [searchParams, router, basePath, paramName],
  )

  return [activeTab, setActiveTab]
}
