import React, { useState } from 'react'
import {
  FileText,
  LogOut,
  MessageSquare,
  MoreHorizontal,
  PanelLeftClose,
  Pencil,
  Plus,
  Settings,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'
import { type ChatThread } from '@/lib/api'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ScrollArea } from '@/components/ui/scroll-area'

interface ThreadGroup {
  label: string
  threads: ChatThread[]
}

function groupThreadsByDate(threads: ChatThread[]): ThreadGroup[] {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const oneDayMs = 24 * 60 * 60 * 1000
  const yesterdayStart = todayStart - oneDayMs
  const sevenDaysAgoStart = todayStart - 6 * oneDayMs

  const today: ChatThread[] = []
  const yesterday: ChatThread[] = []
  const previous7Days: ChatThread[] = []
  const older: ChatThread[] = []

  for (const thread of threads) {
    const threadTime = new Date(thread.updated_at || thread.created_at).getTime()
    if (threadTime >= todayStart) {
      today.push(thread)
    } else if (threadTime >= yesterdayStart) {
      yesterday.push(thread)
    } else if (threadTime >= sevenDaysAgoStart) {
      previous7Days.push(thread)
    } else {
      older.push(thread)
    }
  }

  const groups: ThreadGroup[] = []
  if (today.length > 0) groups.push({ label: 'Today', threads: today })
  if (yesterday.length > 0) groups.push({ label: 'Yesterday', threads: yesterday })
  if (previous7Days.length > 0) groups.push({ label: 'Previous 7 Days', threads: previous7Days })
  if (older.length > 0) groups.push({ label: 'Older', threads: older })

  return groups
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
  userEmail,
  onSignOut,
  isOpen = true,
  onCloseMobile,
  isCollapsed = false,
  onToggleCollapse,
}: ThreadSidebarProps) {
  // Rename Dialog State
  const [renameTarget, setRenameTarget] = useState<ChatThread | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [isRenaming, setIsRenaming] = useState(false)

  // Settings Dialog State
  const [settingsOpen, setSettingsOpen] = useState(false)

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

  const userInitials = (userEmail ? userEmail.slice(0, 2) : 'AN').toUpperCase()
  const threadGroups = groupThreadsByDate(threads)

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-xs md:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Main Sidebar Element */}
      <aside
        id="chat-sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200 ease-in-out md:static ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } ${isCollapsed ? 'md:hidden' : 'w-72'}`}
      >
        {/* Brand Header */}
        <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-3.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-background shadow-xs shrink-0">
              <FileText className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-semibold text-xs tracking-tight text-sidebar-foreground truncate">
                Document Copilot
              </span>
              <Badge variant="outline" size="sm" className="font-mono text-[9px] px-1 py-0 uppercase">
                10-K
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Desktop Collapse Button */}
            {onToggleCollapse && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    id="collapse-sidebar-btn"
                    onClick={onToggleCollapse}
                    aria-label="Collapse sidebar"
                    className="hidden md:flex h-7 w-7 items-center justify-center rounded-md text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  Collapse sidebar <kbd className="ml-1 text-[10px] text-muted-foreground">Ctrl+B</kbd>
                </TooltipContent>
              </Tooltip>
            )}

            {/* Mobile Close Button */}
            <button
              type="button"
              id="mobile-sidebar-close-btn"
              onClick={onCloseMobile}
              aria-label="Close sidebar"
              className="flex md:hidden h-7 w-7 items-center justify-center rounded-md text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Action: New Chat Button */}
        <div className="p-3 pb-2">
          <Button
            type="button"
            id="new-chat-btn"
            variant="outline"
            onClick={() => {
              onNewChat()
              onCloseMobile?.()
            }}
            className="w-full justify-start gap-2 bg-sidebar-accent/40 hover:bg-sidebar-accent border-sidebar-border text-xs h-9 font-medium"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Chat</span>
          </Button>
        </div>

        {/* Past Conversations List with Date Grouping */}
        <ScrollArea className="flex-1 px-2 py-1">
          {threads.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">
              No conversations yet. Start a new chat to begin SEC 10-K filing analysis.
            </div>
          ) : (
            <div className="space-y-4 pb-2">
              {threadGroups.map((group) => (
                <div key={group.label} className="space-y-1">
                  <div className="px-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    {group.label}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {group.threads.map((thread) => {
                      const isActive = thread.id === activeThreadId

                      return (
                        <div
                          key={thread.id}
                          id={`thread-item-${thread.id}`}
                          onClick={() => {
                            onSelectThread(thread.id)
                            onCloseMobile?.()
                          }}
                          className={`group relative flex cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-xs font-medium transition-all ${
                            isActive
                              ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-2xs border border-border/80'
                              : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground border border-transparent'
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-2 pr-1">
                            <MessageSquare
                              className={`h-3.5 w-3.5 shrink-0 ${
                                isActive ? 'text-foreground' : 'text-muted-foreground'
                              }`}
                            />
                            <span className="truncate">{thread.title || 'Untitled Chat'}</span>
                          </div>

                          {/* 3-Dot Dropdown Menu for Rename and Delete */}
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
                                  className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-opacity"
                                >
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-36">
                                <DropdownMenuItem
                                  onClick={(e) => openRenameDialog(thread, e)}
                                  className="cursor-pointer"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  <span>Rename</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={(e) => onDeleteThread(thread.id, e)}
                                  className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  <span>Delete</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* User Profile Footer */}
        <div className="border-t border-sidebar-border p-2.5">
          <div className="flex items-center justify-between rounded-lg bg-sidebar-accent/30 p-2 text-xs border border-sidebar-border/40">
            <div className="flex items-center gap-2 min-w-0 flex-1 pr-1">
              <Avatar className="h-7 w-7 border-border">
                <AvatarFallback>{userInitials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-sidebar-foreground">
                  {userEmail || 'Analyst'}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <ShieldCheck className="h-3 w-3 text-foreground" />
                  <span>Verified Analyst</span>
                </div>
              </div>
            </div>

            {/* User Dropdown for Settings and Sign Out */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  id="sidebar-user-menu-btn"
                  title="User settings"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="font-normal text-[11px]">
                  Signed in as
                  <div className="truncate font-semibold text-foreground">
                    {userEmail || 'Analyst'}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setSettingsOpen(true)}
                  className="cursor-pointer"
                >
                  <Settings className="h-3.5 w-3.5" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onSignOut}
                  id="sidebar-sign-out-btn"
                  className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {/* Rename Thread Modal */}
      <Dialog
        open={Boolean(renameTarget)}
        onOpenChange={(open) => !open && setRenameTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Conversation</DialogTitle>
            <DialogDescription>
              Enter a descriptive title for this conversation thread.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRenameSubmit} className="space-y-4 pt-2">
            <input
              type="text"
              id="rename-thread-input"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="Conversation title"
              autoFocus
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-2xs outline-none focus:border-ring focus:ring-1 focus:ring-ring"
            />

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenameTarget(null)}
                disabled={isRenaming}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!renameValue.trim() || isRenaming}
              >
                {isRenaming ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Settings Modal */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Document Copilot Settings</DialogTitle>
            <DialogDescription>
              Environment configuration and grounding engine details.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2 text-xs">
            <div className="flex items-center justify-between rounded-md border border-border p-2.5">
              <span className="text-muted-foreground">Account</span>
              <span className="font-medium text-foreground truncate max-w-[200px]">
                {userEmail || 'Analyst'}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-2.5">
              <span className="text-muted-foreground">Retrieval Engine</span>
              <Badge variant="outline" className="font-mono text-[10px]">
                SEC 10-K Hybrid (BM25 + Dense)
              </Badge>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-2.5">
              <span className="text-muted-foreground">Grounding Contract</span>
              <Badge variant="outline" className="font-mono text-[10px]">
                Strict Refusal / Zero Hallucination
              </Badge>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-2.5">
              <span className="text-muted-foreground">System Version</span>
              <span className="font-mono text-muted-foreground">v0.7.0 (Phase 7)</span>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSettingsOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
