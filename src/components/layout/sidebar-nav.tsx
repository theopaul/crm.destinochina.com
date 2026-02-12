'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  GitBranch,
  Send,
  BarChart3,
  Hash,
  Settings,
  LogOut,
  ChevronUp,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import type { CrmUser } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

// ---------------------------------------------------------------------------
// Navigation items
// ---------------------------------------------------------------------------

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number | null
}

const mainNavItems: NavItem[] = [
  { title: 'Overview', href: '/overview', icon: LayoutDashboard },
  { title: 'Inbox', href: '/desk', icon: MessageSquare, badge: null },
  { title: 'Contacts', href: '/contacts', icon: Users },
  { title: 'Flows', href: '/flows', icon: GitBranch },
  { title: 'Bulk Sending', href: '/bulk-sending', icon: Send },
  { title: 'Analytics', href: '/analytics', icon: BarChart3 },
  { title: 'Team Chat', href: '/team', icon: Hash },
  { title: 'Settings', href: '/settings', icon: Settings },
]

// ---------------------------------------------------------------------------
// Status colors
// ---------------------------------------------------------------------------

const statusColors: Record<string, string> = {
  online: 'bg-emerald-500',
  away: 'bg-amber-500',
  busy: 'bg-red-500',
  offline: 'bg-zinc-500',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SidebarNavProps {
  user: CrmUser | null
  onStatusChange?: (status: 'online' | 'away' | 'offline') => void
}

export function SidebarNav({ user, onStatusChange }: SidebarNavProps) {
  const pathname = usePathname()
  const router = useRouter()

  const initials = user?.display_name
    ? user.display_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '??'

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <Sidebar variant="sidebar" collapsible="icon">
      {/* ------ Header / Brand ------ */}
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-red-600 text-white font-bold text-sm">
            DC
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold tracking-tight">
              Destino China
            </span>
            <span className="text-xs text-muted-foreground">CRM</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      {/* ------ Main Navigation ------ */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                    >
                      <Link href={item.href}>
                        <item.icon className="shrink-0" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                    {item.badge != null && item.badge > 0 && (
                      <SidebarMenuBadge className="bg-red-600 text-white text-[10px]">
                        {item.badge > 99 ? '99+' : item.badge}
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />

      {/* ------ Footer / User Profile ------ */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="w-full">
                  <Avatar size="sm">
                    {user?.avatar_url && (
                      <AvatarImage src={user.avatar_url} alt={user.display_name} />
                    )}
                    <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-1 flex-col text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate font-medium">
                      {user?.display_name ?? 'Loading...'}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          statusColors[user?.status ?? 'offline']
                        }`}
                      />
                      {user?.status ?? 'offline'}
                    </span>
                  </div>
                  {user?.role && (
                    <Badge
                      variant="secondary"
                      className="ml-auto text-[10px] group-data-[collapsible=icon]:hidden"
                    >
                      {user.role}
                    </Badge>
                  )}
                  <ChevronUp className="ml-auto h-4 w-4 shrink-0 group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="start"
                className="w-56"
              >
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {user?.display_name}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Status
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => onStatusChange?.('online')}>
                  <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-500" />
                  Online
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onStatusChange?.('away')}>
                  <span className="mr-2 inline-block h-2 w-2 rounded-full bg-amber-500" />
                  Away
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onStatusChange?.('offline')}>
                  <span className="mr-2 inline-block h-2 w-2 rounded-full bg-zinc-500" />
                  Offline
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
