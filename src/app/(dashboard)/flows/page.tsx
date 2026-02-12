'use client'

import { GitBranch } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function FlowsPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <GitBranch className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Chatbot Flows</h1>
        <p className="text-muted-foreground max-w-md">
          Visual flow builder for automated chatbot conversations. Design
          conversational paths, set triggers, and create seamless automated
          experiences for your customers.
        </p>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-dashed px-4 py-2 text-sm text-muted-foreground">
        Coming soon
      </div>
      <Button disabled>
        <GitBranch className="mr-2 h-4 w-4" />
        Create New Flow
      </Button>
    </div>
  )
}
