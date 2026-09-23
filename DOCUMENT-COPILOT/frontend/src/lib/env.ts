/**
 * env.ts — the only place that reads import.meta.env.
 *
 * Throws at startup if a required variable is missing so the error is obvious
 * in the browser console rather than a silent empty string later.
 */

function requireEnv(key: string): string {
  const value = import.meta.env[key]
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}\n` +
        `Make sure it is defined in frontend/.env (see .env.example).`,
    )
  }
  return value as string
}

export const env = {
  /** Base URL for the FastAPI backend, e.g. http://localhost:8000 */
  API_BASE_URL: requireEnv('VITE_API_BASE_URL'),

  /** Supabase project URL */
  SUPABASE_URL: requireEnv('VITE_SUPABASE_URL'),

  /** Supabase anon/public key — safe to expose in the browser */
  SUPABASE_ANON_KEY: requireEnv('VITE_SUPABASE_ANON_KEY'),
} as const
