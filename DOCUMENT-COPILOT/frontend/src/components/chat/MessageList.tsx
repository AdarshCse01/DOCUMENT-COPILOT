import React, { useEffect, useRef } from 'react'
import { Bot, User as UserIcon, AlertCircle, AlertTriangle } from 'lucide-react'
import { StreamingIndicator } from './StreamingIndicator'
import { CitationChip } from './CitationChip'
import type { CitationItem } from '@/lib/api'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

export interface UIMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content?: string
  parts?: Array<{
    type: string
    text?: string
    citations?: CitationItem[]
    [key: string]: unknown
  }>
}

function getMessageText(message: UIMessage): string {
  if (message.parts && message.parts.length > 0) {
    const textParts = message.parts
      .filter((p) => p.type === 'text' && typeof p.text === 'string')
      .map((p) => p.text)
    if (textParts.length > 0) {
      return textParts.join('')
    }
  }
  return message.content || ''
}

function getMessageCitations(message: UIMessage): CitationItem[] {
  const citations: CitationItem[] = []
  if (message.parts) {
    for (const part of message.parts) {
      if (part.type === 'citations' && Array.isArray(part.citations)) {
        citations.push(...part.citations)
      }
    }
  }
  return citations
}

interface MessageListProps {
  messages: UIMessage[]
  isLoading?: boolean
  error?: Error | null
  streamingStatus?: string
  selectedCitation?: CitationItem | null
  onSelectCitation?: (citation: CitationItem) => void
}

/** Render text with clickable inline [n] citation references and hover tooltips. */
function FormattedMessageText({
  text,
  citations,
  selectedCitation,
  onSelectCitation,
}: {
  text: string
  citations: CitationItem[]
  selectedCitation?: CitationItem | null
  onSelectCitation?: (citation: CitationItem) => void
}) {
  if (!citations || citations.length === 0) {
    return <div className="whitespace-pre-wrap break-words">{text}</div>
  }

  // Regex matching citation patterns like [1], [2], [1, 2]
  const regex = /\[(\d+(?:,\s*\d+)*)\]/g
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    // Push preceding plain text
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index))
    }

    const indicesStr = match[1]
    const indices = indicesStr.split(',').map((s) => parseInt(s.trim(), 10))

    parts.push(
      <span key={`cite-group-${match.index}`} className="inline-flex items-center gap-0.5 mx-0.5">
        {indices.map((idx) => {
          const citation = citations[idx - 1]
          if (!citation) {
            return (
              <span key={idx} className="text-muted-foreground text-[11px] font-mono">
                [{idx}]
              </span>
            )
          }

          const isSelected = selectedCitation?.chunk_id === citation.chunk_id
          const yearText = citation.fiscal_year ? ` FY${citation.fiscal_year}` : ''

          return (
            <Tooltip key={idx}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onSelectCitation?.(citation)}
                  className={`inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[11px] font-mono font-medium transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-foreground text-background ring-1 ring-foreground'
                      : 'bg-muted text-foreground hover:bg-foreground hover:text-background'
                  }`}
                >
                  [{idx}]
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs space-y-1">
                <div className="font-semibold font-mono text-[11px]">
                  {citation.ticker} {citation.form}{yearText}
                  {citation.page ? ` · p. ${citation.page}` : ''}
                </div>
                {citation.excerpt && (
                  <p className="line-clamp-2 text-[11px] text-muted-foreground italic">
                    "{citation.excerpt}"
                  </p>
                )}
                <div className="text-[10px] text-primary/80 pt-0.5">
                  Click to inspect full source passage
                </div>
              </TooltipContent>
            </Tooltip>
          )
        })}
      </span>,
    )

    lastIndex = regex.lastIndex
  }

  // Push remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex))
  }

  return <div className="whitespace-pre-wrap break-words leading-relaxed">{parts}</div>
}

export function MessageList({
  messages,
  isLoading,
  error,
  streamingStatus,
  selectedCitation,
  onSelectCitation,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading, streamingStatus])

  if (messages.length === 0) {
    return null
  }

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-6 md:px-8">
      {messages.map((message) => {
        const isUser = message.role === 'user'
        const text = getMessageText(message)
        const citations = getMessageCitations(message)
        const isRefusal =
          !isUser &&
          (text.toLowerCase().includes('not enough evidence') ||
            text.toLowerCase().includes('refuses to infer') ||
            text.toLowerCase().includes('unable to verify'))

        return (
          <div
            key={message.id}
            id={`message-${message.id}`}
            className={`flex w-full gap-3 md:gap-4 ${
              isUser ? 'justify-end' : 'justify-start'
            }`}
          >
            {/* Assistant Avatar */}
            {!isUser && (
              <div className="flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-md border border-border bg-card text-foreground shadow-2xs">
                <Bot className="h-4 w-4" />
              </div>
            )}

            {/* Message Bubble */}
            <div
              className={`relative max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed shadow-xs md:max-w-[80%] ${
                isUser
                  ? 'bg-foreground text-background font-normal rounded-tr-xs'
                  : 'border border-border/80 bg-card text-card-foreground rounded-tl-xs'
              }`}
            >
              {/* Refusal / Missing Evidence Badge */}
              {isRefusal && (
                <div className="mb-2.5 inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/70 px-2 py-0.5 text-xs font-medium text-foreground">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>Grounding Contract: Insufficient evidence in SEC filings</span>
                </div>
              )}

              {/* Message Body with interactive citations */}
              {isUser ? (
                <div className="whitespace-pre-wrap break-words">{text}</div>
              ) : (
                <FormattedMessageText
                  text={text}
                  citations={citations}
                  selectedCitation={selectedCitation}
                  onSelectCitation={onSelectCitation}
                />
              )}

              {/* Citations Shelf */}
              {!isUser && citations.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/40 pt-2.5">
                  <div className="flex items-center gap-1 mr-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Sources
                    </span>
                    <Badge variant="outline" size="sm" className="font-mono text-[9px] px-1 py-0">
                      {citations.length}
                    </Badge>
                  </div>
                  {citations.map((citation, idx) => (
                    <CitationChip
                      key={citation.chunk_id || idx}
                      index={idx + 1}
                      citation={citation}
                      isSelected={selectedCitation?.chunk_id === citation.chunk_id}
                      onClick={onSelectCitation}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* User Avatar */}
            {isUser && (
              <Avatar className="h-7 w-7 border-border">
                <AvatarFallback>
                  <UserIcon className="h-3.5 w-3.5" />
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        )
      })}

      {/* In-flight streaming indicator */}
      {isLoading && (
        <div className="flex items-center gap-3 animate-in fade-in">
          <div className="flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-md border border-border bg-card text-foreground shadow-2xs">
            <Bot className="h-4 w-4" />
          </div>
          <StreamingIndicator status={streamingStatus || 'Searching filings & generating answer…'} />
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error.message || 'An error occurred while streaming.'}</span>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
