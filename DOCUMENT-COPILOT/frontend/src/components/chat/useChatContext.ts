/**
 * useChatContext.ts - Hook to consume the ChatContext provided by ChatLayout.
 *
 * Kept in its own file so that react-refresh/only-export-components is satisfied.
 */

import { useContext } from 'react'
import { ChatContext } from './ChatContext'

export function useChatContext() {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error('useChatContext must be used within ChatLayout')
  }
  return context
}
