/**
 * ChatThreadPage.tsx — Route component for /chat/:threadId and /chats/:threadId
 *
 * Responsibilities:
 *  1. Load persisted message history from GET /chat/threads/:threadId/messages on mount.
 *  2. Maintain a single unified message state through useChatStream to prevent duplicate bubbles.
 *  3. Connect the useChatStream hook to POST /chat/stream with bearer token & threadId.
 *  4. Handle live streaming status updates from the retrieval -> agent -> grounding pipeline.
 *  5. Manage active CitationItem selection and render the SourcePassagePanel.
 *  6. Display messages via MessageList and MessageInput, with live streaming indicator.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { AlertCircle, LogIn } from 'lucide-react'
import { listThreadMessages, type ChatMessage, type CitationItem } from '@/lib/api'
import { MessageList, type UIMessage } from '@/components/chat/MessageList'
import { MessageInput } from '@/components/chat/MessageInput'
import { SourcePassagePanel } from '@/components/chat/SourcePassagePanel'
import { useChatContext } from '@/components/chat/useChatContext'
import { useChatStream } from '@/hooks/useChatStream'
import { Button } from '@/components/ui/button'

/** Convert a persisted ChatMessage row into the UIMessage shape used by MessageList. */
function toUIMessage(msg: ChatMessage): UIMessage {
  return {
    id: msg.id,
    role: msg.role,
    content: msg.content,
    parts: msg.parts ?? undefined,
  }
}

/** Deduplicate messages to ensure no duplicate bubbles ever render */
function deduplicateMessages(msgs: UIMessage[]): UIMessage[] {
  const result: UIMessage[] = []
  const seenIds = new Set<string>()

  for (const m of msgs) {
    if (m.id && seenIds.has(m.id)) continue
    if (m.id) seenIds.add(m.id)

    // Deduplicate consecutive identical messages (e.g. from race conditions)
    if (
      m.role === 'user' &&
      result.length > 0 &&
      result[result.length - 1].role === 'user' &&
      result[result.length - 1].content?.trim() === m.content?.trim()
    ) {
      continue
    }
    result.push(m)
  }
  return result
}

export default function ChatThreadPage() {
  const { threadId } = useParams<{ threadId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const { refreshThreads } = useChatContext()

  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)

  // Currently selected citation to inspect in the SourcePassagePanel
  const [selectedCitation, setSelectedCitation] = useState<CitationItem | null>(null)

  // Guard to ensure initial prompt only fires once per thread navigation
  const initialPromptDispatched = useRef<string | null>(null)

  // ─── Native AI Stream Hook (Single Source of Truth for Messages) ─────────
  const {
    messages,
    setMessages,
    input,
    handleInputChange,
    handleSubmit,
    sendMessage,
    isLoading,
    liveStatus,
    error,
    stop,
  } = useChatStream({
    threadId: threadId || '',
    onFinish: refreshThreads,
  })

  // ─── Load persisted history from Database ─────────────────────────────────
  useEffect(() => {
    if (!threadId) return

    let cancelled = false
    void (async () => {
      setSelectedCitation(null)
      setHistoryLoading(true)
      setHistoryError(null)

      try {
        const msgs = await listThreadMessages(threadId)
        if (!cancelled) {
          const uiMsgs = msgs.map(toUIMessage)
          setMessages(uiMsgs)
        }
      } catch (err: unknown) {
        if (!cancelled) {
          console.error('Failed to load message history:', err)
          const errMsg =
            err instanceof Error ? err.message : 'Could not load conversation history.'
          setHistoryError(errMsg)
        }
      } finally {
        if (!cancelled) {
          setHistoryLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [threadId, setMessages])

  // ─── Fire initial prompt from ChatWelcomePage navigation state ───────────
  useEffect(() => {
    const initialPrompt = (location.state as { initialPrompt?: string } | null)?.initialPrompt
    if (!initialPrompt || !threadId) return

    const dispatchKey = `${threadId}:${initialPrompt.trim()}`
    if (initialPromptDispatched.current === dispatchKey) return

    if (!historyLoading && messages.length === 0) {
      initialPromptDispatched.current = dispatchKey
      // Clear location state cleanly without triggering route re-renders
      window.history.replaceState({}, document.title)
      void sendMessage(initialPrompt)
    }
  }, [historyLoading, messages.length, threadId, location.state, sendMessage])

  // ─── Deduplicated Messages List for Display ──────────────────────────────
  const displayMessages = useMemo(() => deduplicateMessages(messages), [messages])

  // Detect 401 Unauthorized / Token Expired
  const isAuthError =
    (error && error.message && error.message.includes('401')) ||
    (historyError && historyError.includes('401'))

  // ─── Render ───────────────────────────────────────────────────────────────
  if (historyError && !isAuthError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-foreground font-medium">{historyError}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => navigate(0)}
          className="cursor-pointer"
        >
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="relative flex h-full w-full overflow-hidden bg-white">
      {/* Left / Main Chat Column */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Auth Error Banner */}
        {isAuthError && (
          <div className="flex items-center justify-between border-b border-destructive/30 bg-destructive/10 px-4 py-2.5 text-xs text-destructive">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Your session has expired. Please sign in again to continue.</span>
            </div>
            <button
              type="button"
              onClick={() => navigate('/sign-in')}
              className="inline-flex items-center gap-1 font-semibold underline hover:no-underline cursor-pointer"
            >
              <LogIn className="h-3 w-3" />
              Sign in
            </button>
          </div>
        )}

        {/* Message History + Live Stream */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {historyLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <span className="text-sm text-zinc-400 animate-pulse">
                Loading conversation…
              </span>
            </div>
          ) : (
            <MessageList
              messages={displayMessages}
              isLoading={isLoading}
              error={error ?? null}
              streamingStatus={liveStatus}
              selectedCitation={selectedCitation}
              onSelectCitation={(citation) => setSelectedCitation(citation)}
            />
          )}
        </div>

        {/* Input Bar */}
        <MessageInput
          input={input}
          onChange={handleInputChange}
          onSubmit={handleSubmit}
          isLoading={isLoading}
          onStop={stop}
        />
      </div>

      {/* Right / Source Passage Side Panel (slides in on citation click) */}
      {selectedCitation && (
        <div className="absolute inset-y-0 right-0 z-30 md:static flex shrink-0">
          <SourcePassagePanel
            citation={selectedCitation}
            onClose={() => setSelectedCitation(null)}
          />
        </div>
      )}
    </div>
  )
}
