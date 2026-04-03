'use client'

import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import type { User, Session } from '@supabase/supabase-js'

// ─── Types ──────────────────────────────────────────────────

interface Profile {
  id: string
  email: string
  full_name: string
  avatar_url: string | null
  roles: string[] // ['admin', 'member', 'trainer', etc.]
  studio_id: string
}

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  studioId: string
  signOut: () => Promise<void>
  isAdmin: boolean
  isTrainer: boolean
  isMember: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// ─── Provider ───────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const supabase = useMemo(
    () => createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
    ),
    [],
  )

  // Default studio for The Sauna Guys
  const studioId = profile?.studio_id ?? '11111111-1111-1111-1111-111111111111'

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('id, email, full_name, avatar_url, roles, studio_id')
      .eq('id', userId)
      .single()

    if (data) {
      setProfile(data as Profile)
    }
  }, [supabase])

  useEffect(() => {
    // Verify the current user with the server (more secure than getSession which only reads local storage)
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u ?? null)
      if (u) {
        // Also get the session for token access
        supabase.auth.getSession().then(({ data: { session: s } }) => {
          setSession(s)
        })
        fetchProfile(u.id)
      }
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, s) => {
        setSession(s)
        setUser(s?.user ?? null)
        if (s?.user) {
          await fetchProfile(s.user.id)
        } else {
          setProfile(null)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [supabase, fetchProfile])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    setProfile(null)
  }, [supabase])

  const roles = profile?.roles ?? []
  const isAdmin = roles.includes('admin') || roles.includes('owner')
  const isTrainer = roles.includes('trainer')
  const isMember = roles.includes('member')

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        studioId,
        signOut,
        isAdmin,
        isTrainer,
        isMember,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// ─── Hook ───────────────────────────────────────────────────

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
