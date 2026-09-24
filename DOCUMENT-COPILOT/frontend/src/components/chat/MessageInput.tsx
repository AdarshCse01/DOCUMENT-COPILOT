import React, { useRef, useEffect } from 'react'
import { ArrowUp, Square, Mic } from 'lucide-react'

interface MessageInputProps {
  input: string
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
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
  placeholder = 'Ask about SEC filings...',
  disabled = false,
}: MessageInputProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea as content changes
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      const nextHeight = Math.min(Math.max(textareaRef.current.scrollHeight, 38), 160)
      textareaRef.current.style.height = `${nextHeight}px`
    }
  }, [input])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (input.trim() && !disabled && !isLoading) {
        formRef.current?.requestSubmit()
      }
    }
  }

  const isSendDisabled = !input.trim() || disabled || isLoading

  return (
    <div className="w-full bg-white px-4 pb-4 pt-2 shrink-0">
      <form
        ref={formRef}
        onSubmit={onSubmit}
        className="mx-auto flex max-w-3xl flex-col w-full"
        id="chat-input-form"
      >
        {/* Main Rounded Composer Card */}
        <div className="relative flex items-end rounded-2xl border border-zinc-200 bg-white p-2 shadow-xs transition-colors focus-within:border-zinc-400 focus-within:ring-1 focus-within:ring-zinc-400/20">
          <textarea
            ref={textareaRef}
            id="chat-message-input"
            rows={1}
            value={input}
            onChange={onChange}
            onKeyDown={handleKeyDown}
            disabled={disabled || isLoading}
            placeholder={placeholder}
            autoComplete="off"
            className="flex-1 max-h-40 min-h-[38px] resize-none bg-transparent px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none leading-relaxed"
          />

          {/* Send / Stop Action Button inside composer */}
          <div className="pb-1 pr-1 shrink-0 flex items-center gap-1">
            <button
              type="button"
              id="voice-input-btn"
              aria-label="Voice input"
              title="Voice input"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors cursor-pointer"
            >
              <Mic className="h-4 w-4" />
            </button>

            {isLoading ? (
              <button
                type="button"
                id="stop-streaming-btn"
                onClick={onStop}
                title="Stop generation"
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white hover:bg-black transition-colors cursor-pointer"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                id="send-message-btn"
                disabled={isSendDisabled}
                title="Send message"
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
                  !isSendDisabled
                    ? 'bg-zinc-900 text-white hover:bg-black cursor-pointer shadow-2xs'
                    : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                }`}
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Footnote Bar matching reference screenshot */}
        <div className="mt-2 flex items-center justify-between px-2 text-[11px] text-zinc-400 select-none">
          <span>Strict SEC 10-K Grounding · Zero Hallucination</span>
          <span>Enter ↵ to send · Shift+Enter for newline</span>
        </div>
      </form>
    </div>
  )
}
