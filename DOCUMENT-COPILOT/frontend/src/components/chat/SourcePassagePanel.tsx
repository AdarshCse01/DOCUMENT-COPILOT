import { useState, useEffect } from 'react'
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
} from 'lucide-react'
import type { CitationItem } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

interface SourcePassagePanelProps {
  citation: CitationItem | null
  onClose: () => void
}

export function SourcePassagePanel({ citation, onClose }: SourcePassagePanelProps) {
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'excerpt' | 'metadata'>('excerpt')

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

  if (!citation) {
    return null
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(citation.excerpt)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy excerpt:', err)
    }
  }

  const yearText = citation.fiscal_year ? `FY${citation.fiscal_year}` : ''

  return (
    <aside
      id="source-passage-panel"
      aria-label="Source Passage Viewer"
      className="flex h-full w-full flex-col border-l border-border bg-card text-card-foreground shadow-lg md:w-[420px] lg:w-[480px] animate-in slide-in-from-right duration-200"
    >
      {/* Panel Header */}
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-2">
          <FileCheck2 className="h-4 w-4 text-foreground" />
          <h3 className="font-semibold text-xs tracking-tight uppercase">Source Passage</h3>
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
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border bg-muted/30 px-4 py-2.5 text-xs">
        <Badge variant="default" className="font-mono text-xs font-bold">
          {citation.ticker}
        </Badge>
        <Badge variant="outline" className="font-mono text-xs">
          {citation.form} {yearText}
        </Badge>
        {citation.section && (
          <Badge variant="outline" className="text-xs gap-1 font-normal text-muted-foreground">
            <Layers className="h-3 w-3" />
            {citation.section}
          </Badge>
        )}
        {citation.page !== null && citation.page !== undefined && (
          <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
            Page {citation.page}
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
      <div className="flex border-b border-border bg-card px-4">
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
          <span>Verified Excerpt</span>
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
            {/* Grounding Trust Badge */}
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs font-medium text-foreground">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span>Grounding Contract: Exact filing excerpt anchored</span>
            </div>

            {/* Verified Excerpt Block */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
                  Filing Content
                </span>
                <Button
                  type="button"
                  id="copy-excerpt-btn"
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="h-7 gap-1.5 text-xs"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy text</span>
                    </>
                  )}
                </Button>
              </div>

              <div className="rounded-lg border border-border bg-muted/20 p-3.5 text-foreground font-mono text-xs leading-relaxed whitespace-pre-wrap select-text">
                {citation.excerpt}
              </div>
            </div>

            {/* Relevance Explanation */}
            {citation.relevance_explanation && (
              <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/30 p-3 text-xs">
                <span className="font-semibold text-foreground text-[11px] uppercase tracking-wider">
                  Relevance Reasoning
                </span>
                <p className="text-muted-foreground leading-relaxed">
                  {citation.relevance_explanation}
                </p>
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
