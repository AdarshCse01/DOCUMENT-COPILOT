import React, { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { AlertCircle, AlertTriangle } from 'lucide-react'
import { StreamingIndicator } from './StreamingIndicator'
import { CitationChip } from './CitationChip'
import type { CitationItem } from '@/lib/api'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

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

/** Helper to replace [1], [2], etc. inside a string with interactive tooltip citation tags */
function renderContentWithCitations(
  text: string,
  citations: CitationItem[],
  selectedCitation?: CitationItem | null,
  onSelectCitation?: (citation: CitationItem) => void,
): React.ReactNode {
  if (!citations || citations.length === 0) return text

  const regex = /\[(\d+(?:,\s*\d+)*)\]/g
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index))
    }

    const indicesStr = match[1]
    const indices = indicesStr.split(',').map((s) => parseInt(s.trim(), 10))

    parts.push(
      <span key={`cite-group-${match.index}`} className="inline-flex items-center gap-0.5 mx-0.5 align-baseline">
        {indices.map((idx) => {
          const citation = citations[idx - 1]
          if (!citation) {
            return (
              <span key={idx} className="text-zinc-400 text-[11px] font-mono">
                [{idx}]
              </span>
            )
          }

          const isSelected = selectedCitation?.chunk_id === citation.chunk_id
          const dateText = citation.filing_date || (citation.fiscal_year ? `FY${citation.fiscal_year}` : '')

          return (
            <Tooltip key={idx}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onSelectCitation?.(citation)}
                  className={`inline-flex items-center justify-center rounded px-1 py-0.2 text-[10px] font-mono font-medium transition-all cursor-pointer align-baseline ${
                    isSelected
                      ? 'bg-zinc-900 text-white ring-1 ring-zinc-900'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  [{idx}]
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs space-y-1 bg-white text-zinc-900 border border-zinc-200 shadow-md">
                <div className="font-semibold font-mono text-[11px]">
                  {citation.ticker} {citation.form} {dateText}
                  {citation.page ? ` · p. ${citation.page}` : ''}
                </div>
                {citation.excerpt && (
                  <p className="line-clamp-2 text-[11px] text-zinc-500 italic">
                    "{citation.excerpt}"
                  </p>
                )}
                <div className="text-[10px] text-zinc-400 pt-0.5">
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

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex))
  }

  return parts
}

/** Render text with markdown and clickable inline [n] citation references. */
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
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => (
          <p className="mb-4 last:mb-0 leading-relaxed text-zinc-900 font-normal">
            {React.Children.map(children, (child) =>
              typeof child === 'string'
                ? renderContentWithCitations(child, citations, selectedCitation, onSelectCitation)
                : child,
            )}
          </p>
        ),
        table: ({ children }) => (
          <div className="my-4 overflow-x-auto rounded-lg border border-zinc-200">
            <table className="w-full text-left text-xs border-collapse">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-zinc-50 border-b border-zinc-200">{children}</thead>
        ),
        th: ({ children }) => (
          <th className="px-3 py-2 font-semibold text-zinc-900 border-r border-zinc-200 last:border-r-0">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-3 py-2 border-t border-zinc-200 border-r last:border-r-0 text-zinc-800">
            {React.Children.map(children, (child) =>
              typeof child === 'string'
                ? renderContentWithCitations(child, citations, selectedCitation, onSelectCitation)
                : child,
            )}
          </td>
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  )
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
    <div className="flex flex-1 flex-col overflow-y-auto px-4 py-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        {messages.map((message) => {
          const isUser = message.role === 'user'
          const text = getMessageText(message)
          const citations = getMessageCitations(message)
          const isRefusal =
            !isUser &&
            (text.toLowerCase().includes('not enough evidence') ||
              text.toLowerCase().includes('refuses to infer') ||
              text.toLowerCase().includes('unable to verify'))

          if (isUser) {
            return (
              <div key={message.id} className="flex w-full justify-end">
                <div className="max-w-[80%] rounded-2xl bg-zinc-950 text-white px-4 py-2.5 text-sm leading-relaxed font-normal shadow-xs">
                  {text}
                </div>
              </div>
            )
          }

          return (
            <div key={message.id} id={`message-${message.id}`} className="flex flex-col items-start w-full">
              {/* Subtle avatar circle above card on the left matching reference */}
              <div className="h-6 w-6 rounded-full border border-zinc-200 bg-white mb-2 shadow-2xs shrink-0" />

              {/* Assistant Message Card */}
              <div className="w-full rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-900 shadow-none leading-relaxed">
                {/* Refusal / Missing Evidence Badge */}
                {isRefusal && (
                  <div className="mb-3 inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span>Grounding Contract: Insufficient evidence in SEC filings</span>
                  </div>
                )}

                {/* Formatted body with markdown and citations */}
                <FormattedMessageText
                  text={text}
                  citations={citations}
                  selectedCitation={selectedCitation}
                  onSelectCitation={onSelectCitation}
                />

                {/* Citation Chips Shelf */}
                {citations.length > 0 && (
                  <div className="mt-5 border-t border-zinc-200 pt-3.5 flex flex-wrap items-center gap-2">
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
            </div>
          )
        })}

        {/* In-flight streaming indicator */}
        {isLoading && (
          <div className="flex flex-col items-start w-full">
            <div className="h-6 w-6 rounded-full border border-zinc-200 bg-white mb-2 shadow-2xs shrink-0" />
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
    </div>
  )
}

