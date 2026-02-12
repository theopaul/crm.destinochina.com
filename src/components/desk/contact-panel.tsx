'use client'

import { useCallback, useMemo, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useChatStore } from '@/stores/chat-store'
import { cn } from '@/lib/utils'
import {
  ChevronDown,
  ChevronRight,
  Mail,
  Phone,
  Tag,
  User,
  Calendar,
  Hash,
  Users,
  FolderKanban,
  Pencil,
  Plus,
  ExternalLink,
  StickyNote,
  Send,
  X,
} from 'lucide-react'
// ---------------------------------------------------------------------------
// Collapsible section
// ---------------------------------------------------------------------------

function Section({
  title,
  icon: Icon,
  defaultOpen = true,
  children,
}: {
  title: string
  icon: React.ElementType
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-accent/50 transition-colors"
      >
        <Icon className="size-3.5" />
        <span className="flex-1 text-left">{title}</span>
        {open ? (
          <ChevronDown className="size-3.5" />
        ) : (
          <ChevronRight className="size-3.5" />
        )}
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Info row helper
// ---------------------------------------------------------------------------

function InfoRow({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: React.ElementType
  label: string
  value: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-start gap-2 py-1.5', className)}>
      <Icon className="size-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
          {label}
        </p>
        <p className="text-sm text-foreground break-words">{value || '--'}</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Format phone nicely
// ---------------------------------------------------------------------------

function formatPhone(phone: string): string {
  // E.164 to display: +55 11 99999-9999 style
  if (phone.startsWith('+55') && phone.length === 13) {
    return `+55 ${phone.slice(3, 5)} ${phone.slice(5, 10)}-${phone.slice(10)}`
  }
  if (phone.startsWith('+86') && phone.length === 14) {
    return `+86 ${phone.slice(3, 6)} ${phone.slice(6, 10)} ${phone.slice(10)}`
  }
  if (phone.startsWith('+1') && phone.length === 12) {
    return `+1 (${phone.slice(2, 5)}) ${phone.slice(5, 8)}-${phone.slice(8)}`
  }
  // Generic: just add spaces every 3-4 chars
  if (phone.startsWith('+') && phone.length > 8) {
    return phone.slice(0, 3) + ' ' + phone.slice(3, 5) + ' ' + phone.slice(5)
  }
  return phone
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ContactPanelProps {
  conversationId: string
}

export function ContactPanel({ conversationId }: ContactPanelProps) {
  const conversations = useChatStore((s) => s.conversations)
  const messages = useChatStore((s) => s.messages)

  const conversation = conversations.find((c) => c.id === conversationId)
  const contact = conversation?.contact

  const [noteInput, setNoteInput] = useState('')
  const [isSendingNote, setIsSendingNote] = useState(false)

  // Internal notes from messages
  const internalNotes = useMemo(
    () => messages.filter((m) => m.message_type === 'internal_note'),
    [messages]
  )

  // Custom fields entries
  const customFields = useMemo(() => {
    if (!contact?.custom_fields) return []
    return Object.entries(contact.custom_fields).filter(
      ([, v]) => v !== null && v !== undefined && v !== ''
    )
  }, [contact?.custom_fields])

  const handleSendNote = useCallback(async () => {
    const trimmed = noteInput.trim()
    if (!trimmed || isSendingNote) return

    setIsSendingNote(true)
    try {
      await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          type: 'internal_note',
          content: trimmed,
        }),
      })
      setNoteInput('')
    } catch (err) {
      console.error('Error sending note:', err)
    } finally {
      setIsSendingNote(false)
    }
  }, [noteInput, conversationId, isSendingNote])

  if (!conversation || !contact) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">No contact selected</p>
      </div>
    )
  }

  const displayName = contact.name || contact.phone || 'Unknown'
  const initials = contact.name
    ? contact.name
        .split(/\s+/)
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : contact.phone?.slice(-2) ?? '?'

  return (
    <ScrollArea className="h-full">
      <div className="pb-6">
        {/* ----------------------------------------------------------------- */}
        {/* HEADER */}
        {/* ----------------------------------------------------------------- */}
        <div className="flex flex-col items-center pt-6 pb-4 px-4">
          <Avatar size="lg" className="size-16 mb-3">
            {contact.profile_picture_url ? (
              <AvatarImage src={contact.profile_picture_url} alt={displayName} />
            ) : null}
            <AvatarFallback className="text-lg font-semibold bg-emerald-600 text-white">
              {initials}
            </AvatarFallback>
          </Avatar>

          <h3 className="text-base font-semibold text-foreground text-center">
            {displayName}
          </h3>

          {contact.phone && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {formatPhone(contact.phone)}
            </p>
          )}

          {/* WhatsApp status */}
          <div className="flex items-center gap-1.5 mt-2">
            <span className="size-2 rounded-full bg-emerald-500" />
            <span className="text-xs text-muted-foreground">WhatsApp</span>
          </div>
        </div>

        <Separator />

        {/* ----------------------------------------------------------------- */}
        {/* CONTACT INFO */}
        {/* ----------------------------------------------------------------- */}
        <Section title="Contact Info" icon={User} defaultOpen>
          <div className="space-y-0.5">
            <InfoRow icon={Phone} label="Phone" value={formatPhone(contact.phone)} />
            <InfoRow
              icon={Mail}
              label="Email"
              value={contact.email || '--'}
            />
            {contact.tags && contact.tags.length > 0 && (
              <div className="flex items-start gap-2 py-1.5">
                <Tag className="size-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
                    Tags
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {contact.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-[10px] h-5">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          <Button variant="ghost" size="xs" className="mt-2 text-xs text-muted-foreground">
            <Pencil className="size-3 mr-1" />
            Edit contact
          </Button>
        </Section>

        <Separator />

        {/* ----------------------------------------------------------------- */}
        {/* CUSTOM FIELDS */}
        {/* ----------------------------------------------------------------- */}
        <Section title="Custom Fields" icon={FolderKanban} defaultOpen={customFields.length > 0}>
          {customFields.length > 0 ? (
            <div className="space-y-0.5">
              {customFields.map(([key, value]) => (
                <div key={key} className="flex items-start gap-2 py-1.5">
                  <Hash className="size-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
                      {key.replace(/_/g, ' ')}
                    </p>
                    <p className="text-sm text-foreground break-words">
                      {String(value)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground/60 italic">
              No custom fields
            </p>
          )}
          <Button variant="ghost" size="xs" className="mt-2 text-xs text-muted-foreground">
            <Plus className="size-3 mr-1" />
            Add field
          </Button>
        </Section>

        <Separator />

        {/* ----------------------------------------------------------------- */}
        {/* CONVERSATION DETAILS */}
        {/* ----------------------------------------------------------------- */}
        <Section title="Conversation Details" icon={FolderKanban} defaultOpen>
          <div className="space-y-0.5">
            <InfoRow
              icon={Hash}
              label="Protocol"
              value={conversation.protocol_number || '--'}
            />
            <InfoRow
              icon={User}
              label="Assigned Agent"
              value={conversation.assigned_agent?.display_name || 'Unassigned'}
            />
            <InfoRow
              icon={Users}
              label="Queue"
              value={conversation.queue || '--'}
            />
            <InfoRow
              icon={Tag}
              label="Classification"
              value={conversation.classification || '--'}
            />
            <InfoRow
              icon={Calendar}
              label="Created"
              value={new Date(conversation.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            />
          </div>
        </Section>

        <Separator />

        {/* ----------------------------------------------------------------- */}
        {/* INTERNAL NOTES */}
        {/* ----------------------------------------------------------------- */}
        <Section title="Internal Notes" icon={StickyNote} defaultOpen>
          <div className="space-y-2">
            {internalNotes.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {internalNotes.map((note) => (
                  <div
                    key={note.id}
                    className="rounded-md bg-amber-500/10 border border-amber-500/20 px-2.5 py-2"
                  >
                    <p className="text-xs text-foreground">{note.content}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-[10px] text-muted-foreground">
                        {note.sender?.display_name || 'Agent'}
                      </span>
                      <span className="text-[10px] text-muted-foreground/50">
                        {new Date(note.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground/60 italic">
                No internal notes
              </p>
            )}

            {/* Quick add note */}
            <div className="flex items-center gap-1.5">
              <Input
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendNote()
                }}
                placeholder="Add a note..."
                className="h-7 text-xs"
              />
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={handleSendNote}
                disabled={!noteInput.trim() || isSendingNote}
              >
                <Send className="size-3" />
              </Button>
            </div>
          </div>
        </Section>

        <Separator />

        {/* ----------------------------------------------------------------- */}
        {/* TAGS */}
        {/* ----------------------------------------------------------------- */}
        <Section title="Tags" icon={Tag} defaultOpen>
          {conversation.tags && conversation.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {conversation.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="text-[10px] h-5 gap-1 pr-1"
                >
                  {tag}
                  <button className="hover:text-destructive transition-colors">
                    <X className="size-2.5" />
                  </button>
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground/60 italic">No tags</p>
          )}
          <Button variant="ghost" size="xs" className="mt-2 text-xs text-muted-foreground">
            <Plus className="size-3 mr-1" />
            Add tag
          </Button>
        </Section>

        <Separator />

        {/* ----------------------------------------------------------------- */}
        {/* HUBSPOT */}
        {/* ----------------------------------------------------------------- */}
        <Section title="HubSpot" icon={ExternalLink} defaultOpen={false}>
          {contact.hubspot_contact_id ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Synced with HubSpot
              </p>
              <a
                href={`https://app.hubspot.com/contacts/${contact.hubspot_contact_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="size-3" />
                View in HubSpot
              </a>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground/60 italic">
                Not synced with HubSpot
              </p>
              <Button variant="outline" size="xs" className="text-xs">
                <ExternalLink className="size-3 mr-1" />
                Sync contact
              </Button>
            </div>
          )}
        </Section>
      </div>
    </ScrollArea>
  )
}
