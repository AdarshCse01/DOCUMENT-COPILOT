/**
 * supabase.ts — the single browser Supabase client for the whole app.
 *
 * Import `supabase` wherever you need auth (sign in/out, session, user).
 * Never import createClient directly elsewhere — keep all auth surface here.
 */

import { createClient } from '@supabase/supabase-js'
import { env } from './env'

export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: {
    // Persist the session in localStorage so the user stays signed in on reload
    persistSession: true,
    // Auto-refresh the JWT before it expires
    autoRefreshToken: true,
    // Detect OAuth redirects automatically
    detectSessionInUrl: true,
  },
})

/** Convenience: get the current access token (or null if not signed in). */
export async function getAccessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session?.access_token ?? null
}
