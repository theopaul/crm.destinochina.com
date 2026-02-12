'use client'

import { create } from 'zustand'
import type { CrmUser, Organization } from '@/types/database'

interface AuthState {
  user: CrmUser | null
  organization: Organization | null
  isLoading: boolean
  setUser: (user: CrmUser | null) => void
  setOrganization: (org: Organization | null) => void
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  organization: null,
  isLoading: true,

  setUser: (user) => set({ user }),
  setOrganization: (org) => set({ organization: org }),
  setLoading: (loading) => set({ isLoading: loading }),
}))
