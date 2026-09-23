/**
 * ChatThreadPage.tsx — Route component for /chat/:threadId
 *
 * Responsibilities:
 *  1. Load persisted message history from GET /chat/threads/:threadId/messages on mount.
 *  2. Connect the useChatStream hook to POST /chat/stream with bearer token & threadId.
 *  3. Handle live streaming status updates from the retrieval -> agent -> grounding pipeline.
 *  4. Manage active CitationItem selection and render the SourcePassagePanel.
 *  5. Display messages via MessageList and MessageInput, with live streaming indicator.
 */

import { useEffect, useRef, useState } from 'react'
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

export default function ChatThreadPage() {
  const { threadId } = useParams<{ threadId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const { refreshThreads } = useChatContext()

  // History fetched from the DB (rendered before live streaming messages)
  const [history, setHistory] = useState<UIMessage[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)

  // Currently selected citation to inspect in the SourcePassagePanel
  const [selectedCitation, setSelectedCitation] = useState<CitationItem | null>(null)

  // Guard so we only fire the initial prompt once per navigation
  const initialPromptFired = useRef(false)

  // ─── Native AI Stream Hook ────────────────────────────────────────────────
  const {
    messages,
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

  // ─── Load persisted history ───────────────────────────────────────────────
  useEffect(() => {
    if (!threadId) return
    initialPromptFired.current = false

    void (async () => {
      setSelectedCitation(null)
      setHistoryLoading(true)
      setHistoryError(null)
      setHistory([])
      try {
        const msgs = await listThreadMessages(threadId)
        setHistory(msgs.map(toUIMessage))
      } catch (err: unknown) {
        console.error('Failed to load message history:', err)
        const errMsg = err instanceof Error ? err.message : 'Could not load conversation history.'
        setHistoryError(errMsg)
      } finally {
        setHistoryLoading(false)
      }
    })()
  }, [threadId])

  // ─── Fire initial prompt from ChatWelcomePage navigation state ───────────
  useEffect(() => {
    const initialPrompt = (location.state as { initialPrompt?: string } | null)?.initialPrompt
    if (
      initialPrompt &&
      !initialPromptFired.current &&
      !historyLoading &&
      history.length === 0 &&
      messages.length === 0
    ) {
      initialPromptFired.current = true
      // Clear the navigation state so a page refresh does not re-fire the prompt
      navigate(location.pathname, { replace: true, state: {} })
      void sendMessage(initialPrompt)
    }
  }, [historyLoading, history.length, messages.length, location, navigate, sendMessage])

  // ─── Merge DB history + live streaming messages for display ─────────────
  const liveMessageIds = new Set(messages.map((m) => m.id))
  const dedupedHistory = history.filter((h) => !liveMessageIds.has(h.id))
  const displayMessages: UIMessage[] = [...dedupedHistory, ...messages]

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
    <div className="relative flex h-full w-full overflow-hidden">
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
              <span className="text-sm text-muted-foreground animate-pulse">
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
