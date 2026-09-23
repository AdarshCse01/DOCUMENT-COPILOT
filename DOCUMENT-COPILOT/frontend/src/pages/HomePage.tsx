/**
 * HomePage.tsx — authenticated landing page (Phase 2 placeholder).
 *
 * Shows the signed-in user's email and performs a live backend auth check
 * by calling GET /auth/me with the Supabase token. This proves the full
 * auth loop: browser → FastAPI → Supabase → response.
 *
 * Will be replaced by the chat UI in Phase 3.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMe, type UserRecord } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'

export default function HomePage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [backendUser, setBackendUser] = useState<UserRecord | null>(null)
  const [backendError, setBackendError] = useState<string | null>(null)

  // Call GET /auth/me on mount to verify the backend can see the session
  useEffect(() => {
    getMe()
      .then(setBackendUser)
      .catch((err: unknown) => {
        setBackendError(err instanceof Error ? err.message : 'Unknown error')
      })
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/sign-in', { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          Document Copilot
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Signed in as <strong>{user?.email}</strong>
        </p>
      </div>

      {/* Backend auth check card */}
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm">
        <h2 className="mb-1 font-medium">Backend auth check</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          This calls <code className="rounded bg-muted px-1 py-0.5 text-xs">GET /me</code> with your Supabase token.
        </p>

        {backendError ? (
          <p className="text-sm text-destructive">
            ❌ {backendError}
          </p>
        ) : backendUser ? (
          <p className="text-sm text-foreground">
            Backend verified{' '}
            <strong>{backendUser.email}</strong>{' '}
            <span className="text-muted-foreground">({backendUser.id})</span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Checking…</p>
        )}
      </div>

      {/* Sign out */}
      <button
        id="sign-out-btn"
        onClick={handleSignOut}
        className="rounded-md border border-input px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
      >
        Sign out
      </button>
    </div>
  )
}
