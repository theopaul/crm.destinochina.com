import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(
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
    const body = await request.json()
    const { status, assigned_agent_id, tags, classification, queue, is_bot_active } = body

    const adminSupabase = createAdminClient()

    // Get the CRM user
    const { data: crmUser } = await supabase
      .from('crm_users')
      .select('id, org_id, display_name')
      .eq('id', user.id)
      .single()

    if (!crmUser) {
      return NextResponse.json({ error: 'CRM user not found' }, { status: 404 })
    }

    // Verify conversation belongs to user's org
    const { data: existing } = await adminSupabase
      .from('crm_conversations')
      .select('id, status, assigned_agent_id, protocol_number')
      .eq('id', conversationId)
      .eq('org_id', crmUser.org_id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Build update object
    const updates: Record<string, unknown> = {}
    if (status !== undefined) updates.status = status
    if (assigned_agent_id !== undefined) updates.assigned_agent_id = assigned_agent_id
    if (tags !== undefined) updates.tags = tags
    if (classification !== undefined) updates.classification = classification
    if (queue !== undefined) updates.queue = queue
    if (is_bot_active !== undefined) updates.is_bot_active = is_bot_active

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const { data: updated, error: updateError } = await adminSupabase
      .from('crm_conversations')
      .update(updates)
      .eq('id', conversationId)
      .select('*, contact:crm_contacts(*), assigned_agent:crm_users(id, display_name, avatar_url)')
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Log significant changes
    if (assigned_agent_id !== undefined && assigned_agent_id !== existing.assigned_agent_id) {
      await adminSupabase.from('crm_agent_activity_log').insert({
        org_id: crmUser.org_id,
        agent_id: assigned_agent_id || crmUser.id,
        activity_type: 'conversation_assigned',
        details: { conversation_id: conversationId, assigned_by: crmUser.id },
        conversation_id: conversationId,
      }).then(() => {}) // fire and forget
    }

    if (status === 'resolved' && existing.status !== 'resolved') {
      await adminSupabase.from('crm_agent_activity_log').insert({
        org_id: crmUser.org_id,
        agent_id: crmUser.id,
        activity_type: 'conversation_resolved',
        details: { conversation_id: conversationId },
        conversation_id: conversationId,
      }).then(() => {})

      await adminSupabase.from('crm_protocol_log').insert({
        org_id: crmUser.org_id,
        conversation_id: conversationId,
        protocol_number: existing.protocol_number,
        agent_id: crmUser.id,
        action: 'resolved',
        details: `Resolved by ${crmUser.display_name}`,
      }).then(() => {})
    }

    return NextResponse.json({ data: updated })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
