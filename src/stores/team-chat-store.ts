'use client'

import { create } from 'zustand'
import type { TeamChannel, TeamMessage } from '@/types/database'

interface TeamChatState {
  channels: TeamChannel[]
  selectedChannelId: string | null
  messages: TeamMessage[]
  unreadCounts: Record<string, number>

  setChannels: (channels: TeamChannel[]) => void
  selectChannel: (id: string | null) => void
  setMessages: (messages: TeamMessage[]) => void
  addMessage: (message: TeamMessage) => void
  setUnreadCount: (channelId: string, count: number) => void
}

export const useTeamChatStore = create<TeamChatState>((set, get) => ({
  channels: [],
  selectedChannelId: null,
  messages: [],
  unreadCounts: {},

  setChannels: (channels) => set({ channels }),

  selectChannel: (id) =>
    set({
      selectedChannelId: id,
      messages: [],
    }),

  setMessages: (messages) => set({ messages }),

  addMessage: (message) =>
    set((state) => {
      // Only add if it belongs to the currently selected channel
      if (message.channel_id !== state.selectedChannelId) {
        // Increment unread count for this channel instead
        const currentCount = state.unreadCounts[message.channel_id] ?? 0
        return {
          unreadCounts: {
            ...state.unreadCounts,
            [message.channel_id]: currentCount + 1,
          },
        }
      }
      // Avoid duplicates
      const exists = state.messages.some((m) => m.id === message.id)
      if (exists) return state
      return { messages: [...state.messages, message] }
    }),

  setUnreadCount: (channelId, count) =>
    set((state) => ({
      unreadCounts: { ...state.unreadCounts, [channelId]: count },
    })),
}))
