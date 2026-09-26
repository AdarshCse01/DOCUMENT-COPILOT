import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createThread } from '@/lib/api'
import { useChatContext } from '@/components/chat/useChatContext'
import { MessageInput } from '@/components/chat/MessageInput'

const STARTER_PROMPTS = [
  "Across Apple’s 2021–2025 10-Ks, how did the revenue mix between iPhone, Services, Mac, iPad, and Wearables change?",
  "For Amazon, compare AWS operating income and margin against North America and International from 2021–2025.",
  "How did NVIDIA describe demand drivers, customer concentration, and supply constraints for its Data Center business?",
  "Across Microsoft filings, what changed in how the company describes Azure, AI infrastructure, and cloud capacity constraints?",
]

export default function ChatWelcomePage() {
  const navigate = useNavigate()
  const { refreshThreads } = useChatContext()
  const [isCreating, setIsCreating] = useState(false)
  const [input, setInput] = useState('')

  const handleStartChat = async (promptText: string) => {
    if (!promptText.trim() || isCreating) return
    setIsCreating(true)

    try {
      const title =
        promptText.length > 75
          ? `${promptText.slice(0, 72).trim()}…`
          : promptText.trim()

      const newThread = await createThread(title)
      await refreshThreads()

      navigate(`/chat/${newThread.id}`, {
        state: { initialPrompt: promptText },
      })
    } catch (err) {
      console.error('Failed to create thread:', err)
      setIsCreating(false)
    }
  }

  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim()) {
      handleStartChat(input.trim())
    }
  }

  return (
    <div className="flex h-full w-full flex-col justify-between bg-white overflow-hidden">
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 overflow-y-auto">
        <div className="mx-auto flex max-w-2xl w-full flex-col items-center text-center">
          {/* Brand Icon */}
          <div className="mb-4 flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-black shadow-xs p-1.5">
            <img src="/log.png" alt="Document Copilot Logo" className="h-6 w-6 sm:h-7 sm:w-7 object-contain" />
          </div>

          {/* Heading */}
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
            Ask about SEC filings
          </h1>

          {/* Subtitle */}
          <p className="mt-2 text-sm text-gray-500 text-center">
            Every answer is grounded in source documents with citations.
          </p>

          {/* Starter Prompts Grid */}
          <div className="mt-8 grid w-full grid-cols-1 gap-3 sm:grid-cols-2 text-left">
            {STARTER_PROMPTS.map((promptText, idx) => (
              <button
                type="button"
                key={idx}
                id={`starter-card-${idx}`}
                onClick={() => handleStartChat(promptText)}
                className="rounded-lg border border-gray-200 bg-white p-4 text-sm leading-relaxed text-gray-800 hover:bg-gray-50 hover:border-gray-300 transition-colors cursor-pointer text-left font-normal select-none"
              >
                {promptText}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Composer */}
      <MessageInput
        input={input}
        onChange={(e) => setInput(e.target.value)}
        onSubmit={handleInputSubmit}
        isLoading={isCreating}
        disabled={isCreating}
      />
    </div>
  )
}
