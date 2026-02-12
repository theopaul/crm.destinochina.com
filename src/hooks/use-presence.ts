'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CrmUser, UserStatus } from '@/types/database'

interface PresenceState {
  userId: string
  displayName: string
  status: UserStatus
  avatarUrl: string | null
  lastSeen: string
}

export function usePresence(currentUser: CrmUser | null) {
  const [onlineAgents, setOnlineAgents] = useState<PresenceState[]>([])

  useEffect(() => {
    if (!currentUser) return

    const supabase = createClient()

    const channel = supabase.channel('agent-presence', {
      config: {
        presence: {
          key: currentUser.id,
        },
      },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState<PresenceState>()
        const agents: PresenceState[] = []

        for (const key in presenceState) {
          const presences = presenceState[key]
          if (presences && presences.length > 0) {
            agents.push(presences[0] as unknown as PresenceState)
          }
        }

        setOnlineAgents(agents)
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        setOnlineAgents((prev) => {
          const updated = [...prev]
          for (const presence of newPresences as unknown as PresenceState[]) {
            const existingIndex = updated.findIndex(
              (a) => a.userId === presence.userId
            )
            if (existingIndex >= 0) {
              updated[existingIndex] = presence
            } else {
              updated.push(presence)
            }
          }
          return updated
        })
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        setOnlineAgents((prev) =>
          prev.filter(
            (a) =>
              !(leftPresences as unknown as PresenceState[]).some(
                (lp) => lp.userId === a.userId
              )
          )
        )
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId: currentUser.id,
            displayName: currentUser.display_name,
            status: currentUser.status,
            avatarUrl: currentUser.avatar_url,
            lastSeen: new Date().toISOString(),
          })
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUser])

  return { onlineAgents }
}
