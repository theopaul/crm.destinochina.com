// =============================================================================
// Send Message API Route
// POST /api/messages/send
// Sends a message via WhatsApp and saves it to the database
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  sendTextMessage,
  sendTemplateMessage,
  sendMediaMessage,
} from '@/lib/whatsapp/api'
import type { MessageType } from '@/types/database'

// -----------------------------------------------------------------------------
// POST - Send a message
// -----------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate the user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 2. Parse the request body
    const body = await request.json()
    const {
      conversationId,
      type,
      content,
      mediaUrl,
      templateName,
      templateLanguage,
      templateComponents,
      replyToMessageId,
    } = body as {
      conversationId: string
      type: MessageType
      content?: string
      mediaUrl?: string
      templateName?: string
      templateLanguage?: string
      templateComponents?: any[]
      replyToMessageId?: string
    }

    if (!conversationId || !type) {
      return NextResponse.json(
        { error: 'Missing required fields: conversationId, type' },
        { status: 400 }
      )
    }

    // Use admin client for database operations to bypass RLS
    const adminSupabase = createAdminClient()

    // 3. Get the CRM user (agent) and their org
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

    // 4. Get the conversation with the contact info
    const { data: conversation, error: convError } = await adminSupabase
      .from('crm_conversations')
      .select('*, contact:crm_contacts(*)')
      .eq('id', conversationId)
      .eq('org_id', crmUser.org_id)
      .single()

    if (convError || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    const contact = conversation.contact
    if (!contact || !contact.phone) {
      return NextResponse.json(
        { error: 'Contact phone number not found' },
        { status: 400 }
      )
    }

    // 5. Get the organization's WhatsApp credentials
    const { data: org, error: orgError } = await adminSupabase
      .from('crm_organizations')
      .select('*')
      .eq('org_id', crmUser.org_id)
      .single()

    if (orgError || !org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    if (!org.whatsapp_phone_number_id || !org.whatsapp_access_token) {
      return NextResponse.json(
        { error: 'WhatsApp credentials not configured for this organization' },
        { status: 400 }
      )
    }

    // 6. Send the message via WhatsApp Cloud API
    let waResponse: any
    let messagePreview: string = ''
    let savedMediaUrl: string | null = mediaUrl || null
    let savedMediaMimeType: string | null = null
    let savedMediaFilename: string | null = null

    try {
      switch (type) {
        case 'text': {
          if (!content) {
            return NextResponse.json(
              { error: 'Content is required for text messages' },
              { status: 400 }
            )
          }
          // Look up the WhatsApp message ID for reply context
          let replyToWaId: string | undefined
          if (replyToMessageId) {
            const { data: replyMsg } = await adminSupabase
              .from('crm_messages')
              .select('whatsapp_message_id')
              .eq('id', replyToMessageId)
              .single()
            replyToWaId = replyMsg?.whatsapp_message_id || undefined
          }

          waResponse = await sendTextMessage({
            to: contact.phone,
            text: content,
            phoneNumberId: org.whatsapp_phone_number_id,
            accessToken: org.whatsapp_access_token,
            replyToMessageId: replyToWaId,
          })
          messagePreview =
            content.length > 100 ? content.substring(0, 100) + '...' : content
          break
        }

        case 'template': {
          if (!templateName || !templateLanguage) {
            return NextResponse.json(
              {
                error:
                  'templateName and templateLanguage are required for template messages',
              },
              { status: 400 }
            )
          }

          waResponse = await sendTemplateMessage({
            to: contact.phone,
            templateName,
            language: templateLanguage,
            components: templateComponents,
            phoneNumberId: org.whatsapp_phone_number_id,
            accessToken: org.whatsapp_access_token,
          })
          messagePreview = `[Template] ${templateName}`
          break
        }

        case 'image':
        case 'audio':
        case 'video':
        case 'document': {
          if (!mediaUrl) {
            return NextResponse.json(
              { error: 'mediaUrl is required for media messages' },
              { status: 400 }
            )
          }

          waResponse = await sendMediaMessage({
            to: contact.phone,
            type,
            mediaUrl,
            caption: content || undefined,
            filename:
              type === 'document' ? body.filename || undefined : undefined,
            phoneNumberId: org.whatsapp_phone_number_id,
            accessToken: org.whatsapp_access_token,
          })

          savedMediaFilename = body.filename || null
          savedMediaMimeType = body.mediaMimeType || null

          const typeLabels: Record<string, string> = {
            image: 'Imagem',
            audio: 'Audio',
            video: 'Video',
            document: 'Documento',
          }
          messagePreview = content
            ? `[${typeLabels[type]}] ${content}`
            : `[${typeLabels[type]}]`
          break
        }

        default:
          return NextResponse.json(
            { error: `Unsupported message type: ${type}` },
            { status: 400 }
          )
      }
    } catch (waError: any) {
      console.error('WhatsApp API error:', waError)

      // Save the failed message to the database
      const { data: failedMessage } = await adminSupabase
        .from('crm_messages')
        .insert({
          conversation_id: conversationId,
          sender_type: 'agent',
          sender_id: user.id,
          message_type: type,
          content: content || null,
          media_url: savedMediaUrl,
          media_mime_type: savedMediaMimeType,
          media_filename: savedMediaFilename,
          template_name: templateName || null,
          template_params: templateComponents
            ? { components: templateComponents }
            : null,
          whatsapp_message_id: null,
          status: 'failed',
          error_message: waError.message || 'Unknown WhatsApp API error',
          reply_to_message_id: replyToMessageId || null,
        })
        .select()
        .single()

      return NextResponse.json(
        {
          error: 'Failed to send message via WhatsApp',
          details: waError.message,
          message: failedMessage,
        },
        { status: 502 }
      )
    }

    // 7. Extract the WhatsApp message ID from the response
    const waMessageId = waResponse?.messages?.[0]?.id || null

    // 8. Save the message to crm_messages
    const { data: savedMessage, error: msgError } = await adminSupabase
      .from('crm_messages')
      .insert({
        conversation_id: conversationId,
        sender_type: 'agent',
        sender_id: user.id,
        message_type: type,
        content: content || null,
        media_url: savedMediaUrl,
        media_mime_type: savedMediaMimeType,
        media_filename: savedMediaFilename,
        template_name: templateName || null,
        template_params: templateComponents
          ? { components: templateComponents }
          : null,
        whatsapp_message_id: waMessageId,
        status: 'sent',
        error_message: null,
        reply_to_message_id: replyToMessageId || null,
      })
      .select()
      .single()

    if (msgError) {
      console.error('Error saving message to database:', msgError)
      return NextResponse.json(
        { error: 'Message sent but failed to save to database' },
        { status: 500 }
      )
    }

    // 9. Update conversation: last_message_at, last_message_preview, reset unread
    const { error: convUpdateError } = await adminSupabase
      .from('crm_conversations')
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: messagePreview,
        unread_count: 0,
        // If conversation was pending, mark it as open
        ...(conversation.status === 'pending' ? { status: 'open' } : {}),
        // If no agent assigned, assign the current user
        ...(!conversation.assigned_agent_id
          ? { assigned_agent_id: user.id }
          : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)

    if (convUpdateError) {
      console.error('Error updating conversation:', convUpdateError)
    }

    // 10. Log agent activity
    await adminSupabase.from('crm_agent_activity_log').insert({
      org_id: crmUser.org_id,
      user_id: user.id,
      activity_type: 'message_sent',
      details: {
        conversation_id: conversationId,
        message_id: savedMessage.id,
        message_type: type,
      },
    })

    return NextResponse.json(savedMessage, { status: 200 })
  } catch (error: any) {
    console.error('Unexpected error in send message:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
