/**
 * ProtectedRoute.tsx — redirects unauthenticated users to /sign-in.
 *
 * Wrap any route element with this component to require authentication.
 * Shows nothing while the session is loading to prevent flashing.
 */

import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export function ProtectedRoute() {
  const { user, loading } = useAuth()

  // Don't render anything until we know whether the user is signed in.
  // This prevents an unauthenticated flash before the session hydrates.
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return user ? <Outlet /> : <Navigate to="/sign-in" replace />
}
