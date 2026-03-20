'use client'

import { useEffect, useRef } from 'react'
import { useSupabase } from './use-supabase'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE'

export interface RealtimeChange<T = Record<string, unknown>> {
  event: RealtimeEvent
  new: T | null
  old: Partial<T> | null
  table: string
}

export type RealtimeCallback<T = Record<string, unknown>> = (
  change: RealtimeChange<T>,
) => void

// ---------------------------------------------------------------------------
// useRealtimeSubscription
// ---------------------------------------------------------------------------

/**
 * Subscribe to Supabase Realtime Postgres changes on a given table.
 *
 * The callback fires for every INSERT, UPDATE, and DELETE on the table.
 * The subscription is automatically cleaned up when the component unmounts
 * or when `table` changes.
 *
 * @param table    - The Postgres table to watch.
 * @param callback - Called with a `RealtimeChange` payload on each event.
 * @param options  - Optional configuration.
 * @param options.event  - Restrict to a specific event type (default: all).
 * @param options.filter - PostgREST-style filter string, e.g. `studio_id=eq.xxx`.
 * @param options.enabled - Pass `false` to disable the subscription.
 */
export function useRealtimeSubscription<T = Record<string, unknown>>(
  table: string,
  callback: RealtimeCallback<T>,
  options: {
    event?: RealtimeEvent | '*'
    filter?: string
    enabled?: boolean
  } = {},
): void {
  const supabase = useSupabase()
  const { event = '*', filter, enabled = true } = options

  // Keep callback ref stable so we don't re-subscribe on every render.
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (!enabled) return

    const channelName = `realtime:${table}:${event}:${filter ?? 'all'}`

    const channelConfig: Record<string, unknown> = {
      event,
      schema: 'public',
      table,
    }

    if (filter) {
      channelConfig.filter = filter
    }

    const channel: RealtimeChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes' as any,
        channelConfig,
        (payload: RealtimePostgresChangesPayload<T & Record<string, unknown>>) => {
          callbackRef.current({
            event: payload.eventType as RealtimeEvent,
            new: (payload.new as T) ?? null,
            old: (payload.old as Partial<T>) ?? null,
            table,
          })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, table, event, filter, enabled])
}
