// =============================================================================
// Contacts API Route
// GET  /api/contacts -> List contacts (with search, pagination, group filter)
// POST /api/contacts -> Create a new contact
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// -----------------------------------------------------------------------------
// GET - List Contacts
// Query params: search, group_id, tags, page, limit
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
    const search = searchParams.get('search')
    const groupId = searchParams.get('group_id')
    const tagsParam = searchParams.get('tags') // comma-separated tag names
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '25', 10), 100)
    const offset = (page - 1) * limit

    // 3. If filtering by group, we need to get contact IDs from group members first
    let groupContactIds: string[] | null = null

    if (groupId) {
      const { data: groupMembers, error: groupError } = await adminSupabase
        .from('crm_contact_group_members')
        .select('contact_id')
        .eq('group_id', groupId)

      if (groupError) {
        console.error('Error fetching group members:', groupError)
        return NextResponse.json(
          { error: 'Failed to fetch group members' },
          { status: 500 }
        )
      }

      groupContactIds = (groupMembers || []).map((m: any) => m.contact_id)

      // If no members in the group, return empty
      if (groupContactIds.length === 0) {
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

    // 4. Build the query
    let query = adminSupabase
      .from('crm_contacts')
      .select('*', { count: 'exact' })
      .eq('org_id', crmUser.org_id)
      .order('updated_at', { ascending: false })

    // Search by name, phone, or email
    if (search) {
      query = query.or(
        `name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`
      )
    }

    // Filter by group membership
    if (groupContactIds) {
      query = query.in('id', groupContactIds)
    }

    // Filter by tags (contacts must contain all specified tags)
    if (tagsParam) {
      const tags = tagsParam.split(',').map((t) => t.trim())
      for (const tag of tags) {
        query = query.contains('tags', [tag])
      }
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    // 5. Execute
    const { data: contacts, error: queryError, count } = await query

    if (queryError) {
      console.error('Error fetching contacts:', queryError)
      return NextResponse.json(
        { error: 'Failed to fetch contacts' },
        { status: 500 }
      )
    }

    const total = count || 0
    const totalPages = Math.ceil(total / limit)

    return NextResponse.json(
      {
        data: contacts || [],
        total,
        page,
        per_page: limit,
        total_pages: totalPages,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Unexpected error in GET /api/contacts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// -----------------------------------------------------------------------------
// POST - Create a New Contact
// Body: { phone, name?, email?, custom_fields?, tags? }
// -----------------------------------------------------------------------------

export async function POST(request: NextRequest) {
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

    // 2. Parse the request body
    const body = await request.json()
    const { phone, name, email, custom_fields, tags } = body as {
      phone: string
      name?: string
      email?: string
      custom_fields?: Record<string, unknown>
      tags?: string[]
    }

    if (!phone) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      )
    }

    // 3. Validate phone format (basic E.164 check)
    const phoneRegex = /^\+?[1-9]\d{1,14}$/
    const normalizedPhone = phone.replace(/\s+/g, '').replace(/[()-]/g, '')
    if (!phoneRegex.test(normalizedPhone)) {
      return NextResponse.json(
        {
          error:
            'Invalid phone number format. Please use E.164 format (e.g., +5511999999999)',
        },
        { status: 400 }
      )
    }

    // 4. Check if a contact with this phone already exists in this org
    const { data: existingContact, error: findError } = await adminSupabase
      .from('crm_contacts')
      .select('*')
      .eq('org_id', crmUser.org_id)
      .eq('phone', normalizedPhone)
      .maybeSingle()

    if (existingContact) {
      return NextResponse.json(
        {
          error: 'A contact with this phone number already exists',
          existing_contact: existingContact,
        },
        { status: 409 }
      )
    }

    // 5. Create the contact
    const { data: newContact, error: createError } = await adminSupabase
      .from('crm_contacts')
      .insert({
        org_id: crmUser.org_id,
        phone: normalizedPhone,
        name: name || null,
        email: email || null,
        avatar_url: null,
        custom_fields: custom_fields || {},
        hubspot_contact_id: null,
        existing_client_id: null,
        tags: tags || [],
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating contact:', createError)
      return NextResponse.json(
        { error: 'Failed to create contact' },
        { status: 500 }
      )
    }

    return NextResponse.json(newContact, { status: 201 })
  } catch (error: any) {
    console.error('Unexpected error in POST /api/contacts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
