'use client'

import { create } from 'zustand'
import type { Conversation, Message, MessageStatus } from '@/types/database'

interface ConversationFilter {
  status: string | null
  queue: string | null
  assignedTo: string | null
  search: string
}

interface ChatState {
  // Conversations
  conversations: Conversation[]
  selectedConversationId: string | null
  conversationFilter: ConversationFilter

  // Messages for selected conversation
  messages: Message[]
  isLoadingMessages: boolean

  // UI State
  rightPanelOpen: boolean

  // Actions
  setConversations: (conversations: Conversation[]) => void
  addConversation: (conversation: Conversation) => void
  updateConversation: (id: string, updates: Partial<Conversation>) => void
  selectConversation: (id: string | null) => void
  setFilter: (filter: Partial<ConversationFilter>) => void

  setMessages: (messages: Message[]) => void
  addMessage: (message: Message) => void
  updateMessageStatus: (messageId: string, status: MessageStatus) => void

  setRightPanelOpen: (open: boolean) => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  // ---------------------------------------------------------------------------
  // Conversations state
  // ---------------------------------------------------------------------------
  conversations: [],
  selectedConversationId: null,
  conversationFilter: {
    status: null,
    queue: null,
    assignedTo: null,
    search: '',
  },

  // ---------------------------------------------------------------------------
  // Messages state
  // ---------------------------------------------------------------------------
  messages: [],
  isLoadingMessages: false,

  // ---------------------------------------------------------------------------
  // UI state
  // ---------------------------------------------------------------------------
  rightPanelOpen: false,

  // ---------------------------------------------------------------------------
  // Conversation actions
  // ---------------------------------------------------------------------------
  setConversations: (conversations) => set({ conversations }),

  addConversation: (conversation) =>
    set((state) => {
      // Avoid duplicates
      const exists = state.conversations.some((c) => c.id === conversation.id)
      if (exists) return state
      return { conversations: [conversation, ...state.conversations] }
    }),

  updateConversation: (id, updates) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    })),

  selectConversation: (id) =>
    set({
      selectedConversationId: id,
      messages: [],
      isLoadingMessages: id !== null,
    }),

  setFilter: (filter) =>
    set((state) => ({
      conversationFilter: { ...state.conversationFilter, ...filter },
    })),

  // ---------------------------------------------------------------------------
  // Message actions
  // ---------------------------------------------------------------------------
  setMessages: (messages) =>
    set({ messages, isLoadingMessages: false }),

  addMessage: (message) =>
    set((state) => {
      // Only add if it belongs to the currently selected conversation
      if (message.conversation_id !== state.selectedConversationId) return state
      // Avoid duplicates
      const exists = state.messages.some((m) => m.id === message.id)
      if (exists) return state
      return { messages: [...state.messages, message] }
    }),

  updateMessageStatus: (messageId, status) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, status } : m
      ),
    })),

  // ---------------------------------------------------------------------------
  // UI actions
  // ---------------------------------------------------------------------------
  setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
}))
