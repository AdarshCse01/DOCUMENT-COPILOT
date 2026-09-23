import React, { useEffect, useState, useCallback } from 'react'
import { Outlet, useNavigate, useParams } from 'react-router-dom'
import { Menu, PanelLeftOpen } from 'lucide-react'
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

  const handleDeleteThread = async (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await deleteThread(threadId)
      setThreads((prev) => prev.filter((t) => t.id !== threadId))
      if (activeThreadId === threadId) {
        navigate('/')
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
        <div className="relative flex flex-1 flex-col overflow-hidden">
          {/* Mobile Header with Sidebar Toggle */}
          <header className="flex h-14 items-center justify-between border-b border-border/80 px-4 md:hidden">
            <button
              type="button"
              id="mobile-sidebar-toggle-btn"
              onClick={() => setMobileSidebarOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="font-semibold text-sm">Document Copilot</span>
            <div className="w-9" />
          </header>

          {/* Desktop Reopen Sidebar Button (when sidebar is collapsed) */}
          {sidebarCollapsed && (
            <div className="absolute top-3 left-3 z-30 hidden md:block">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    id="expand-sidebar-btn"
                    onClick={() => setSidebarCollapsed(false)}
                    aria-label="Expand sidebar"
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card/90 text-foreground shadow-xs backdrop-blur-xs transition-colors hover:bg-accent"
                  >
                    <PanelLeftOpen className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  Expand sidebar <kbd className="ml-1 text-[10px] text-muted-foreground">Ctrl+B</kbd>
                </TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* Chat / Welcome Page */}
          <main className="relative flex flex-1 flex-col overflow-hidden">
            <Outlet />
          </main>
        </div>
      </div>
    </ChatContext.Provider>
  )
}
