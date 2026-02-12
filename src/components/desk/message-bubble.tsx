'use client'

import { cn } from '@/lib/utils'
import {
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  FileText,
  Download,
  Play,
  MapPin,
} from 'lucide-react'
import type { Message, MessageStatus, SenderType } from '@/types/database'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function StatusIcon({ status }: { status: MessageStatus }) {
  switch (status) {
    case 'pending':
      return <Clock className="size-3 text-muted-foreground" />
    case 'sent':
      return <Check className="size-3 text-muted-foreground" />
    case 'delivered':
      return <CheckCheck className="size-3 text-muted-foreground" />
    case 'read':
      return <CheckCheck className="size-3 text-blue-500" />
    case 'failed':
      return <AlertCircle className="size-3 text-destructive" />
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Media renderers
// ---------------------------------------------------------------------------

function ImageContent({ url, caption }: { url: string; caption?: string | null }) {
  return (
    <div className="space-y-1">
      <img
        src={url}
        alt={caption || 'Image'}
        className="max-w-[280px] rounded-md object-cover cursor-pointer hover:opacity-90 transition-opacity"
        loading="lazy"
      />
      {caption && <p className="text-sm">{caption}</p>}
    </div>
  )
}

function AudioContent({ url }: { url: string }) {
  return (
    <audio controls className="max-w-[260px] h-10" preload="none">
      <source src={url} />
    </audio>
  )
}

function VideoContent({ url, caption }: { url: string; caption?: string | null }) {
  return (
    <div className="space-y-1">
      <div className="relative max-w-[280px] rounded-md overflow-hidden bg-black/10">
        <video
          src={url}
          className="w-full rounded-md"
          preload="metadata"
          controls
        />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Play className="size-10 text-white/80 fill-white/80" />
        </div>
      </div>
      {caption && <p className="text-sm">{caption}</p>}
    </div>
  )
}

function DocumentContent({
  url,
  filename,
  caption,
}: {
  url: string
  filename?: string | null
  caption?: string | null
}) {
  return (
    <div className="space-y-1">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded-md bg-background/50 px-3 py-2 hover:bg-background/80 transition-colors"
      >
        <FileText className="size-5 flex-shrink-0 text-muted-foreground" />
        <span className="truncate text-sm font-medium">{filename || 'Document'}</span>
        <Download className="size-4 flex-shrink-0 ml-auto text-muted-foreground" />
      </a>
      {caption && <p className="text-sm">{caption}</p>}
    </div>
  )
}

function LocationContent({ content }: { content: string | null }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <MapPin className="size-4 flex-shrink-0" />
      <span>{content || 'Shared location'}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface MessageBubbleProps {
  message: Message
  showSenderName?: boolean
}

export function MessageBubble({ message, showSenderName = false }: MessageBubbleProps) {
  const senderType: SenderType = message.sender_type
  const isContact = senderType === 'contact'
  const isAgent = senderType === 'agent'
  const isSystem = senderType === 'system'
  const isBot = senderType === 'bot'
  const isNote = message.message_type === 'internal_note'

  // -- System messages: centered
  if (isSystem) {
    return (
      <div className="flex justify-center py-1">
        <div className="max-w-[80%] rounded-lg bg-muted/60 px-3 py-1.5">
          <p className="text-xs text-muted-foreground italic text-center">
            {message.content}
          </p>
          <p className="text-[10px] text-muted-foreground/60 text-center mt-0.5">
            {formatTime(message.created_at)}
          </p>
        </div>
      </div>
    )
  }

  // -- Internal notes: full width yellow-ish
  if (isNote) {
    return (
      <div className="px-4 py-1">
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Internal Note
            </span>
            {message.sender && (
              <span className="text-[10px] text-muted-foreground">
                by {message.sender.display_name}
              </span>
            )}
          </div>
          <p className="text-sm text-foreground">{message.content}</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            {formatTime(message.created_at)}
          </p>
        </div>
      </div>
    )
  }

  // -- Contact or Agent/Bot messages
  const isRight = isAgent || isBot

  return (
    <div
      className={cn('flex px-4 py-0.5', isRight ? 'justify-end' : 'justify-start')}
    >
      <div
        className={cn(
          'max-w-[70%] rounded-2xl px-3 py-2 shadow-sm',
          isRight
            ? 'bg-emerald-600 text-white rounded-br-md'
            : 'bg-muted text-foreground rounded-bl-md'
        )}
      >
        {/* Reply reference */}
        {message.reply_to_message && (
          <div
            className={cn(
              'mb-1.5 rounded-md px-2 py-1 border-l-2 text-xs',
              isRight
                ? 'bg-emerald-700/50 border-emerald-300/50 text-emerald-100'
                : 'bg-background/50 border-muted-foreground/30 text-muted-foreground'
            )}
          >
            <p className="truncate">
              {message.reply_to_message.content || '[Media]'}
            </p>
          </div>
        )}

        {/* Sender name for bot messages */}
        {showSenderName && isBot && (
          <p className="text-[10px] font-semibold mb-0.5 opacity-80">Bot</p>
        )}
        {showSenderName && isAgent && message.sender && (
          <p
            className={cn(
              'text-[10px] font-semibold mb-0.5',
              isRight ? 'text-emerald-100' : 'text-muted-foreground'
            )}
          >
            {message.sender.display_name}
          </p>
        )}

        {/* Message content */}
        {message.message_type === 'image' && message.media_url && (
          <ImageContent url={message.media_url} caption={message.content} />
        )}
        {message.message_type === 'audio' && message.media_url && (
          <AudioContent url={message.media_url} />
        )}
        {message.message_type === 'video' && message.media_url && (
          <VideoContent url={message.media_url} caption={message.content} />
        )}
        {message.message_type === 'document' && message.media_url && (
          <DocumentContent
            url={message.media_url}
            filename={message.media_filename}
            caption={message.content}
          />
        )}
        {message.message_type === 'location' && (
          <LocationContent content={message.content} />
        )}
        {(message.message_type === 'text' ||
          message.message_type === 'template' ||
          message.message_type === 'sticker' ||
          message.message_type === 'reaction') && (
          <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
            {message.content}
          </p>
        )}

        {/* Timestamp + status */}
        <div
          className={cn(
            'flex items-center gap-1 mt-1',
            isRight ? 'justify-end' : 'justify-start'
          )}
        >
          <span
            className={cn(
              'text-[10px]',
              isRight ? 'text-emerald-100/70' : 'text-muted-foreground'
            )}
          >
            {formatTime(message.created_at)}
          </span>
          {isRight && <StatusIcon status={message.status} />}
        </div>

        {/* Error message */}
        {message.status === 'failed' && message.error_message && (
          <p className="text-[10px] text-destructive mt-1">
            {message.error_message}
          </p>
        )}
      </div>
    </div>
  )
}
