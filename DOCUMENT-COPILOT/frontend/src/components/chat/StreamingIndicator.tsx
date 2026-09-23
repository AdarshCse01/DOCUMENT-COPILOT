import { Search, Brain, ShieldCheck, Sparkles } from 'lucide-react'
import { Loader } from '@/components/prompt-kit/loader'

interface StreamingIndicatorProps {
  status?: string
}

export function StreamingIndicator({ status = 'Processing query…' }: StreamingIndicatorProps) {
  // Determine active stage icon based on status text
  let Icon = Sparkles
  const lower = status.toLowerCase()
  if (lower.includes('search') || lower.includes('retriev') || lower.includes('extract') || lower.includes('keyword')) {
    Icon = Search
  } else if (lower.includes('agent') || lower.includes('analyz') || lower.includes('read') || lower.includes('reason')) {
    Icon = Brain
  } else if (lower.includes('validat') || lower.includes('grounding') || lower.includes('contract')) {
    Icon = ShieldCheck
  }

  return (
    <div
      id="streaming-indicator"
      className="inline-flex items-center gap-2.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-foreground shadow-xs animate-in fade-in duration-200"
    >
      <Loader variant="circular" size="sm" />
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-foreground" />
        <span className="font-normal text-muted-foreground">{status}</span>
      </div>
      <span className="flex h-1.5 w-1.5 rounded-full bg-foreground animate-pulse" />
    </div>
  )
}
