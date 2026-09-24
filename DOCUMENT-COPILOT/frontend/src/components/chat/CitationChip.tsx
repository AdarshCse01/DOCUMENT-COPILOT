import type { CitationItem } from '@/lib/api'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { FileText } from 'lucide-react'

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
  const labelParts = [citation.ticker, citation.form, citation.section || dateText].filter(Boolean)
  const label = labelParts.join(' · ')

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          id={`citation-chip-${index}`}
          onClick={() => onClick?.(citation)}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-normal transition-all duration-150 cursor-pointer ${
            isSelected
              ? 'border-zinc-900 bg-zinc-900 text-white shadow-2xs'
              : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50'
          }`}
        >
          <span
            className={`font-semibold font-mono text-[10px] flex h-4 w-4 items-center justify-center rounded-full ${
              isSelected ? 'bg-white text-zinc-900' : 'bg-zinc-100 text-zinc-800'
            }`}
          >
            {index}
          </span>
          <FileText className={`h-3 w-3 ${isSelected ? 'text-zinc-300' : 'text-zinc-400'}`} />
          <span className="truncate max-w-[200px] text-xs">{label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs space-y-1 bg-white text-zinc-900 border border-zinc-200 shadow-md">
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
