'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useChatStore } from '@/stores/chat-store'
import type { Conversation } from '@/types/database'

export function useRealtimeConversations(orgId: string | null) {
  const addConversation = useChatStore((s) => s.addConversation)
  const updateConversation = useChatStore((s) => s.updateConversation)

  useEffect(() => {
    if (!orgId) return

    const supabase = createClient()

    const channel = supabase
      .channel(`conversations:${orgId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'crm_conversations',
          filter: `org_id=eq.${orgId}`,
        },
        (payload) => {
          addConversation(payload.new as Conversation)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'crm_conversations',
          filter: `org_id=eq.${orgId}`,
        },
        (payload) => {
          const conv = payload.new as Conversation
          updateConversation(conv.id, conv)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [orgId, addConversation, updateConversation])
}
