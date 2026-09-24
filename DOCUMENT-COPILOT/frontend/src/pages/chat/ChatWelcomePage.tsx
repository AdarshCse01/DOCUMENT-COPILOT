import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createThread } from '@/lib/api'
import { useChatContext } from '@/components/chat/useChatContext'

const STARTER_PROMPTS = [
  "Across Apple's 2021–2025 10-Ks, how did the revenue mix between iPhone, Services, Mac, iPad, and Wearables change?",
  "For Amazon, compare AWS operating income and margin against North America and International from 2021–2025.",
  "How did NVIDIA describe demand drivers, customer concentration, and supply constraints for its Data Center business?",
  "Across Microsoft filings, what changed in how the company describes Azure, AI infrastructure, and cloud capacity constraints?",
]

export default function ChatWelcomePage() {
  const navigate = useNavigate()
  const { refreshThreads } = useChatContext()
  const [isCreating, setIsCreating] = useState(false)

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

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-white px-4 py-8">
      <div className="mx-auto flex max-w-xl flex-col items-center text-center">
        {/* Brand Icon */}
        <div className="mb-4 flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-black shadow-xs p-1.5">
          <img src="/log.png" alt="Document Copilot Logo" className="h-6 w-6 sm:h-7 sm:w-7 object-contain" />
        </div>

        {/* Heading */}
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900">
          How can I help with your filings?
        </h1>

        {/* Subtitle */}
        <p className="mt-1.5 max-w-sm sm:max-w-md text-xs sm:text-[13px] text-zinc-500 leading-relaxed text-center">
          Ask a question about SEC filings. Every answer is grounded in source documents with verifiable citations.
        </p>

        {/* Starter Prompts Grid */}
        <div className="mt-6 grid w-full grid-cols-1 gap-3 sm:grid-cols-2 text-left">
          {STARTER_PROMPTS.map((promptText, idx) => (
            <div
              key={idx}
              id={`starter-card-${idx}`}
              onClick={() => handleStartChat(promptText)}
              className="rounded-2xl border border-zinc-200/90 bg-white p-4 text-xs leading-relaxed text-zinc-800 hover:border-zinc-300 hover:shadow-2xs transition-all cursor-pointer select-none"
            >
              {promptText}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
