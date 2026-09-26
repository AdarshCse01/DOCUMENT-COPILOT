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
  const labelParts = [citation.ticker, citation.form, citation.section || dateText].filter(Boolean)
  const label = labelParts.join(' · ')

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          id={`citation-chip-${index}`}
          onClick={() => onClick?.(citation)}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-normal transition-all duration-150 cursor-pointer select-none ${
            isSelected
              ? 'border-black bg-gray-50 ring-1 ring-black text-gray-900'
              : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
          }`}
        >
          <span
            className="flex h-4 w-4 items-center justify-center rounded-full bg-black text-[10px] font-semibold text-white shrink-0"
          >
            {index}
          </span>
          <span className="truncate max-w-[240px] text-xs text-gray-800">{label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs space-y-1 bg-white text-gray-900 border border-gray-200 shadow-md">
        <div className="font-semibold text-[11px] text-gray-900">
          {citation.ticker} {citation.form} {dateText}
          {citation.page ? ` · p. ${citation.page}` : ''}
        </div>
        {citation.excerpt && (
          <p className="line-clamp-3 text-gray-500 text-[11px] italic">
            "{citation.excerpt}"
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  )
}
