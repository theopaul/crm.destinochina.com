'use client'

import { useChatStore } from '@/stores/chat-store'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Bot } from 'lucide-react'
import type { Conversation } from '@/types/database'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500',
  open: 'bg-emerald-500',
  waiting: 'bg-orange-500',
  resolved: 'bg-blue-500',
  closed: 'bg-muted-foreground',
}

const AVATAR_COLORS = [
  'bg-rose-600',
  'bg-sky-600',
  'bg-violet-600',
  'bg-amber-600',
  'bg-emerald-600',
  'bg-fuchsia-600',
  'bg-teal-600',
  'bg-indigo-600',
]

function pickColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return ''
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60000)
  const diffHrs = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return 'now'
  if (diffMin < 60) return `${diffMin}m`
  if (diffHrs < 24) return `${diffHrs}h`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d`
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function getInitials(name: string | null, phone: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }
  return phone.slice(-2)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ConversationItemProps {
  conversation: Conversation
}

export function ConversationItem({ conversation }: ConversationItemProps) {
  const selectedId = useChatStore((s) => s.selectedConversationId)
  const selectConversation = useChatStore((s) => s.selectConversation)

  const isSelected = selectedId === conversation.id
  const contact = conversation.contact
  const displayName = contact?.name || contact?.phone || 'Unknown'
  const phone = contact?.phone || ''
  const initials = getInitials(contact?.name ?? null, phone)
  const avatarBg = pickColor(displayName)
  const statusColor = STATUS_COLORS[conversation.status] ?? 'bg-muted-foreground'

  return (
    <button
      onClick={() => selectConversation(conversation.id)}
      className={cn(
        'flex w-full items-start gap-3 px-3 py-3 text-left transition-colors',
        'hover:bg-accent/50 focus-visible:outline-none focus-visible:bg-accent/50',
        isSelected && 'bg-accent'
      )}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <Avatar>
          {contact?.profile_picture_url ? (
            <AvatarImage src={contact.profile_picture_url} alt={displayName} />
          ) : null}
          <AvatarFallback className={cn(avatarBg, 'text-white text-xs font-semibold')}>
            {initials}
          </AvatarFallback>
        </Avatar>
        {/* Status dot */}
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-background',
            statusColor
          )}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {displayName}
          </span>
          <span className="flex-shrink-0 text-[11px] text-muted-foreground">
            {formatRelativeTime(conversation.last_message_at)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className="truncate text-xs text-muted-foreground leading-relaxed">
            {conversation.last_message_preview || 'No messages yet'}
          </p>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Bot indicator */}
            {conversation.is_bot_active && (
              <Bot className="size-3 text-muted-foreground" />
            )}

            {/* Unread count badge */}
            {conversation.unread_count > 0 && (
              <Badge className="h-[18px] min-w-[18px] px-1 text-[10px] font-semibold bg-emerald-600 text-white border-0">
                {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
              </Badge>
            )}

            {/* Assigned agent avatar (small) */}
            {conversation.assigned_agent && (
              <Avatar size="sm">
                {conversation.assigned_agent.avatar_url ? (
                  <AvatarImage
                    src={conversation.assigned_agent.avatar_url}
                    alt={conversation.assigned_agent.display_name}
                  />
                ) : null}
                <AvatarFallback className="text-[9px] font-medium">
                  {conversation.assigned_agent.display_name
                    .split(/\s+/)
                    .map((w) => w[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}
