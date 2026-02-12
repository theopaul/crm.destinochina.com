import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: conversationId } = await params

    // Verify user has access to this conversation via org
    const { data: crmUser } = await supabase
      .from('crm_users')
      .select('org_id')
      .eq('id', user.id)
      .single()

    if (!crmUser) {
      return NextResponse.json({ error: 'CRM user not found' }, { status: 404 })
    }

    // Verify conversation belongs to user's org
    const { data: conversation } = await supabase
      .from('crm_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('org_id', crmUser.org_id)
      .single()

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const url = new URL(request.url)
    const limit = Math.min(Number(url.searchParams.get('limit') || '50'), 100)
    const before = url.searchParams.get('before') // cursor-based pagination

    let query = supabase
      .from('crm_messages')
      .select('*, sender:crm_users(id, display_name, avatar_url, role)')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (before) {
      query = query.lt('created_at', before)
    }

    const { data: messages, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: messages })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
