'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useChatStore } from '@/stores/chat-store'
import { MessageBubble } from './message-bubble'
import { MessageComposer } from './message-composer'
import { cn } from '@/lib/utils'
import {
  ArrowRightLeft,
  CheckCircle,
  XCircle,
  PanelRight,
  Bot,
  Phone,
  Loader2,
  ArrowDown,
} from 'lucide-react'
import type { Conversation, Message } from '@/types/database'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_BADGE_VARIANTS: Record<string, { label: string; className: string }> = {
  pending: {
    label: 'Pending',
    className: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30',
  },
  open: {
    label: 'Open',
    className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  },
  waiting: {
    label: 'Waiting',
    className: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30',
  },
  resolved: {
    label: 'Resolved',
    className: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
  },
  closed: {
    label: 'Closed',
    className: 'bg-muted text-muted-foreground border-border',
  },
}

function formatDateSeparator(dateStr: string): string {
  const date = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  })
}

function groupMessagesByDate(messages: Message[]): [string, Message[]][] {
  const groups = new Map<string, Message[]>()

  for (const msg of messages) {
    const dateKey = new Date(msg.created_at).toDateString()
    const existing = groups.get(dateKey) || []
    existing.push(msg)
    groups.set(dateKey, existing)
  }

  return Array.from(groups.entries())
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface MessageThreadProps {
  conversationId: string
}

export function MessageThread({ conversationId }: MessageThreadProps) {
  const messages = useChatStore((s) => s.messages)
  const isLoadingMessages = useChatStore((s) => s.isLoadingMessages)
  const setMessages = useChatStore((s) => s.setMessages)
  const conversations = useChatStore((s) => s.conversations)
  const rightPanelOpen = useChatStore((s) => s.rightPanelOpen)
  const setRightPanelOpen = useChatStore((s) => s.setRightPanelOpen)
  const updateConversation = useChatStore((s) => s.updateConversation)

  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [showScrollDown, setShowScrollDown] = useState(false)
  const [isActioning, setIsActioning] = useState(false)

  const conversation = conversations.find((c) => c.id === conversationId)
  const contact = conversation?.contact

  // Fetch messages when conversationId changes
  useEffect(() => {
    if (!conversationId) return

    let cancelled = false

    async function fetchMessages() {
      try {
        const res = await fetch(`/api/conversations/${conversationId}/messages`)
        if (!res.ok) throw new Error('Failed to fetch messages')
        const data = await res.json()
        if (!cancelled) {
          setMessages(data.data ?? data)
        }
      } catch (err) {
        console.error('Error fetching messages:', err)
        if (!cancelled) setMessages([])
      }
    }

    fetchMessages()
    return () => {
      cancelled = true
    }
  }, [conversationId, setMessages])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  // Track scroll position for the "scroll down" button
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget
    const isNearBottom =
      target.scrollHeight - target.scrollTop - target.clientHeight < 100
    setShowScrollDown(!isNearBottom)
  }, [])

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Grouped messages
  const groupedMessages = useMemo(() => groupMessagesByDate(messages), [messages])

  // Actions
  const handleAction = useCallback(
    async (action: 'resolve' | 'close' | 'transfer') => {
      setIsActioning(true)
      try {
        const statusMap: Record<string, string> = {
          resolve: 'resolved',
          close: 'closed',
          transfer: 'pending',
        }
        const newStatus = statusMap[action]

        const res = await fetch(`/api/conversations/${conversationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: newStatus,
            ...(action === 'transfer' ? { assigned_agent_id: null } : {}),
          }),
        })

        if (res.ok) {
          updateConversation(conversationId, {
            status: newStatus as Conversation['status'],
            ...(action === 'transfer' ? { assigned_agent_id: null } : {}),
          })
        }
      } catch (err) {
        console.error(`Error performing ${action}:`, err)
      } finally {
        setIsActioning(false)
      }
    },
    [conversationId, updateConversation]
  )

  const handleToggleBot = useCallback(async () => {
    if (!conversation) return
    try {
      const res = await fetch(`/api/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_bot_active: !conversation.is_bot_active }),
      })
      if (res.ok) {
        updateConversation(conversationId, {
          is_bot_active: !conversation.is_bot_active,
        })
      }
    } catch (err) {
      console.error('Error toggling bot:', err)
    }
  }, [conversation, conversationId, updateConversation])

  // Status badge
  const statusInfo = STATUS_BADGE_VARIANTS[conversation?.status ?? 'open']

  return (
    <div className="flex flex-col h-full">
      {/* ----------------------------------------------------------------- */}
      {/* TOP BAR */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 h-14 border-b bg-background">
        {/* Left: contact info */}
        <div className="flex items-center gap-3 min-w-0">
          <Avatar>
            {contact?.avatar_url ? (
              <AvatarImage src={contact.avatar_url} alt={contact.name || ''} />
            ) : null}
            <AvatarFallback className="text-xs font-semibold">
              {contact?.name
                ? contact.name
                    .split(/\s+/)
                    .map((w) => w[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()
                : contact?.phone?.slice(-2) ?? '?'}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0">
            <h3 className="text-sm font-semibold truncate">
              {contact?.name || contact?.phone || 'Unknown contact'}
            </h3>
            {contact?.phone && contact?.name && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Phone className="size-3" />
                <span>{contact.phone}</span>
              </div>
            )}
          </div>

          {statusInfo && (
            <Badge
              variant="outline"
              className={cn('text-[10px] h-5 flex-shrink-0', statusInfo.className)}
            >
              {statusInfo.label}
            </Badge>
          )}
        </div>

        {/* Right: action buttons */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={conversation?.is_bot_active ? 'secondary' : 'ghost'}
                size="icon-sm"
                onClick={handleToggleBot}
                className={cn(
                  conversation?.is_bot_active &&
                    'bg-violet-500/15 text-violet-600 dark:text-violet-400'
                )}
              >
                <Bot className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {conversation?.is_bot_active ? 'Disable bot' : 'Enable bot'}
            </TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-5 mx-1" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleAction('transfer')}
                disabled={isActioning}
              >
                <ArrowRightLeft className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Transfer</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleAction('resolve')}
                disabled={isActioning}
                className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700"
              >
                <CheckCircle className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Resolve</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleAction('close')}
                disabled={isActioning}
                className="text-destructive hover:text-destructive"
              >
                <XCircle className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Close</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-5 mx-1" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={rightPanelOpen ? 'secondary' : 'ghost'}
                size="icon-sm"
                onClick={() => setRightPanelOpen(!rightPanelOpen)}
              >
                <PanelRight className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {rightPanelOpen ? 'Hide details' : 'Show details'}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* MESSAGE AREA */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex-1 relative overflow-hidden">
        <ScrollArea className="h-full" onScrollCapture={handleScroll}>
          <div className="py-4 space-y-1">
            {isLoadingMessages ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
                <p className="text-xs text-muted-foreground mt-2">
                  Loading messages...
                </p>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <Phone className="size-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  No messages yet
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Send a message to start the conversation
                </p>
              </div>
            ) : (
              groupedMessages.map(([dateKey, msgs]) => (
                <div key={dateKey}>
                  {/* Date separator */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[11px] font-medium text-muted-foreground px-2 bg-background rounded-full">
                      {formatDateSeparator(msgs[0].created_at)}
                    </span>
                    <div className="flex-1 h-px bg-border" />
                  </div>

                  {/* Messages */}
                  {msgs.map((msg) => (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      showSenderName
                    />
                  ))}
                </div>
              ))
            )}

            {/* Scroll anchor */}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {/* Scroll to bottom FAB */}
        {showScrollDown && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-4 right-4 size-8 rounded-full bg-background border shadow-md flex items-center justify-center hover:bg-accent transition-colors"
          >
            <ArrowDown className="size-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* COMPOSER */}
      {/* ----------------------------------------------------------------- */}
      <MessageComposer
        conversationId={conversationId}
        onMessageSent={scrollToBottom}
        disabled={conversation?.status === 'closed'}
      />
    </div>
  )
}
