import { FileText, ExternalLink } from 'lucide-react'
import type { CitationItem } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
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
  const yearText = citation.fiscal_year ? `FY${citation.fiscal_year}` : ''
  const locationText = citation.section
    ? citation.section
    : citation.page !== null && citation.page !== undefined
      ? `p. ${citation.page}`
      : ''

  const label = [citation.ticker, citation.form, yearText, locationText]
    .filter(Boolean)
    .join(' · ')

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          id={`citation-chip-${index}`}
          onClick={() => onClick?.(citation)}
          className={`group inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all duration-150 cursor-pointer ${
            isSelected
              ? 'border-foreground bg-foreground text-background shadow-xs ring-1 ring-foreground'
              : 'border-border bg-card text-muted-foreground hover:border-foreground/50 hover:bg-accent hover:text-foreground'
          }`}
        >
          <Badge
            variant={isSelected ? 'default' : 'outline'}
            size="sm"
            className={`h-4 min-w-4 px-1 rounded-full text-[10px] font-mono leading-none ${
              isSelected ? 'bg-background text-foreground' : 'bg-muted text-foreground'
            }`}
          >
            {index}
          </Badge>
          <FileText className="h-3 w-3 shrink-0 opacity-70 group-hover:opacity-100" />
          <span className="truncate max-w-[190px] font-mono text-[11px]">{label}</span>
          <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-40 group-hover:opacity-100" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs space-y-1">
        <div className="font-semibold font-mono text-[11px]">{label}</div>
        {citation.excerpt && (
          <p className="line-clamp-3 text-muted-foreground text-[11px] italic">
            "{citation.excerpt}"
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  )
}
