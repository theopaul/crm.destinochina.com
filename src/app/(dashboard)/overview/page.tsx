'use client'

import Link from 'next/link'
import {
  MessageSquare,
  Clock,
  Users,
  BarChart3,
  ArrowRight,
  Inbox,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useCurrentUser } from '@/hooks/use-current-user'

// ---------------------------------------------------------------------------
// Placeholder stats (will connect to API later)
// ---------------------------------------------------------------------------

const stats = [
  {
    title: 'Open Conversations',
    value: '24',
    description: 'Active chats right now',
    icon: MessageSquare,
    color: 'text-blue-500',
  },
  {
    title: 'Pending (Unassigned)',
    value: '8',
    description: 'Waiting for an agent',
    icon: Inbox,
    color: 'text-amber-500',
  },
  {
    title: 'Avg Response Time',
    value: '3m 12s',
    description: 'Last 24 hours',
    icon: Clock,
    color: 'text-emerald-500',
  },
  {
    title: 'Messages Today',
    value: '312',
    description: 'Sent and received',
    icon: Users,
    color: 'text-violet-500',
  },
]

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function OverviewPage() {
  const { user } = useCurrentUser()

  const greeting = getGreeting()

  return (
    <div className="p-6 space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {greeting}, {user?.display_name?.split(' ')[0] ?? 'there'}
        </h1>
        <p className="text-muted-foreground mt-1">
          Here is an overview of your CRM activity.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <CardDescription className="text-xs">
                {stat.description}
              </CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/desk">
              <MessageSquare className="mr-2 h-4 w-4" />
              Go to Inbox
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/analytics">
              <BarChart3 className="mr-2 h-4 w-4" />
              View Analytics
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}
