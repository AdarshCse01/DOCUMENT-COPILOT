import React, { useState, useMemo } from 'react'
import {
  Plus,
  X,
  MoreHorizontal,
  Trash2,
  LogOut,
} from 'lucide-react'
import { type ChatThread } from '@/lib/api'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface ThreadSidebarProps {
  threads: ChatThread[]
  activeThreadId?: string
  onSelectThread: (threadId: string) => void
  onNewChat: () => void
  onDeleteThread: (threadId: string, e: React.MouseEvent) => void
  onRenameThread?: (threadId: string, newTitle: string) => Promise<void>
  userEmail?: string
  onSignOut: () => void
  isOpen?: boolean
  onCloseMobile?: () => void
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

function groupThreadsByDate(threads: ChatThread[]) {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000
  const sevenDaysAgo = startOfToday - 7 * 24 * 60 * 60 * 1000

  const today: ChatThread[] = []
  const yesterday: ChatThread[] = []
  const previous7Days: ChatThread[] = []
  const older: ChatThread[] = []

  for (const thread of threads) {
    const timeStr = thread.created_at || thread.updated_at
    const threadTime = timeStr ? new Date(timeStr).getTime() : 0
    if (threadTime >= startOfToday) {
      today.push(thread)
    } else if (threadTime >= startOfYesterday) {
      yesterday.push(thread)
    } else if (threadTime >= sevenDaysAgo) {
      previous7Days.push(thread)
    } else {
      older.push(thread)
    }
  }

  if (today.length === 0 && yesterday.length === 0 && previous7Days.length === 0 && older.length === 0 && threads.length > 0) {
    today.push(...threads)
  }

  return { today, yesterday, previous7Days, older }
}

export function ThreadSidebar({
  threads,
  activeThreadId,
  onSelectThread,
  onNewChat,
  onDeleteThread,
  onRenameThread,
  userEmail,
  onSignOut,
  isOpen = true,
  onCloseMobile,
  isCollapsed = false,
}: ThreadSidebarProps) {
  // Rename Dialog State
  const [renameTarget, setRenameTarget] = useState<ChatThread | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [isRenaming, setIsRenaming] = useState(false)

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!renameTarget || !renameValue.trim() || isRenaming) return

    setIsRenaming(true)
    try {
      if (onRenameThread) {
        await onRenameThread(renameTarget.id, renameValue.trim())
      }
      setRenameTarget(null)
    } catch (err) {
      console.error('Failed to rename thread:', err)
    } finally {
      setIsRenaming(false)
    }
  }

  const groups = useMemo(() => groupThreadsByDate(threads), [threads])

  const initials = useMemo(() => {
    if (!userEmail) return 'DA'
    const namePart = userEmail.split('@')[0]
    return namePart.slice(0, 2).toUpperCase()
  }, [userEmail])

  const renderThreadItem = (thread: ChatThread) => {
    const isActive = thread.id === activeThreadId

    return (
      <div
        key={thread.id}
        id={`thread-item-${thread.id}`}
        onClick={() => {
          onSelectThread(thread.id)
          onCloseMobile?.()
        }}
        className={`group relative flex cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-sm transition-colors ${
          isActive
            ? 'bg-gray-100 text-gray-900 font-medium'
            : 'text-gray-700 hover:bg-gray-100 font-normal'
        }`}
      >
        <span
          className="truncate pr-1 flex-1 min-w-0"
          title={thread.title || 'New chat'}
        >
          {thread.title || 'New chat'}
        </span>

        <button
          type="button"
          id={`thread-delete-${thread.id}`}
          aria-label="Delete thread"
          onClick={(e) => onDeleteThread(thread.id, e)}
          className={`h-5 w-5 flex items-center justify-center rounded text-gray-400 hover:text-gray-800 transition-opacity cursor-pointer shrink-0 ${
            isActive ? 'opacity-100 text-gray-600' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs md:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Main Sidebar Element */}
      <aside
        id="chat-sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-gray-200 bg-white transition-all duration-300 ease-in-out md:static ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } ${
          isCollapsed
            ? 'md:w-0 md:opacity-0 md:border-r-0 md:pointer-events-none overflow-hidden'
            : 'md:w-64 md:opacity-100 overflow-hidden'
        }`}
      >
        <div className="w-64 flex flex-col h-full shrink-0">
          {/* Brand Header */}
          <div className="flex items-center justify-between px-3 pt-3.5 pb-2.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-black text-white shrink-0 p-1 shadow-2xs">
                <img src="/log.png" alt="Document Copilot" className="h-5 w-5 object-contain" />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-xs text-gray-900 leading-tight">Document Copilot</span>
                <span className="text-[11px] text-gray-500 leading-tight">SEC filing assistant</span>
              </div>
            </div>

            {/* Mobile Close Button */}
            <button
              type="button"
              id="mobile-sidebar-close-btn"
              onClick={onCloseMobile}
              aria-label="Close sidebar"
              className="flex md:hidden h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Action: New Chat Button as a simple flex row */}
          <div className="px-2 pb-2 pt-1">
            <button
              type="button"
              id="new-chat-btn"
              onClick={() => {
                onNewChat()
                onCloseMobile?.()
              }}
              className="w-full flex items-center justify-start gap-2.5 text-gray-700 hover:bg-gray-100 rounded-md px-2.5 py-2 text-sm font-normal transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4 text-gray-600 shrink-0" />
              <span>New chat</span>
            </button>
          </div>

          {/* Conversations List grouped by time */}
          <div className="flex-1 overflow-y-auto px-2 space-y-3">
            {threads.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-gray-400">
                No conversations yet.
              </div>
            ) : (
              <>
                {groups.today.length > 0 && (
                  <div>
                    <div className="px-2.5 pb-1 pt-1 text-xs font-medium text-gray-400">
                      Today
                    </div>
                    <div className="space-y-0.5">
                      {groups.today.map(renderThreadItem)}
                    </div>
                  </div>
                )}

                {groups.yesterday.length > 0 && (
                  <div>
                    <div className="px-2.5 pb-1 pt-2 text-xs font-medium text-gray-400">
                      Yesterday
                    </div>
                    <div className="space-y-0.5">
                      {groups.yesterday.map(renderThreadItem)}
                    </div>
                  </div>
                )}

                {groups.previous7Days.length > 0 && (
                  <div>
                    <div className="px-2.5 pb-1 pt-2 text-xs font-medium text-gray-400">
                      Previous 7 Days
                    </div>
                    <div className="space-y-0.5">
                      {groups.previous7Days.map(renderThreadItem)}
                    </div>
                  </div>
                )}

                {groups.older.length > 0 && (
                  <div>
                    <div className="px-2.5 pb-1 pt-2 text-xs font-medium text-gray-400">
                      Older
                    </div>
                    <div className="space-y-0.5">
                      {groups.older.map(renderThreadItem)}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* User Profile Footer */}
          <div className="p-3 border-t border-gray-100 mt-auto flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="h-7 w-7 rounded-full bg-black text-white text-[11px] font-semibold flex items-center justify-center shrink-0">
                {initials}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium text-gray-900 truncate leading-tight">
                  {userEmail || 'dave@driftwood.com'}
                </span>
                <span className="text-[11px] text-gray-400 leading-tight">
                  Signed in
                </span>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  id="sidebar-user-menu-btn"
                  aria-label="User actions"
                  className="h-7 w-7 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-800 transition-colors cursor-pointer shrink-0"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-white border border-gray-200 shadow-md">
                <div className="px-2 py-1.5 text-xs text-gray-500">
                  Signed in as <strong className="text-gray-900 block truncate">{userEmail || 'dave@driftwood.com'}</strong>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onSignOut}
                  id="sidebar-sign-out-btn"
                  className="cursor-pointer text-xs text-red-600 focus:text-red-700 focus:bg-red-50"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {/* Rename Dialog */}
      <Dialog open={!!renameTarget} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent className="sm:max-w-md bg-white border border-gray-200">
          <DialogHeader>
            <DialogTitle>Rename conversation</DialogTitle>
            <DialogDescription>
              Enter a new title for this conversation.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRenameSubmit} className="space-y-4 pt-2">
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="Conversation title"
              disabled={isRenaming}
              autoFocus
              className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:border-gray-500"
            />
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRenameTarget(null)}
                disabled={isRenaming}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!renameValue.trim() || isRenaming}
                className="bg-black text-white hover:bg-gray-800"
              >
                {isRenaming ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
