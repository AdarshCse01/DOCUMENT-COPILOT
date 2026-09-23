import React, { useState } from 'react'
import { Plus, X, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
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

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffSec < 60) return `${Math.max(1, diffSec)} s...`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'Yesterday'
  return `${diffDays} days ago`
}

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

export function ThreadSidebar({
  threads,
  activeThreadId,
  onSelectThread,
  onNewChat,
  onDeleteThread,
  onRenameThread,
  onSignOut,
  isOpen = true,
  onCloseMobile,
  isCollapsed = false,
}: ThreadSidebarProps) {
  // Rename Dialog State
  const [renameTarget, setRenameTarget] = useState<ChatThread | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [isRenaming, setIsRenaming] = useState(false)

  const openRenameDialog = (thread: ChatThread, e: React.MouseEvent) => {
    e.stopPropagation()
    setRenameTarget(thread)
    setRenameValue(thread.title || '')
  }

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
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-zinc-200 bg-white transition-all duration-200 ease-in-out md:static ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } ${isCollapsed ? 'md:hidden' : 'w-64'}`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <div className="font-semibold text-[15px] text-zinc-900 leading-tight">Document Copilot</div>
            <div className="text-xs text-zinc-500 mt-0.5">SEC filing assistant</div>
          </div>

          {/* Mobile Close Button */}
          <button
            type="button"
            id="mobile-sidebar-close-btn"
            onClick={onCloseMobile}
            aria-label="Close sidebar"
            className="flex md:hidden h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Action: New Chat Button */}
        <div className="px-4 pb-3">
          <button
            type="button"
            id="new-chat-btn"
            onClick={() => {
              onNewChat()
              onCloseMobile?.()
            }}
            className="w-full flex items-center justify-start gap-2 bg-black text-white hover:bg-zinc-800 rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>New chat</span>
          </button>
        </div>

        {/* Separator and Section Header */}
        <hr className="border-t border-zinc-200 mx-4 my-1" />
        <div className="px-4 pt-2 pb-1 text-xs font-normal text-zinc-500">Conversations</div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
          {threads.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-zinc-400">
              No conversations yet.
            </div>
          ) : (
            threads.map((thread) => {
              const isActive = thread.id === activeThreadId

              return (
                <div
                  key={thread.id}
                  id={`thread-item-${thread.id}`}
                  onClick={() => {
                    onSelectThread(thread.id)
                    onCloseMobile?.()
                  }}
                  className={`group relative flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-xs transition-colors ${
                    isActive
                      ? 'bg-zinc-100 text-zinc-900 font-semibold'
                      : 'text-zinc-800 hover:bg-zinc-50 font-medium'
                  }`}
                >
                  <span className="truncate pr-2">{thread.title || 'New chat'}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[11px] text-zinc-400 font-normal">
                      {formatRelativeTime(thread.created_at || thread.updated_at)}
                    </span>

                    {/* 3-Dot Dropdown Menu for Rename and Delete on hover */}
                    <div
                      className="shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            id={`thread-menu-${thread.id}`}
                            aria-label="Thread actions"
                            className="h-5 w-5 flex items-center justify-center rounded text-zinc-400 opacity-0 group-hover:opacity-100 hover:bg-zinc-200 hover:text-zinc-900 transition-opacity"
                          >
                            <MoreHorizontal className="h-3 w-3" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-32 bg-white border border-zinc-200 shadow-md">
                          <DropdownMenuItem
                            onClick={(e) => openRenameDialog(thread, e)}
                            className="cursor-pointer text-xs"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span>Rename</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => onDeleteThread(thread.id, e)}
                            className="cursor-pointer text-xs text-destructive focus:text-destructive focus:bg-destructive/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Delete</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Sign Out Button Footer */}
        <div className="p-4 border-t border-zinc-200 mt-auto">
          <button
            type="button"
            id="sidebar-sign-out-btn"
            onClick={onSignOut}
            className="w-full py-2 px-3 border border-zinc-200 rounded-lg text-sm text-zinc-800 bg-white hover:bg-zinc-50 text-center font-medium transition-colors cursor-pointer"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Rename Dialog */}
      <Dialog open={!!renameTarget} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent className="sm:max-w-md bg-white border border-zinc-200">
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
              className="w-full h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:border-zinc-500"
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
                className="bg-black text-white hover:bg-zinc-800"
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
