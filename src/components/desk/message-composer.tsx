'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  SendHorizontal,
  Paperclip,
  Zap,
  StickyNote,
  FileText,
  X,
  Smile,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MessageComposerProps {
  conversationId: string
  onMessageSent?: () => void
  disabled?: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MessageComposer({
  conversationId,
  onMessageSent,
  disabled = false,
}: MessageComposerProps) {
  const [content, setContent] = useState('')
  const [isNoteMode, setIsNoteMode] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [showQuickReplies, setShowQuickReplies] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Reset note mode when conversation changes
  useEffect(() => {
    setIsNoteMode(false)
    setContent('')
    setShowQuickReplies(false)
  }, [conversationId])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const scrollH = el.scrollHeight
    const maxH = 5 * 24 // ~5 lines
    el.style.height = `${Math.min(scrollH, maxH)}px`
  }, [content])

  // Quick reply trigger
  useEffect(() => {
    if (content.startsWith('/')) {
      setShowQuickReplies(true)
    } else {
      setShowQuickReplies(false)
    }
  }, [content])

  const handleSend = useCallback(async () => {
    const trimmed = content.trim()
    if (!trimmed || isSending) return

    setIsSending(true)
    try {
      const response = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          type: isNoteMode ? 'internal_note' : 'text',
          content: trimmed,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      setContent('')
      setIsNoteMode(false)
      onMessageSent?.()
      textareaRef.current?.focus()
    } catch (error) {
      console.error('Send message error:', error)
    } finally {
      setIsSending(false)
    }
  }, [content, conversationId, isNoteMode, isSending, onMessageSent])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  const handleAttachment = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      const formData = new FormData()
      formData.append('file', file)
      formData.append('conversation_id', conversationId)

      try {
        await fetch('/api/messages/send', {
          method: 'POST',
          body: formData,
        })
        onMessageSent?.()
      } catch (error) {
        console.error('Attachment upload error:', error)
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
    [conversationId, onMessageSent]
  )

  return (
    <div
      className={cn(
        'border-t',
        isNoteMode && 'bg-amber-500/5 border-t-amber-500/30'
      )}
    >
      {/* Note mode indicator */}
      {isNoteMode && (
        <div className="flex items-center gap-2 px-4 pt-2">
          <StickyNote className="size-3.5 text-amber-500" />
          <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
            Internal note -- only visible to your team
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setIsNoteMode(false)}
            className="ml-auto"
          >
            <X className="size-3" />
          </Button>
        </div>
      )}

      {/* Quick replies dropdown placeholder */}
      {showQuickReplies && (
        <div className="mx-4 mt-2 rounded-md border bg-popover p-2 shadow-md">
          <p className="text-xs text-muted-foreground px-2 py-1">
            Type a shortcut to search quick replies...
          </p>
          <div className="text-xs text-muted-foreground/60 px-2 py-1 italic">
            No quick replies configured yet
          </div>
        </div>
      )}

      {/* Composer row */}
      <div className="flex items-end gap-1.5 p-3">
        {/* Action buttons */}
        <div className="flex items-center gap-0.5 pb-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleAttachment}
                disabled={disabled}
              >
                <Paperclip className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Attach file</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowQuickReplies(!showQuickReplies)}
                disabled={disabled}
              >
                <Zap className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Quick replies</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={disabled}
              >
                <FileText className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Templates</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isNoteMode ? 'secondary' : 'ghost'}
                size="icon-sm"
                onClick={() => setIsNoteMode(!isNoteMode)}
                disabled={disabled}
                className={cn(isNoteMode && 'bg-amber-500/20 text-amber-600 dark:text-amber-400')}
              >
                <StickyNote className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isNoteMode ? 'Switch to message' : 'Internal note'}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={disabled}
              >
                <Smile className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Emoji</TooltipContent>
          </Tooltip>
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isNoteMode
              ? 'Write an internal note...'
              : 'Type a message...'
          }
          disabled={disabled || isSending}
          rows={1}
          className={cn(
            'flex-1 resize-none rounded-lg border px-3 py-2 text-sm',
            'bg-background outline-none placeholder:text-muted-foreground',
            'focus-visible:ring-1 focus-visible:ring-ring',
            'min-h-[38px] max-h-[120px]',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            isNoteMode && 'border-amber-500/30 bg-amber-500/5'
          )}
        />

        {/* Send button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              onClick={handleSend}
              disabled={disabled || isSending || !content.trim()}
              className={cn(
                'flex-shrink-0 mb-0.5',
                isNoteMode
                  ? 'bg-amber-500 hover:bg-amber-600 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              )}
            >
              <SendHorizontal className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isNoteMode ? 'Send note' : 'Send message'}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
        onChange={handleFileSelected}
      />
    </div>
  )
}
