'use client'

import { Hash } from 'lucide-react'

export default function TeamChatPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Hash className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Team Chat</h1>
        <p className="text-muted-foreground max-w-md">
          Internal team communication channels. Collaborate with your team,
          share updates, and coordinate on customer conversations.
        </p>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-dashed px-4 py-2 text-sm text-muted-foreground">
        Coming soon
      </div>
    </div>
  )
}
