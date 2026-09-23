import * as React from 'react'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { type VariantProps } from 'class-variance-authority'

export type PromptSuggestionProps = {
  children: React.ReactNode
  variant?: VariantProps<typeof buttonVariants>['variant']
  size?: VariantProps<typeof buttonVariants>['size']
  className?: string
  highlight?: string
} & React.ButtonHTMLAttributes<HTMLButtonElement>

export function PromptSuggestion({
  children,
  variant = 'outline',
  size = 'sm',
  className,
  highlight,
  ...props
}: PromptSuggestionProps) {
  const isHighlightMode = highlight !== undefined && highlight.trim() !== ''
  const content = typeof children === 'string' ? children : ''

  if (!isHighlightMode || !content) {
    return (
      <Button
        variant={variant}
        size={size}
        className={cn('rounded-full text-xs font-normal border-border bg-card hover:bg-accent cursor-pointer', className)}
        {...props}
      >
        {children}
      </Button>
    )
  }

  const trimmedHighlight = highlight.trim()
  const contentLower = content.toLowerCase()
  const highlightLower = trimmedHighlight.toLowerCase()
  const shouldHighlight = contentLower.includes(highlightLower)

  return (
    <Button
      variant={variant}
      size={size}
      className={cn('rounded-full text-xs font-normal border-border bg-card hover:bg-accent cursor-pointer', className)}
      {...props}
    >
      {shouldHighlight ? (
        (() => {
          const index = contentLower.indexOf(highlightLower)
          if (index === -1) {
            return <span className="text-muted-foreground whitespace-pre-wrap">{content}</span>
          }
          const actualHighlightedText = content.substring(index, index + highlightLower.length)
          const before = content.substring(0, index)
          const after = content.substring(index + actualHighlightedText.length)

          return (
            <>
              {before && <span className="text-muted-foreground whitespace-pre-wrap">{before}</span>}
              <span className="font-semibold text-foreground whitespace-pre-wrap">{actualHighlightedText}</span>
              {after && <span className="text-muted-foreground whitespace-pre-wrap">{after}</span>}
            </>
          )
        })()
      ) : (
        <span className="text-muted-foreground whitespace-pre-wrap">{content}</span>
      )}
    </Button>
  )
}
