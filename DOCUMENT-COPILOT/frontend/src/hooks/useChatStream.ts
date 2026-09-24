import { useCallback, useRef, useState, useEffect } from 'react'
import { env } from '@/lib/env'
import { getAccessToken } from '@/lib/supabase'
import type { CitationItem } from '@/lib/api'
import type { UIMessage } from '@/components/chat/MessageList'

interface UseChatStreamOptions {
  threadId: string
  onFinish?: () => void
}

export function useChatStream({ threadId, onFinish }: UseChatStreamOptions) {
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [liveStatus, setLiveStatus] = useState('Searching SEC filings & generating answer…')
  const [liveCitations, setLiveCitations] = useState<CitationItem[]>([])

  const abortControllerRef = useRef<AbortController | null>(null)
  const messagesRef = useRef<UIMessage[]>([])
  messagesRef.current = messages

  // Reset messages when switching threads
  useEffect(() => {
    setMessages([])
    setError(null)
    setIsLoading(false)
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }, [threadId])

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsLoading(false)
  }, [])

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setInput(e.target.value)
    },
    [],
  )

  const sendMessage = useCallback(
    async (customPrompt?: string) => {
      const promptToSend = (customPrompt !== undefined ? customPrompt : input).trim()
      if (!promptToSend || isLoading) return

      if (customPrompt === undefined) {
        setInput('')
      }

      setError(null)
      setIsLoading(true)
      setLiveStatus('Analyzing query & searching SEC filings…')
      setLiveCitations([])

      const userMsg: UIMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: promptToSend,
      }

      const assistantMsgId = crypto.randomUUID()
      const assistantMsg: UIMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        parts: [],
      }

      setMessages((prev) => [...prev, userMsg, assistantMsg])

      const abortController = new AbortController()
      abortControllerRef.current = abortController

      try {
        const token = await getAccessToken()
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        }

        // Prepare message history in AI SDK format
        const historyForBackend = [...messagesRef.current, userMsg].map((m) => ({
          role: m.role,
          content: m.content || '',
        }))

        const res = await fetch(`${env.API_BASE_URL}/chat/stream`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            threadId,
            messages: historyForBackend,
          }),
          signal: abortController.signal,
        })

        if (!res.ok) {
          let errText = `HTTP ${res.status}`
          try {
            const errJson = await res.json()
            errText = errJson.detail || errText
          } catch {
            errText = await res.text() || errText
          }
          throw new Error(errText)
        }

        if (!res.body) {
          throw new Error('No response stream returned from server.')
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let currentAssistantText = ''
        const collectedCitations: CitationItem[] = []

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed) continue

            // 0:"text delta"
            if (trimmed.startsWith('0:')) {
              try {
                const textDelta = JSON.parse(trimmed.slice(2))
                if (typeof textDelta === 'string') {
                  currentAssistantText += textDelta
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsgId
                        ? {
                            ...m,
                            content: currentAssistantText,
                            parts: [
                              { type: 'text', text: currentAssistantText },
                              ...(collectedCitations.length > 0
                                ? [{ type: 'citations', citations: collectedCitations }]
                                : []),
                            ],
                          }
                        : m,
                    ),
                  )
                }
              } catch (parseErr) {
                console.error('Failed to parse text delta:', parseErr)
              }
            } else if (trimmed.startsWith('2:')) {
              // 2:[{"type":"status",...}] or 2:[{"type":"citations",...}]
              try {
                const dataArray = JSON.parse(trimmed.slice(2))
                if (Array.isArray(dataArray)) {
                  for (const item of dataArray) {
                    if (item?.type === 'status' && item.message) {
                      setLiveStatus(item.message)
                    }
                    if (item?.type === 'citations' && Array.isArray(item.citations)) {
                      collectedCitations.push(...item.citations)
                      setLiveCitations([...collectedCitations])
                      setMessages((prev) =>
                        prev.map((m) =>
                          m.id === assistantMsgId
                            ? {
                                ...m,
                                parts: [
                                  { type: 'text', text: currentAssistantText },
                                  { type: 'citations', citations: collectedCitations },
                                ],
                              }
                            : m,
                        ),
                      )
                    }
                  }
                }
              } catch (parseErr) {
                console.error('Failed to parse data part:', parseErr)
              }
            } else if (trimmed.startsWith('3:')) {
              // 3:"error message"
              try {
                const errMsg = JSON.parse(trimmed.slice(2))
                throw new Error(String(errMsg))
              } catch (e) {
                throw e instanceof Error ? e : new Error(String(e))
              }
            }
          }
        }

        onFinish?.()
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          return
        }
        console.error('Streaming error:', err)
        setError(err instanceof Error ? err : new Error(String(err)))
        // Remove empty assistant placeholder if no content was received before error
        setMessages((prev) =>
          prev.filter((m) => !(m.id === assistantMsgId && !m.content?.trim())),
        )
      } finally {
        setIsLoading(false)
        abortControllerRef.current = null
      }
    },
    [input, isLoading, messages, threadId, onFinish],
  )

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault()
      void sendMessage()
    },
    [sendMessage],
  )

  return {
    messages,
    setMessages,
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    sendMessage,
    isLoading,
    liveStatus,
    liveCitations,
    error,
    stop,
  }
}
