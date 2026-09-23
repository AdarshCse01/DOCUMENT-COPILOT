/**
 * useAuth.ts — reactive hook for Supabase session state.
 *
 * Returns the current user and a loading flag. Components that depend on
 * auth state should use this hook rather than calling supabase.auth directly.
 */

import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthState {
  user: User | null
  loading: boolean
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, loading: true })

  useEffect(() => {
    // Hydrate from the persisted session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState({ user: session?.user ?? null, loading: false })
    })

    // Keep in sync with sign-in / sign-out events
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ user: session?.user ?? null, loading: false })
    })

    return () => subscription.unsubscribe()
  }, [])

  return state
}
