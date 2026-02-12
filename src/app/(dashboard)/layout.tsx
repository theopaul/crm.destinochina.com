'use client'

import { useCallback } from 'react'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { SidebarNav } from '@/components/layout/sidebar-nav'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useAuthStore } from '@/stores/auth-store'
import { createClient } from '@/lib/supabase/client'
import { Skeleton } from '@/components/ui/skeleton'
import type { UserStatus } from '@/types/database'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isLoading } = useCurrentUser()
  const setUser = useAuthStore((s) => s.setUser)

  const handleStatusChange = useCallback(
    async (status: 'online' | 'away' | 'offline') => {
      if (!user) return

      const supabase = createClient()

      const { error } = await supabase
        .from('crm_users')
        .update({ status: status as UserStatus })
        .eq('id', user.id)

      if (!error) {
        setUser({ ...user, status: status as UserStatus })
      }
    },
    [user, setUser]
  )

  if (isLoading) {
    return <DashboardSkeleton />
  }

  return (
    <SidebarProvider>
      <SidebarNav user={user} onStatusChange={handleStatusChange} />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="flex-1" />
          {user && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">
                {user.display_name}
              </span>
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  user.status === 'online'
                    ? 'bg-emerald-500'
                    : user.status === 'away'
                      ? 'bg-amber-500'
                      : user.status === 'busy'
                        ? 'bg-red-500'
                        : 'bg-zinc-500'
                }`}
              />
            </div>
          )}
        </header>
        <div className="flex-1 overflow-auto">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function DashboardSkeleton() {
  return (
    <div className="flex h-screen w-full">
      {/* Sidebar skeleton */}
      <div className="hidden w-64 flex-col gap-4 border-r p-4 md:flex">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="mt-4 flex flex-col gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full rounded-md" />
          ))}
        </div>
        <div className="mt-auto">
          <Skeleton className="h-12 w-full rounded-md" />
        </div>
      </div>
      {/* Main content skeleton */}
      <div className="flex flex-1 flex-col">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <Skeleton className="h-7 w-7 rounded-md" />
          <div className="flex-1" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="mb-4 h-8 w-48" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
