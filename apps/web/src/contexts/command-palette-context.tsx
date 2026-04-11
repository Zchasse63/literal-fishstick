'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

/**
 * Tier 8.5.A6/A7 — Command Palette + Universal Search shared context.
 *
 * The palette and the universal search are the same overlay with two modes:
 * `command` (Cmd+K) and `search` ("/"). Mode determines the default empty
 * state and the placeholder text; query drives the remote entity search
 * when mode === 'search'.
 *
 * Legacy API (`open`, `setOpen`) is preserved so existing header trigger
 * sites keep compiling without changes.
 */
export type PaletteMode = 'command' | 'search'

interface CommandPaletteState {
  open: boolean
  setOpen: (v: boolean) => void
  mode: PaletteMode
  setMode: (m: PaletteMode) => void
  query: string
  setQuery: (q: string) => void
  /** Convenience: opens the palette in a specific mode. */
  openWithMode: (m: PaletteMode) => void
}

const CommandPaletteContext = createContext<CommandPaletteState>({
  open: false,
  setOpen: () => {},
  mode: 'command',
  setMode: () => {},
  query: '',
  setQuery: () => {},
  openWithMode: () => {},
})

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<PaletteMode>('command')
  const [query, setQuery] = useState('')

  // Reset query on close so the next open starts fresh.
  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  const openWithMode = useCallback((m: PaletteMode) => {
    setMode(m)
    setOpen(true)
  }, [])

  return (
    <CommandPaletteContext.Provider
      value={{ open, setOpen, mode, setMode, query, setQuery, openWithMode }}
    >
      {children}
    </CommandPaletteContext.Provider>
  )
}

export const useCommandPalette = () => useContext(CommandPaletteContext)
