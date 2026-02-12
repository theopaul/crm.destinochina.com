'use client'

import { Send } from 'lucide-react'

export default function BulkSendingPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Send className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Bulk Sending</h1>
        <p className="text-muted-foreground max-w-md">
          Send WhatsApp template messages to multiple contacts at once. Create
          campaigns, select audience segments, and track delivery metrics.
        </p>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-dashed px-4 py-2 text-sm text-muted-foreground">
        Coming soon
      </div>
    </div>
  )
}
