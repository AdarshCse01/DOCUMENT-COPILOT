import type { CitationItem } from '@/lib/api'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface CitationChipProps {
  index: number
  citation: CitationItem
  isSelected?: boolean
  onClick?: (citation: CitationItem) => void
}

export function CitationChip({
  index,
  citation,
  isSelected = false,
  onClick,
}: CitationChipProps) {
  const dateText =
    citation.filing_date || (citation.fiscal_year ? `FY${citation.fiscal_year}` : '')
  const label = [citation.ticker, citation.form, dateText].filter(Boolean).join(' · ')

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          id={`citation-chip-${index}`}
          onClick={() => onClick?.(citation)}
          className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-normal transition-all duration-150 cursor-pointer ${
            isSelected
              ? 'border-zinc-900 bg-zinc-100 text-zinc-900 shadow-2xs ring-1 ring-zinc-900'
              : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50'
          }`}
        >
          <span className="font-semibold text-zinc-900 font-mono">[{index}]</span>
          <span className="font-sans text-zinc-700">{label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs space-y-1">
        <div className="font-semibold font-mono text-[11px]">
          {citation.ticker} {citation.form} {dateText}
          {citation.page ? ` · p. ${citation.page}` : ''}
        </div>
        {citation.excerpt && (
          <p className="line-clamp-3 text-muted-foreground text-[11px] italic">
            "{citation.excerpt}"
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  )
}

