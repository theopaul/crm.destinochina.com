'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import type { CrmUser, Organization } from '@/types/database'

export function useCurrentUser() {
  const { user, organization, isLoading, setUser, setOrganization, setLoading } =
    useAuthStore()

  useEffect(() => {
    if (user) return

    const supabase = createClient()

    async function loadUser() {
      setLoading(true)

      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()

      if (!authUser) {
        setLoading(false)
        return
      }

      const { data: crmUser } = await supabase
        .from('crm_users')
        .select('*')
        .eq('id', authUser.id)
        .single<CrmUser>()

      if (crmUser) {
        setUser(crmUser)

        const { data: org } = await supabase
          .from('crm_organizations')
          .select('*')
          .eq('org_id', crmUser.org_id)
          .single<Organization>()

        if (org) {
          setOrganization(org)
        }
      }

      setLoading(false)
    }

    loadUser()
  }, [user, setUser, setOrganization, setLoading])

  return { user, organization, isLoading }
}
