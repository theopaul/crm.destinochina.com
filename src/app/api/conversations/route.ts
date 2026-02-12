// =============================================================================
// Conversations API Route
// GET   /api/conversations -> List conversations (with filters, pagination)
// PATCH /api/conversations -> Update a conversation
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ConversationStatus } from '@/types/database'

// -----------------------------------------------------------------------------
// GET - List Conversations
// Query params: status, assigned_to, queue, search, page, limit
// -----------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminSupabase = createAdminClient()

    // Get the CRM user to determine org_id
    const { data: crmUser, error: crmUserError } = await adminSupabase
      .from('crm_users')
      .select('*')
      .eq('id', user.id)
      .single()

    if (crmUserError || !crmUser) {
      return NextResponse.json(
        { error: 'CRM user not found' },
        { status: 403 }
      )
    }

    // 2. Parse query params
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') // single status or comma-separated
    const assignedTo = searchParams.get('assigned_to') // agent_id or 'me'
    const queue = searchParams.get('queue')
    const search = searchParams.get('search') // search contact name or phone
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '25', 10), 100)
    const offset = (page - 1) * limit

    // 3. Build the query
    let query = adminSupabase
      .from('crm_conversations')
      .select('*, contact:crm_contacts(*), assigned_agent:crm_users(*)', {
        count: 'exact',
      })
      .eq('org_id', crmUser.org_id)
      .order('last_message_at', { ascending: false, nullsFirst: false })

    // Filter by status
    if (status) {
      const statuses = status.split(',').map((s) => s.trim()) as ConversationStatus[]
      if (statuses.length === 1) {
        query = query.eq('status', statuses[0])
      } else {
        query = query.in('status', statuses)
      }
    }

    // Filter by assigned agent
    if (assignedTo) {
      if (assignedTo === 'me') {
        query = query.eq('assigned_agent_id', user.id)
      } else if (assignedTo === 'unassigned') {
        query = query.is('assigned_agent_id', null)
      } else {
        query = query.eq('assigned_agent_id', assignedTo)
      }
    }

    // Filter by queue
    if (queue) {
      query = query.eq('queue', queue)
    }

    // Search by contact name or phone
    // We need to use a different approach since Supabase join filtering is limited.
    // We will filter by contact IDs if search is provided.
    if (search) {
      const { data: matchingContacts } = await adminSupabase
        .from('crm_contacts')
        .select('id')
        .eq('org_id', crmUser.org_id)
        .or(
          `name.ilike.%${search}%,phone.ilike.%${search}%`
        )

      if (matchingContacts && matchingContacts.length > 0) {
        const contactIds = matchingContacts.map((c: any) => c.id)
        query = query.in('contact_id', contactIds)
      } else {
        // No matching contacts - return empty result
        return NextResponse.json(
          {
            data: [],
            total: 0,
            page,
            per_page: limit,
            total_pages: 0,
          },
          { status: 200 }
        )
      }
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    // 4. Execute the query
    const { data: conversations, error: queryError, count } = await query

    if (queryError) {
      console.error('Error fetching conversations:', queryError)
      return NextResponse.json(
        { error: 'Failed to fetch conversations' },
        { status: 500 }
      )
    }

    const total = count || 0
    const totalPages = Math.ceil(total / limit)

    return NextResponse.json(
      {
        data: conversations || [],
        total,
        page,
        per_page: limit,
        total_pages: totalPages,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Unexpected error in GET /api/conversations:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// -----------------------------------------------------------------------------
// PATCH - Update a Conversation
// Body: { id, status?, assigned_agent_id?, tags?, classification?, queue? }
// -----------------------------------------------------------------------------

export async function PATCH(request: NextRequest) {
  try {
    // 1. Authenticate
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminSupabase = createAdminClient()

    // Get the CRM user to determine org_id
    const { data: crmUser, error: crmUserError } = await adminSupabase
      .from('crm_users')
      .select('*')
      .eq('id', user.id)
      .single()

    if (crmUserError || !crmUser) {
      return NextResponse.json(
        { error: 'CRM user not found' },
        { status: 403 }
      )
    }

    // 2. Parse body
    const body = await request.json()
    const {
      id,
      status,
      assigned_agent_id,
      tags,
      classification,
      queue,
    } = body as {
      id: string
      status?: ConversationStatus
      assigned_agent_id?: string | null
      tags?: string[]
      classification?: string | null
      queue?: string | null
    }

    if (!id) {
      return NextResponse.json(
        { error: 'Conversation id is required' },
        { status: 400 }
      )
    }

    // 3. Verify conversation belongs to this org
    const { data: existingConv, error: findError } = await adminSupabase
      .from('crm_conversations')
      .select('*')
      .eq('id', id)
      .eq('org_id', crmUser.org_id)
      .single()

    if (findError || !existingConv) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    // 4. Build update object with only provided fields
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    if (status !== undefined) {
      updateData.status = status
    }
    if (assigned_agent_id !== undefined) {
      updateData.assigned_agent_id = assigned_agent_id
    }
    if (tags !== undefined) {
      updateData.tags = tags
    }
    if (classification !== undefined) {
      updateData.classification = classification
    }
    if (queue !== undefined) {
      updateData.queue = queue
    }

    // 5. Perform the update
    const { data: updatedConv, error: updateError } = await adminSupabase
      .from('crm_conversations')
      .update(updateData)
      .eq('id', id)
      .select('*, contact:crm_contacts(*), assigned_agent:crm_users(*)')
      .single()

    if (updateError) {
      console.error('Error updating conversation:', updateError)
      return NextResponse.json(
        { error: 'Failed to update conversation' },
        { status: 500 }
      )
    }

    // 6. Log significant changes to protocol log
    const changes: string[] = []

    if (status !== undefined && status !== existingConv.status) {
      changes.push(`status: ${existingConv.status} -> ${status}`)
    }
    if (
      assigned_agent_id !== undefined &&
      assigned_agent_id !== existingConv.assigned_agent_id
    ) {
      changes.push(
        `assigned_agent: ${existingConv.assigned_agent_id || 'none'} -> ${assigned_agent_id || 'none'}`
      )

      // Log agent activity for assignment
      if (assigned_agent_id) {
        await adminSupabase.from('crm_agent_activity_log').insert({
          org_id: crmUser.org_id,
          agent_id: assigned_agent_id,
          activity_type: 'conversation_assigned',
          details: {
            conversation_id: id,
            assigned_by: user.id,
          },
        })
      }
    }
    if (status === 'resolved' && existingConv.status !== 'resolved') {
      // Log resolution activity for the current agent
      await adminSupabase.from('crm_agent_activity_log').insert({
        org_id: crmUser.org_id,
        agent_id: user.id,
        activity_type: 'conversation_resolved',
        details: { conversation_id: id },
      })
    }

    if (changes.length > 0 && existingConv.protocol_number) {
      await adminSupabase.from('crm_protocol_log').insert({
        org_id: crmUser.org_id,
        conversation_id: id,
        protocol_number: existingConv.protocol_number,
        action: 'conversation_updated',
        agent_id: user.id,
        details: { changes },
      })
    }

    return NextResponse.json(updatedConv, { status: 200 })
  } catch (error: any) {
    console.error('Unexpected error in PATCH /api/conversations:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
