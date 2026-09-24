import { useState, useEffect, useMemo } from 'react'
import {
  X,
  ShieldCheck,
  Copy,
  Check,
  FileSpreadsheet,
  Calendar,
  Layers,
  FileCheck2,
  BookOpen,
  Info,
  ChevronDown,
  ChevronUp,
  Table as TableIcon,
  AlignLeft,
  Workflow,
  Sparkles,
  ArrowRight,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { CitationItem, ChunkContextResponse } from '@/lib/api'
import { getChunkContext } from '@/lib/api'
import { formatFilingPassage } from '@/lib/tableFormatter'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

interface SourcePassagePanelProps {
  citation: CitationItem | null
  onClose: () => void
}

type ViewMode = 'table' | 'context' | 'raw'

export function SourcePassagePanel({ citation, onClose }: SourcePassagePanelProps) {
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'excerpt' | 'metadata'>('excerpt')
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [contextData, setContextData] = useState<ChunkContextResponse | null>(null)
  const [contextLoading, setContextLoading] = useState(false)
  const [expandedChunks, setExpandedChunks] = useState<Record<string, boolean>>({})

  // Dismiss on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Fetch neighboring chunks whenever citation changes
  useEffect(() => {
    if (!citation?.chunk_id) {
      setContextData(null)
      return
    }

    let isMounted = true
    setContextLoading(true)

    void (async () => {
      try {
        const data = await getChunkContext(citation.chunk_id, 1)
        if (isMounted) {
          setContextData(data)
          // Default expand target chunk and collapse neighbors
          const expanded: Record<string, boolean> = {}
          data.chunks.forEach((c) => {
            expanded[c.id] = c.is_target
          })
          setExpandedChunks(expanded)
        }
      } catch (err) {
        console.warn('Could not fetch chunk context:', err)
        if (isMounted) {
          setContextData(null)
        }
      } finally {
        if (isMounted) {
          setContextLoading(false)
        }
      }
    })()

    return () => {
      isMounted = false
    }
  }, [citation?.chunk_id])

  // Parse and format passage tables
  const targetChunk = useMemo(() => {
    if (!contextData) return null
    return contextData.chunks.find((c) => c.is_target) || null
  }, [contextData])

  const contentToFormat = targetChunk?.content || citation?.excerpt || ''

  const { normalizedMarkdown, extractedTableMarkdown, hasTable } = useMemo(() => {
    return formatFilingPassage(contentToFormat)
  }, [contentToFormat])

  // Automatically pick best default view mode: table if table detected, otherwise context/raw
  useEffect(() => {
    if (hasTable) {
      setViewMode('table')
    } else {
      setViewMode('context')
    }
  }, [hasTable, citation?.chunk_id])

  if (!citation) {
    return null
  }

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy text:', err)
    }
  }

  const toggleChunkExpand = (chunkId: string) => {
    setExpandedChunks((prev) => ({
      ...prev,
      [chunkId]: !prev[chunkId],
    }))
  }

  const yearText = citation.fiscal_year ? `FY${citation.fiscal_year}` : ''

  return (
    <aside
      id="source-passage-panel"
      aria-label="Source Passage Viewer"
      className="flex h-full w-full flex-col border-l border-border bg-card text-card-foreground shadow-lg md:w-[460px] lg:w-[540px] animate-in slide-in-from-right duration-200"
    >
      {/* Panel Header */}
      <div className="flex h-14 items-center justify-between border-b border-border px-4 shrink-0">
        <div className="flex items-center gap-2">
          <FileCheck2 className="h-4 w-4 text-foreground" />
          <h3 className="font-semibold text-xs tracking-tight uppercase">Source Passage & Context</h3>
        </div>
        <button
          type="button"
          id="close-source-passage-btn"
          onClick={onClose}
          aria-label="Close source passage panel"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Ticker / Filing Badges Bar */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border bg-muted/30 px-4 py-2 text-xs shrink-0">
        <Badge variant="default" className="font-mono text-xs font-bold">
          {citation.ticker}
        </Badge>
        <Badge variant="outline" className="font-mono text-xs">
          {citation.form} {yearText}
        </Badge>
        {citation.section && (
          <Badge variant="outline" className="text-xs gap-1 font-normal text-muted-foreground max-w-[200px] truncate">
            <Layers className="h-3 w-3 shrink-0" />
            <span className="truncate">{citation.section}</span>
          </Badge>
        )}
        {citation.page !== null && citation.page !== undefined && (
          <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
            p. {citation.page}
          </Badge>
        )}
        {citation.filing_date && (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground ml-auto">
            <Calendar className="h-3 w-3" />
            {citation.filing_date}
          </span>
        )}
      </div>

      {/* Tabs navigation */}
      <div className="flex border-b border-border bg-card px-4 shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('excerpt')}
          className={`flex items-center gap-1.5 border-b-2 py-2 px-3 text-xs font-medium transition-colors cursor-pointer ${
            activeTab === 'excerpt'
              ? 'border-foreground text-foreground font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <BookOpen className="h-3.5 w-3.5" />
          <span>Filing Source</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('metadata')}
          className={`flex items-center gap-1.5 border-b-2 py-2 px-3 text-xs font-medium transition-colors cursor-pointer ${
            activeTab === 'metadata'
              ? 'border-foreground text-foreground font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Info className="h-3.5 w-3.5" />
          <span>Filing Details</span>
        </button>
      </div>

      {/* Scrollable Content Area */}
      <ScrollArea className="flex-1 p-4">
        {activeTab === 'excerpt' ? (
          <div className="flex flex-col gap-4">
            {/* Grounding Contract Trust Banner */}
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Zero-Hallucination Contract</span>
              </div>
              <span className="text-[11px] text-muted-foreground font-mono">100% Verifiable</span>
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center justify-between border-b border-border pb-2">
              <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-0.5 border border-border text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all cursor-pointer ${
                    viewMode === 'table'
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <TableIcon className="h-3 w-3" />
                  <span>Table View</span>
                  {hasTable && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('context')}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all cursor-pointer ${
                    viewMode === 'context'
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Workflow className="h-3 w-3" />
                  <span>Neighboring Context</span>
                  {contextData && contextData.chunks.length > 1 && (
                    <span className="text-[10px] bg-muted px-1.5 rounded font-mono font-normal">
                      {contextData.chunks.length} chunks
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('raw')}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all cursor-pointer ${
                    viewMode === 'raw'
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <AlignLeft className="h-3 w-3" />
                  <span>Raw Text</span>
                </button>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  handleCopy(
                    viewMode === 'table' && extractedTableMarkdown
                      ? extractedTableMarkdown
                      : citation.excerpt,
                  )
                }
                className="h-7 gap-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-600" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span>Copy</span>
                  </>
                )}
              </Button>
            </div>

            {/* MODE 1: Table & Formatted View */}
            {viewMode === 'table' && (
              <div className="flex flex-col gap-3">
                {extractedTableMarkdown ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground uppercase tracking-wider">
                      <Sparkles className="h-3.5 w-3.5 text-zinc-900" />
                      <span>Structured Financial Table (Normalized from 10-K)</span>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-2xs">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          table: ({ children }) => (
                            <table className="w-full text-left text-xs border-collapse font-sans">{children}</table>
                          ),
                          thead: ({ children }) => (
                            <thead className="bg-muted/60 border-b border-border text-foreground font-semibold">{children}</thead>
                          ),
                          th: ({ children }) => (
                            <th className="px-3 py-2 border-r border-border last:border-r-0 font-mono text-[11px]">{children}</th>
                          ),
                          td: ({ children }) => (
                            <td className="px-3 py-2 border-t border-border border-r last:border-r-0 text-foreground font-mono text-xs">{children}</td>
                          ),
                        }}
                      >
                        {extractedTableMarkdown}
                      </ReactMarkdown>
                    </div>
                  </div>
                ) : hasTable ? (
                  <div className="overflow-x-auto rounded-lg border border-border bg-card p-3 shadow-2xs">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        table: ({ children }) => (
                          <table className="w-full text-left text-xs border-collapse font-sans">{children}</table>
                        ),
                        thead: ({ children }) => (
                          <thead className="bg-muted/60 border-b border-border text-foreground font-semibold">{children}</thead>
                        ),
                        th: ({ children }) => (
                          <th className="px-3 py-2 border-r border-border last:border-r-0 font-mono text-[11px]">{children}</th>
                        ),
                        td: ({ children }) => (
                          <td className="px-3 py-2 border-t border-border border-r last:border-r-0 text-foreground font-mono text-xs">{children}</td>
                        ),
                      }}
                    >
                      {normalizedMarkdown}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border p-4 text-center">
                    <TableIcon className="h-6 w-6 text-muted-foreground mx-auto mb-1.5 opacity-50" />
                    <p className="text-xs text-muted-foreground">
                      This citation is a narrative disclosure rather than a financial table.
                    </p>
                    <button
                      type="button"
                      onClick={() => setViewMode('context')}
                      className="mt-2 text-xs text-foreground font-medium underline cursor-pointer inline-flex items-center gap-1"
                    >
                      <span>View in neighboring context</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                )}

                {/* Verbatim Excerpt Anchor */}
                <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/20 p-3 mt-1">
                  <span className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
                    Verbatim Filing Excerpt
                  </span>
                  <p className="font-mono text-xs leading-relaxed text-foreground whitespace-pre-wrap select-text">
                    "{citation.excerpt}"
                  </p>
                </div>
              </div>
            )}

            {/* MODE 2: Neighboring Chunks Context View */}
            {viewMode === 'context' && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Showing contiguous filing sequence around target chunk</span>
                  {contextLoading && <span className="animate-pulse">Loading context…</span>}
                </div>

                {contextData?.chunks && contextData.chunks.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {contextData.chunks.map((chunk) => {
                      const isTarget = chunk.is_target
                      const isExpanded = expandedChunks[chunk.id] ?? isTarget
                      const isPreceding = !isTarget && (targetChunk ? chunk.chunk_index < targetChunk.chunk_index : false)

                      return (
                        <div
                          key={chunk.id}
                          className={`rounded-lg border transition-all ${
                            isTarget
                              ? 'border-zinc-900 bg-card ring-1 ring-zinc-900 shadow-sm'
                              : 'border-border bg-muted/15 hover:bg-muted/30'
                          }`}
                        >
                          {/* Chunk Header Banner */}
                          <div
                            onClick={() => toggleChunkExpand(chunk.id)}
                            className="flex items-center justify-between p-2.5 cursor-pointer select-none"
                          >
                            <div className="flex items-center gap-2">
                              {isTarget ? (
                                <Badge variant="default" className="text-[10px] px-1.5 py-0 font-semibold bg-zinc-900 text-white">
                                  Cited Chunk #{chunk.chunk_index}
                                </Badge>
                              ) : isPreceding ? (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                                  Preceding Chunk #{chunk.chunk_index}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                                  Subsequent Chunk #{chunk.chunk_index}
                                </Badge>
                              )}

                              {chunk.page && (
                                <span className="text-[11px] text-muted-foreground font-mono">
                                  Page {chunk.page}
                                </span>
                              )}
                              {chunk.section && (
                                <span className="text-[11px] text-muted-foreground max-w-[140px] truncate">
                                  · {chunk.section}
                                </span>
                              )}
                            </div>

                            <button type="button" className="text-muted-foreground">
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                          </div>

                          {/* Chunk Content */}
                          {isExpanded && (
                            <div className="p-3 pt-0 text-xs leading-relaxed border-t border-border/50">
                              {isTarget ? (
                                <div className="space-y-2 pt-2">
                                  <div className="rounded-md bg-zinc-100 p-2.5 border border-zinc-200 text-zinc-900 font-mono text-[11px] leading-relaxed">
                                    <div className="font-semibold text-[10px] uppercase text-zinc-500 mb-1">
                                      Referenced Quote:
                                    </div>
                                    <mark className="bg-amber-100 text-zinc-950 px-1 py-0.5 rounded font-medium">
                                      {citation.excerpt}
                                    </mark>
                                  </div>

                                  <div className="pt-2 text-foreground font-mono text-xs whitespace-pre-wrap leading-relaxed select-text">
                                    {chunk.content}
                                  </div>
                                </div>
                              ) : (
                                <div className="pt-2 text-muted-foreground font-mono text-[11px] whitespace-pre-wrap leading-relaxed select-text">
                                  {chunk.content}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg border border-border p-3 text-xs leading-relaxed text-foreground font-mono whitespace-pre-wrap">
                    {citation.excerpt}
                  </div>
                )}
              </div>
            )}

            {/* MODE 3: Raw Filing Text */}
            {viewMode === 'raw' && (
              <div className="flex flex-col gap-2">
                <span className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
                  Full Raw Chunk Text
                </span>
                <div className="rounded-lg border border-border bg-muted/20 p-3.5 text-foreground font-mono text-xs leading-relaxed whitespace-pre-wrap select-text">
                  {targetChunk?.content || citation.excerpt}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3 text-xs">
            <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
              <div className="flex items-center justify-between p-2.5">
                <span className="text-muted-foreground">Company Ticker</span>
                <span className="font-mono font-semibold">{citation.ticker}</span>
              </div>
              <div className="flex items-center justify-between p-2.5">
                <span className="text-muted-foreground">SEC Form</span>
                <span className="font-mono">{citation.form}</span>
              </div>
              <div className="flex items-center justify-between p-2.5">
                <span className="text-muted-foreground">Fiscal Year</span>
                <span className="font-mono">{citation.fiscal_year || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between p-2.5">
                <span className="text-muted-foreground">Filing Date</span>
                <span className="font-mono">{citation.filing_date || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between p-2.5">
                <span className="text-muted-foreground">Document Page</span>
                <span className="font-mono">{citation.page ?? 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between p-2.5">
                <span className="text-muted-foreground">Section Header</span>
                <span className="font-medium text-right max-w-[200px] truncate">
                  {citation.section || 'General'}
                </span>
              </div>
            </div>

            {/* Chunk ID */}
            <div className="rounded-lg border border-border bg-muted/20 p-3 flex flex-col gap-1 text-[11px]">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>Vector Chunk Identifier</span>
              </div>
              <code className="font-mono text-[10px] text-muted-foreground break-all select-all">
                {citation.chunk_id}
              </code>
            </div>
          </div>
        )}
      </ScrollArea>
    </aside>
  )
}
