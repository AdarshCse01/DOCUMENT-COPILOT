/**
 * api.ts — typed API calls to the FastAPI backend.
 *
 * All functions here use http.ts, so they are automatically authenticated.
 * Add new endpoints here as phases progress (chat, ingest, retrieval…).
 */

import { del, get, patch, post } from './http'

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface UserRecord {
  id: string
  email: string
}

/**
 * GET /auth/me — verify the current session against the backend.
 * Throws HttpError(401) if the token is missing or expired.
 */
export const getMe = () => get<UserRecord>('/auth/me')

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export interface HealthResponse {
  status: string
}

/** GET /health — quick liveness check (no auth required). */
export const getHealth = () => get<HealthResponse>('/health')

// ---------------------------------------------------------------------------
// Chat Threads & Messages (Phase 3)
// ---------------------------------------------------------------------------

export interface ChatThread {
  id: string
  user_id: string
  title: string
  created_at: string
  updated_at: string
}

export interface CitationItem {
  chunk_id: string
  ticker: string
  form: string
  filing_date: string
  fiscal_year?: number | null
  page?: number | null
  section?: string | null
  excerpt: string
  relevance_explanation?: string | null
}

export interface ChatMessagePart {
  type: string
  text?: string
  citations?: CitationItem[]
  [key: string]: unknown
}

export interface ChatMessage {
  id: string
  thread_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  parts?: ChatMessagePart[] | null
  created_at: string
}

/** GET /chat/threads — lists caller's threads sorted by updated_at desc. */
export const listThreads = () => get<ChatThread[]>('/chat/threads')

/** POST /chat/threads — creates a new thread. */
export const createThread = (title?: string) =>
  post<ChatThread>('/chat/threads', { title: title?.trim() || 'New Chat' })


/** GET /chat/threads/:threadId — gets thread metadata. */
export const getThread = (threadId: string) =>
  get<ChatThread>(`/chat/threads/${threadId}`)

/** PATCH /chat/threads/:threadId — updates thread title. */
export const updateThreadTitle = (threadId: string, title: string) =>
  patch<ChatThread>(`/chat/threads/${threadId}`, { title })

/** DELETE /chat/threads/:threadId — deletes thread and messages. */
export const deleteThread = (threadId: string) =>
  del<void>(`/chat/threads/${threadId}`)

/** GET /chat/threads/:threadId/messages — loads message history. */
export const listThreadMessages = (threadId: string) =>
  get<ChatMessage[]>(`/chat/threads/${threadId}/messages`)
