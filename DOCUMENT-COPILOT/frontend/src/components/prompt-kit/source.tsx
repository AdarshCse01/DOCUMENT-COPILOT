import * as React from 'react'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { cn } from '@/lib/utils'

interface SourceContextValue {
  href: string
  domain: string
}

const SourceContext = React.createContext<SourceContextValue | null>(null)

function useSourceContext() {
  const ctx = React.useContext(SourceContext)
  if (!ctx) throw new Error('Source components must be used inside <Source>')
  return ctx
}

export type SourceProps = {
  href: string
  children: React.ReactNode
}

function getDomain(href: string): string {
  try {
    return new URL(href).hostname
  } catch {
    return href.split('/').pop() || href
  }
}

export function Source({ href, children }: SourceProps) {
  const domain = getDomain(href)

  return (
    <SourceContext.Provider value={{ href, domain }}>
      <HoverCard openDelay={150} closeDelay={0}>
        {children}
      </HoverCard>
    </SourceContext.Provider>
  )
}

export type SourceTriggerProps = {
  label?: string | number
  showFavicon?: boolean
  className?: string
}

export function SourceTrigger({
  label,
  showFavicon = false,
  className,
}: SourceTriggerProps) {
  const { href, domain } = useSourceContext()
  const labelToShow = label ?? domain.replace('www.', '')

  return (
    <HoverCardTrigger asChild>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'inline-flex h-5 max-w-36 items-center gap-1 overflow-hidden rounded-full border border-border bg-card px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:border-foreground/50 hover:bg-accent hover:text-foreground no-underline',
          className,
        )}
      >
        {showFavicon && (
          <img
            src={`https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(href)}`}
            alt=""
            width={12}
            height={12}
            className="size-3 rounded-full shrink-0"
          />
        )}
        <span className="truncate tabular-nums font-mono">{labelToShow}</span>
      </a>
    </HoverCardTrigger>
  )
}

export type SourceContentProps = {
  title: string
  description: string
  className?: string
}

export function SourceContent({
  title,
  description,
  className,
}: SourceContentProps) {
  const { href, domain } = useSourceContext()

  return (
    <HoverCardContent className={cn('w-80 p-3 shadow-md bg-popover text-popover-foreground border-border', className)}>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-col gap-1.5 no-underline text-foreground"
      >
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <img
            src={`https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(href)}`}
            alt=""
            className="size-3.5 rounded-full"
            width={14}
            height={14}
          />
          <span className="truncate">{domain.replace('www.', '')}</span>
        </div>
        <div className="text-xs font-semibold leading-snug">{title}</div>
        <p className="line-clamp-3 text-[11px] text-muted-foreground leading-relaxed">
          {description}
        </p>
      </a>
    </HoverCardContent>
  )
}
