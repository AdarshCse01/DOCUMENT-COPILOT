/**
 * ChatContext.ts — Shared React context for chat state.
 *
 * Kept in its own file so react-refresh/only-export-components is satisfied
 * (ChatLayout.tsx exports the ChatLayout component; this file exports the context).
 */

import { createContext } from 'react'
import type { ChatThread } from '@/lib/api'

export interface ChatContextValue {
  threads: ChatThread[]
  refreshThreads: () => Promise<void>
  activeThreadId?: string
}

export const ChatContext = createContext<ChatContextValue | null>(null)
