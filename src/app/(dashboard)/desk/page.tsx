'use client'

import { ConversationList } from '@/components/desk/conversation-list'
import { MessageThread } from '@/components/desk/message-thread'
import { ContactPanel } from '@/components/desk/contact-panel'
import { useChatStore } from '@/stores/chat-store'
import { useAuthStore } from '@/stores/auth-store'
import { useRealtimeMessages } from '@/hooks/use-realtime-messages'
import { useRealtimeConversations } from '@/hooks/use-realtime-conversations'
import { MessageSquare } from 'lucide-react'

// ---------------------------------------------------------------------------
// Empty state when no conversation is selected
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <div className="size-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
        <MessageSquare className="size-7 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">
        Select a conversation
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        Choose a conversation from the left panel to view messages and start
        replying to your contacts.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main desk page
// ---------------------------------------------------------------------------

export default function DeskPage() {
  const selectedConversationId = useChatStore((s) => s.selectedConversationId)
  const rightPanelOpen = useChatStore((s) => s.rightPanelOpen)
  const organization = useAuthStore((s) => s.organization)

  // Real-time subscriptions
  useRealtimeConversations(organization?.org_id ?? null)
  useRealtimeMessages(selectedConversationId)

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Left panel -- conversation list */}
      <div className="w-80 border-r flex-shrink-0 flex flex-col bg-background">
        <ConversationList />
      </div>

      {/* Center panel -- message thread */}
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        {selectedConversationId ? (
          <MessageThread conversationId={selectedConversationId} />
        ) : (
          <EmptyState />
        )}
      </div>

      {/* Right panel -- contact info */}
      {rightPanelOpen && selectedConversationId && (
        <div className="w-80 border-l flex-shrink-0 bg-background">
          <ContactPanel conversationId={selectedConversationId} />
        </div>
      )}
    </div>
  )
}
