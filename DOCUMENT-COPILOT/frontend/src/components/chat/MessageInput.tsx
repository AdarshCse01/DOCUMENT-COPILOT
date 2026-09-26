import React, { useRef, useEffect } from 'react'
import { ArrowUp, Square } from 'lucide-react'

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
      const nextHeight = Math.min(Math.max(textareaRef.current.scrollHeight, 40), 160)
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
        <div className="relative flex items-end rounded-2xl border border-gray-200 bg-white p-2.5 shadow-xs transition-colors focus-within:border-gray-400 focus-within:ring-1 focus-within:ring-gray-300">
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
            className="flex-1 max-h-40 min-h-[40px] resize-none bg-transparent px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none leading-relaxed"
          />

          {/* Send / Stop Action Button */}
          <div className="pb-1 pr-1 shrink-0 flex items-center">
            {isLoading ? (
              <button
                type="button"
                id="stop-streaming-btn"
                onClick={onStop}
                title="Stop generation"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-black text-white hover:bg-gray-800 transition-colors cursor-pointer"
              >
                <Square className="h-3 w-3 fill-white text-white" />
              </button>
            ) : (
              <button
                type="submit"
                id="send-message-btn"
                disabled={isSendDisabled}
                title="Send message"
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-all ${
                  !isSendDisabled
                    ? 'bg-black text-white hover:bg-gray-800 cursor-pointer shadow-xs'
                    : 'bg-gray-300 text-white cursor-not-allowed'
                }`}
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Centered Footnote Disclaimer */}
        <div className="mt-2.5 text-center text-xs text-gray-400 select-none">
          Answers are grounded in SEC filings. Verify citations before relying on them.
        </div>
      </form>
    </div>
  )
}
