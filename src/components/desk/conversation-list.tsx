'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { useChatStore } from '@/stores/chat-store'
import { useAuthStore } from '@/stores/auth-store'
import { ConversationItem } from './conversation-item'
import { Search, MessageSquare, Bot, User, Inbox } from 'lucide-react'
import type { Conversation } from '@/types/database'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConversationList() {
  const conversations = useChatStore((s) => s.conversations)
  const setConversations = useChatStore((s) => s.setConversations)
  const filter = useChatStore((s) => s.conversationFilter)
  const setFilter = useChatStore((s) => s.setFilter)
  const currentUser = useAuthStore((s) => s.user)

  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')

  // Fetch conversations on mount
  useEffect(() => {
    let cancelled = false

    async function fetchConversations() {
      setIsLoading(true)
      try {
        const res = await fetch('/api/conversations')
        if (!res.ok) throw new Error('Failed to fetch conversations')
        const data = await res.json()
        if (!cancelled) {
          setConversations(data.data ?? data)
        }
      } catch (err) {
        console.error('Error fetching conversations:', err)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    fetchConversations()
    return () => {
      cancelled = true
    }
  }, [setConversations])

  // Filter + sort conversations
  const filteredConversations = useMemo(() => {
    let result: Conversation[] = [...conversations]

    // Tab filter
    if (activeTab === 'mine' && currentUser) {
      result = result.filter((c) => c.assigned_agent_id === currentUser.id)
    } else if (activeTab === 'unassigned') {
      result = result.filter((c) => !c.assigned_agent_id)
    } else if (activeTab === 'bot') {
      result = result.filter((c) => c.is_bot_active)
    }

    // Search filter
    if (filter.search.trim()) {
      const q = filter.search.toLowerCase().trim()
      result = result.filter((c) => {
        const name = c.contact?.name?.toLowerCase() ?? ''
        const phone = c.contact?.phone?.toLowerCase() ?? ''
        const preview = c.last_message_preview?.toLowerCase() ?? ''
        return name.includes(q) || phone.includes(q) || preview.includes(q)
      })
    }

    // Status filter from store
    if (filter.status) {
      result = result.filter((c) => c.status === filter.status)
    }

    // Sort by last_message_at descending
    result.sort((a, b) => {
      const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
      const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
      return bTime - aTime
    })

    return result
  }, [conversations, activeTab, currentUser, filter.search, filter.status])

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFilter({ search: e.target.value })
    },
    [setFilter]
  )

  // Count helpers
  const counts = useMemo(() => {
    const mine = currentUser
      ? conversations.filter((c) => c.assigned_agent_id === currentUser.id).length
      : 0
    const unassigned = conversations.filter((c) => !c.assigned_agent_id).length
    const bot = conversations.filter((c) => c.is_bot_active).length
    return { all: conversations.length, mine, unassigned, bot }
  }, [conversations, currentUser])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-3 pt-3 pb-2 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Conversations</h2>
          <span className="text-xs text-muted-foreground">
            {filteredConversations.length}
          </span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={filter.search}
            onChange={handleSearchChange}
            placeholder="Search conversations..."
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 px-3 pb-1">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full h-8" variant="line">
            <TabsTrigger value="all" className="text-xs gap-1 flex-1">
              <Inbox className="size-3" />
              All
              {counts.all > 0 && (
                <span className="text-[10px] text-muted-foreground ml-0.5">
                  {counts.all}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="mine" className="text-xs gap-1 flex-1">
              <User className="size-3" />
              Mine
              {counts.mine > 0 && (
                <span className="text-[10px] text-muted-foreground ml-0.5">
                  {counts.mine}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="unassigned" className="text-xs gap-1 flex-1">
              <MessageSquare className="size-3" />
              Open
              {counts.unassigned > 0 && (
                <span className="text-[10px] text-muted-foreground ml-0.5">
                  {counts.unassigned}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="bot" className="text-xs gap-1 flex-1">
              <Bot className="size-3" />
              Bot
              {counts.bot > 0 && (
                <span className="text-[10px] text-muted-foreground ml-0.5">
                  {counts.bot}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Conversation list */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="space-y-1 p-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 px-3 py-3">
                <Skeleton className="size-8 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3 w-8" />
                  </div>
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <MessageSquare className="size-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No conversations found</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {filter.search
                ? 'Try a different search term'
                : 'Conversations will appear here when contacts message you'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {filteredConversations.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
