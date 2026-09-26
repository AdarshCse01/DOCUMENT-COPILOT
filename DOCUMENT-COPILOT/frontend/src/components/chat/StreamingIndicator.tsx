import { Loader2 } from 'lucide-react'

export function StreamingIndicator({ status }: { status?: string }) {
  return (
    <div
      id="streaming-indicator"
      className="inline-flex items-center gap-2.5 rounded-full bg-gray-100 px-4 py-2 text-xs text-gray-700 font-normal animate-in fade-in duration-200 border-0"
    >
      <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-600 shrink-0" />
      <span>{status || 'Analyzing query & searching SEC filings...'}</span>
    </div>
  )
}
