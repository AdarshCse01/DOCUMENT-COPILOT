/**
 * http.ts — thin fetch wrapper that automatically injects the Supabase JWT.
 *
 * Use this instead of raw fetch() so every backend request is authenticated.
 * api.ts builds typed helpers on top of this.
 */

import { env } from './env'
import { getAccessToken } from './supabase'

export class HttpError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, body: unknown) {
    super(`HTTP ${status}`)
    this.name = 'HttpError'
    this.status = status
    this.body = body
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown
}

/**
 * Authenticated fetch against the FastAPI backend.
 *
 * - Prepends env.API_BASE_URL to the path.
 * - Injects `Authorization: Bearer <token>` if a session exists.
 * - Sets `Content-Type: application/json` when a body is provided.
 * - Throws HttpError for non-2xx responses so callers can handle 401/403.
 */
export async function http<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, headers: extraHeaders, ...rest } = options

  const token = await getAccessToken()

  const hasBody = body !== undefined && body !== null
  const headers: Record<string, string> = {
    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    ...(extraHeaders as Record<string, string>),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  const response = await fetch(`${env.API_BASE_URL}${path}`, {
    ...rest,
    headers,
    ...(hasBody
      ? { body: typeof body === 'string' ? body : JSON.stringify(body) }
      : {}),
  })

  if (!response.ok) {
    let errorBody: unknown
    try {
      errorBody = await response.json()
    } catch {
      errorBody = await response.text()
    }
    throw new HttpError(response.status, errorBody)
  }

  // 204 No Content — return undefined cast to T
  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

/** Convenience wrappers */
export const get = <T>(path: string, options?: RequestOptions) =>
  http<T>(path, { method: 'GET', ...options })

export const post = <T>(path: string, body?: unknown, options?: RequestOptions) =>
  http<T>(path, { method: 'POST', body, ...options })

export const patch = <T>(path: string, body?: unknown, options?: RequestOptions) =>
  http<T>(path, { method: 'PATCH', body, ...options })

export const del = <T>(path: string, options?: RequestOptions) =>
  http<T>(path, { method: 'DELETE', ...options })
