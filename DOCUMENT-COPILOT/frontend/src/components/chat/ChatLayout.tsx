import React, { useEffect, useState, useCallback } from 'react'
import { Outlet, useNavigate, useParams } from 'react-router-dom'
import { Menu, PanelLeft, User } from 'lucide-react'
import {
  deleteThread,
  listThreads,
  updateThreadTitle,
  type ChatThread,
} from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ThreadSidebar } from './ThreadSidebar'
import { ChatContext } from './ChatContext'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useToast } from '@/components/common/Toast'

const SIDEBAR_COLLAPSED_KEY = 'doc_copilot_sidebar_collapsed'

export function ChatLayout() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const params = useParams<{ threadId?: string }>()
  const activeThreadId = params.threadId

  const [threads, setThreads] = useState<ChatThread[]>([])
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true'
    } catch {
      return false
    }
  })

  // Persist sidebar state
  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed))
    } catch {
      // Ignore localStorage failure in restricted contexts
    }
  }, [sidebarCollapsed])

  // Global Ctrl+B / Cmd+B keyboard shortcut to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        setSidebarCollapsed((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const fetchThreads = useCallback(async () => {
    try {
      const data = await listThreads()
      setThreads(data)
    } catch (err) {
      console.error('Failed to load threads:', err)
    }
  }, [])

  useEffect(() => {
    let ignore = false
    listThreads()
      .then((data) => {
        if (!ignore) {
          setThreads(data)
        }
      })
      .catch((err) => {
        console.error('Failed to load threads:', err)
      })
    return () => {
      ignore = true
    }
  }, [])

  const handleSelectThread = (threadId: string) => {
    navigate(`/chat/${threadId}`)
  }

  const handleNewChat = () => {
    navigate('/')
  }

  const { showToast } = useToast()

  const handleDeleteThread = async (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await deleteThread(threadId)
      setThreads((prev) => prev.filter((t) => t.id !== threadId))
      showToast('Conversation deleted')
      if (activeThreadId === threadId) {
        navigate('/chats')
      }
    } catch (err) {
      console.error('Failed to delete thread:', err)
    }
  }

  const handleRenameThread = async (threadId: string, newTitle: string) => {
    try {
      const updated = await updateThreadTitle(threadId, newTitle)
      setThreads((prev) =>
        prev.map((t) => (t.id === threadId ? { ...t, title: updated.title } : t)),
      )
    } catch (err) {
      console.error('Failed to rename thread:', err)
      throw err
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/sign-in', { replace: true })
  }

  return (
    <ChatContext.Provider
      value={{
        threads,
        refreshThreads: fetchThreads,
        activeThreadId,
      }}
    >
      <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
        {/* Thread Sidebar (collapsible desktop + offcanvas mobile) */}
        <ThreadSidebar
          threads={threads}
          activeThreadId={activeThreadId}
          onSelectThread={handleSelectThread}
          onNewChat={handleNewChat}
          onDeleteThread={handleDeleteThread}
          onRenameThread={handleRenameThread}
          userEmail={user?.email}
          onSignOut={handleSignOut}
          isOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        />

        {/* Main Content Area */}
        <div className="relative flex flex-1 flex-col overflow-hidden min-w-0 bg-white">
          {/* Mobile Header with Sidebar Toggle */}
          <header className="flex h-14 items-center justify-between border-b border-border/80 px-4 md:hidden bg-white shrink-0">
            <button
              type="button"
              id="mobile-sidebar-toggle-btn"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open navigation menu"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="font-semibold text-sm">Document Copilot</span>
            <div
              title={user?.email || 'User Profile'}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 text-xs"
            >
              <User className="h-4 w-4" />
            </div>
          </header>

          {/* Desktop Navigation Header */}
          <header className="hidden md:flex h-11 items-center px-4 shrink-0 border-b border-zinc-200/80 bg-white">
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    id="desktop-sidebar-toggle-btn"
                    onClick={() => setSidebarCollapsed((prev) => !prev)}
                    aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors cursor-pointer"
                  >
                    <PanelLeft className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} <kbd className="ml-1 text-[10px] text-zinc-400">Ctrl+B</kbd>
                </TooltipContent>
              </Tooltip>
              <span className="text-xs font-semibold text-zinc-900">Document Copilot</span>
            </div>
          </header>

          {/* Chat / Welcome Page */}
          <main className="relative flex flex-1 flex-col overflow-hidden min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </ChatContext.Provider>
  )
}
