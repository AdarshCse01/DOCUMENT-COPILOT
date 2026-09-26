import React, { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  AlertCircle,
  AlertTriangle,
  Copy,
  Check,
} from 'lucide-react'
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

/** Helper to replace [1], [2], etc. inside text with interactive citation badges */
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
              <span key={idx} className="text-gray-400 text-[11px] font-mono">
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
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onSelectCitation?.(citation)
                  }}
                  className={`inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[11px] font-mono font-medium transition-colors cursor-pointer align-baseline select-none ${
                    isSelected
                      ? 'bg-black text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  [{idx}]
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs space-y-1 bg-white text-gray-900 border border-gray-200 shadow-md">
                <div className="font-semibold text-[11px]">
                  {citation.ticker} {citation.form} {dateText}
                  {citation.page ? ` · p. ${citation.page}` : ''}
                </div>
                {citation.excerpt && (
                  <p className="line-clamp-2 text-[11px] text-gray-500 italic">
                    "{citation.excerpt}"
                  </p>
                )}
                <div className="text-[10px] text-gray-400 pt-0.5">
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

/** Render text with markdown, clear inline citations, and custom table styling (only horizontal borders) */
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
          <p className="mb-4 last:mb-0 leading-relaxed text-gray-900 font-normal">
            {React.Children.map(children, (child) =>
              typeof child === 'string'
                ? renderContentWithCitations(child, citations, selectedCitation, onSelectCitation)
                : child,
            )}
          </p>
        ),
        li: ({ children }) => (
          <li className="leading-relaxed text-gray-900">
            {React.Children.map(children, (child) =>
              typeof child === 'string'
                ? renderContentWithCitations(child, citations, selectedCitation, onSelectCitation)
                : child,
            )}
          </li>
        ),
        a: ({ href, children, ...props }) => {
          const childText = React.Children.toArray(children).join('')
          const match = childText.match(/\[?(\d+)\]?/)
          if (match) {
            const idx = parseInt(match[1], 10)
            const citation = citations[idx - 1]
            if (citation) {
              return (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onSelectCitation?.(citation)
                  }}
                  className={`inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[11px] font-mono font-medium transition-colors cursor-pointer align-baseline select-none ${
                    selectedCitation?.chunk_id === citation.chunk_id
                      ? 'bg-black text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  [{idx}]
                </button>
              )
            }
          }
          return (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-gray-900 underline hover:text-black" {...props}>
              {children}
            </a>
          )
        },
        table: ({ children }) => (
          <div className="my-5 overflow-x-auto w-full">
            <table className="w-full text-left text-sm border-collapse border-b border-gray-200">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="border-b border-gray-200 text-gray-900 font-semibold">
            {children}
          </thead>
        ),
        th: ({ children }) => (
          <th className="p-3 font-semibold text-gray-900 border-b border-gray-200 whitespace-nowrap text-left">
            {children}
          </th>
        ),
        tr: ({ children }) => (
          <tr className="border-b border-gray-200 hover:bg-gray-50/50 transition-colors">
            {children}
          </tr>
        ),
        td: ({ children }) => (
          <td className="p-3 text-gray-800 border-b border-gray-200 align-top">
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

function AssistantMessageItem({
  message,
  selectedCitation,
  onSelectCitation,
}: {
  message: UIMessage
  selectedCitation?: CitationItem | null
  onSelectCitation?: (citation: CitationItem) => void
}) {
  const text = getMessageText(message)
  const citations = getMessageCitations(message)
  const [copied, setCopied] = useState(false)

  const isRefusal =
    text.toLowerCase().includes('not enough evidence') ||
    text.toLowerCase().includes('refuses to infer') ||
    text.toLowerCase().includes('unable to verify')

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy text:', err)
    }
  }

  return (
    <div
      id={`message-${message.id}`}
      className="group relative flex flex-col items-start w-full text-sm leading-relaxed text-gray-900"
    >
      {/* Refusal / Missing Evidence Badge */}
      {isRefusal && (
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>Grounding Contract: Insufficient evidence in SEC filings</span>
        </div>
      )}

      {/* Formatted body with markdown and citations */}
      <div className="w-full text-sm leading-relaxed text-gray-900">
        <FormattedMessageText
          text={text}
          citations={citations}
          selectedCitation={selectedCitation}
          onSelectCitation={onSelectCitation}
        />
      </div>

      {/* SOURCES Section at the bottom of the answer */}
      {citations.length > 0 && (
        <div className="mt-6 w-full pt-4 border-t border-gray-100">
          <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2.5 select-none">
            SOURCES
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
        </div>
      )}

      {/* Copy Button at bottom right */}
      <div className="mt-3 flex w-full justify-end">
        <button
          type="button"
          title={copied ? 'Copied' : 'Copy to clipboard'}
          onClick={handleCopy}
          className="opacity-60 hover:opacity-100 hover:bg-gray-100 p-1.5 rounded-md text-gray-500 hover:text-gray-900 transition-all cursor-pointer"
        >
          {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
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

          if (isUser) {
            return (
              <div key={message.id} className="flex w-full justify-end">
                <div className="max-w-[80%] rounded-2xl bg-gray-100 text-gray-900 px-5 py-3 text-sm leading-relaxed font-normal">
                  {text}
                </div>
              </div>
            )
          }

          return (
            <AssistantMessageItem
              key={message.id}
              message={message}
              selectedCitation={selectedCitation}
              onSelectCitation={onSelectCitation}
            />
          )
        })}

        {/* In-flight streaming indicator */}
        {isLoading && (
          <div className="flex items-start w-full py-1">
            <StreamingIndicator status={streamingStatus} />
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error.message || 'An error occurred while streaming.'}</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}
