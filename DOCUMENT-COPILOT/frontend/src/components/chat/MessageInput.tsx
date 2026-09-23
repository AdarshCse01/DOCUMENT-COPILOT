import React, { useRef } from 'react'

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
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="w-full bg-white px-4 py-4 border-t border-zinc-100">
      <form
        onSubmit={onSubmit}
        className="mx-auto flex max-w-3xl items-center gap-2 w-full"
        id="chat-input-form"
      >
        <input
          ref={inputRef}
          type="text"
          id="chat-message-input"
          value={input}
          onChange={onChange}
          disabled={disabled || isLoading}
          placeholder={placeholder}
          autoComplete="off"
          className="flex-1 h-10 rounded-lg border border-zinc-200 bg-white px-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400 transition-colors"
        />

        {isLoading ? (
          <button
            type="button"
            id="stop-streaming-btn"
            onClick={onStop}
            title="Stop generation"
            className="h-10 px-4 rounded-lg bg-zinc-600 hover:bg-zinc-700 text-white text-sm font-medium transition-colors cursor-pointer"
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            id="send-message-btn"
            disabled={!input.trim() || disabled}
            title="Send message"
            className="h-10 px-4 rounded-lg bg-zinc-600 hover:bg-zinc-700 disabled:opacity-50 text-white text-sm font-medium transition-colors cursor-pointer"
          >
            Send
          </button>
        )}
      </form>
    </div>
  )
}

