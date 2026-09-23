import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, TrendingUp, Sparkles, Building2, ShieldAlert, ArrowRight } from 'lucide-react'
import { createThread } from '@/lib/api'
import { useChatContext } from '@/components/chat/useChatContext'
import { MessageInput } from '@/components/chat/MessageInput'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

const STARTER_PROMPTS = [
  {
    ticker: 'AAPL',
    company: 'Apple Inc.',
    prompt: "What was Apple's total net sales and product revenue mix in FY2024?",
    icon: TrendingUp,
  },
  {
    ticker: 'MSFT',
    company: 'Microsoft Corp.',
    prompt: "Compare Microsoft's Intelligent Cloud segment revenue and Azure growth YoY.",
    icon: Building2,
  },
  {
    ticker: 'NVDA',
    company: 'NVIDIA Corp.',
    prompt: "Summarize NVIDIA's Data Center revenue drivers and major customer concentration.",
    icon: Sparkles,
  },
  {
    ticker: 'GOOGL',
    company: 'Alphabet Inc.',
    prompt: "What are Alphabet's primary risk factors and competition disclosures in their latest 10-K?",
    icon: ShieldAlert,
  },
]

export default function ChatWelcomePage() {
  const navigate = useNavigate()
  const { refreshThreads } = useChatContext()
  const [input, setInput] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const handleStartChat = async (promptText: string) => {
    if (!promptText.trim() || isCreating) return
    setIsCreating(true)

    try {
      const title =
        promptText.length > 40
          ? `${promptText.slice(0, 37).trim()}…`
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

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    handleStartChat(input)
  }

  return (
    <div className="flex h-full flex-col justify-between overflow-hidden bg-background">
      {/* Scrollable Center Content */}
      <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-8 md:px-8">
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          {/* Brand Icon and Header Badge */}
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-foreground text-background shadow-xs">
            <FileText className="h-6 w-6" />
          </div>

          <div className="mb-3 flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-[10px] tracking-wider uppercase">
              SEC 10-K Grounded Copilot
            </Badge>
            <Badge variant="verified" size="sm">
              Strict Verification
            </Badge>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            Financial Filing Intelligence
          </h1>

          <p className="mt-2 max-w-lg text-sm text-muted-foreground md:text-base leading-relaxed">
            Corpus-grounded financial analysis. Ask questions strictly anchored in SEC 10-K filings from Apple, Microsoft, NVIDIA, Amazon, and Alphabet.
          </p>

          {/* Starter Suggestions Grid using Card primitives */}
          <div className="mt-8 grid w-full grid-cols-1 gap-3 sm:grid-cols-2 text-left">
            {STARTER_PROMPTS.map((item) => {
              const Icon = item.icon
              return (
                <Card
                  key={item.ticker}
                  id={`starter-card-${item.ticker}`}
                  onClick={() => handleStartChat(item.prompt)}
                  className="group cursor-pointer border-border hover:border-foreground/50 transition-all hover:shadow-xs"
                >
                  <CardContent className="p-4 flex flex-col justify-between h-full">
                    <div>
                      <div className="mb-2 flex w-full items-center justify-between">
                        <Badge variant="outline" className="font-mono text-xs font-semibold">
                          {item.ticker}
                        </Badge>
                        <Icon className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
                      </div>
                      <p className="text-xs text-foreground font-medium leading-relaxed">
                        {item.prompt}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t border-border/40">
                      <span>{item.company}</span>
                      <ArrowRight className="h-3 w-3 opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </div>

      {/* Input Surface */}
      <MessageInput
        input={input}
        onChange={(e) => setInput(e.target.value)}
        onSubmit={handleSubmit}
        isLoading={isCreating}
        disabled={isCreating}
        placeholder="Ask a question about 10-K filings to start a new chat…"
      />
    </div>
  )
}
