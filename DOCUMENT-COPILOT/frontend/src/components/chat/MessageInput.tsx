import React, { useRef, useEffect } from 'react'
import { ArrowUp, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface MessageInputProps {
  input: string
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  isLoading?: boolean
  onStop?: () => void
  placeholder?: string
  disabled?: boolean
}

export function MessageInput({
  input,
  onChange,
  onSubmit,
  isLoading = false,
  onStop,
  placeholder = 'Ask a question about SEC 10-K filings (e.g. Apple FY24 net sales, Azure cloud revenue)…',
  disabled = false,
}: MessageInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`
    }
  }, [input])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (input.trim() && !isLoading && !disabled) {
        const form = e.currentTarget.form
        if (form) {
          form.requestSubmit()
        }
      }
    }
  }

  return (
    <div className="w-full border-t border-border bg-background p-4 md:px-8">
      <form
        onSubmit={onSubmit}
        className="mx-auto flex max-w-4xl flex-col gap-2"
        id="chat-input-form"
      >
        <div className="relative flex w-full items-end rounded-xl border border-border bg-card shadow-xs transition-all focus-within:border-foreground focus-within:ring-1 focus-within:ring-foreground">
          <textarea
            ref={textareaRef}
            id="chat-message-input"
            rows={1}
            value={input}
            onChange={onChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={placeholder}
            className="max-h-44 min-h-[44px] w-full resize-none bg-transparent px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />

          <div className="flex shrink-0 p-2">
            {isLoading ? (
              <Button
                type="button"
                id="stop-streaming-btn"
                variant="destructive"
                size="icon"
                onClick={onStop}
                title="Stop generation"
                className="h-8 w-8 rounded-lg cursor-pointer"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </Button>
            ) : (
              <Button
                type="submit"
                id="send-message-btn"
                size="icon"
                disabled={!input.trim() || disabled}
                title="Send message"
                className="h-8 w-8 rounded-lg bg-foreground text-background hover:bg-foreground/90 disabled:opacity-30 cursor-pointer"
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-1 text-[11px] text-muted-foreground">
          <span>
            Strict SEC 10-K Grounding · Zero Hallucination
          </span>
          <span className="hidden sm:inline-block">
            <kbd className="rounded border border-border bg-muted/60 px-1 py-0.5 font-mono text-[10px]">Enter ↵</kbd> to send · <kbd className="rounded border border-border bg-muted/60 px-1 py-0.5 font-mono text-[10px]">Shift+Enter</kbd> for newline
          </span>
        </div>
      </form>
    </div>
  )
}
