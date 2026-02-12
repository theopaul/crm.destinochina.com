// =============================================================================
// WhatsApp Webhook Handler
// Processes incoming webhook payloads from Meta Cloud API
// =============================================================================

import { createAdminClient } from '@/lib/supabase/admin'
import {
  sendTextMessage,
  markAsRead,
  uploadMediaToSupabase,
} from '@/lib/whatsapp/api'
import type {
  Contact,
  Conversation,
  MessageType,
  MessageStatus,
} from '@/types/database'

// -----------------------------------------------------------------------------
// Main Webhook Processor
// -----------------------------------------------------------------------------

export async function processWebhookPayload(payload: any): Promise<void> {
  const supabase = createAdminClient()

  try {
    // The Meta webhook payload has: object, entry[]
    if (payload.object !== 'whatsapp_business_account') {
      return
    }

    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== 'messages') {
          continue
        }

        const value = change.value
        if (!value) continue

        const phoneNumberId = value.metadata?.phone_number_id
        if (!phoneNumberId) continue

        // Look up the organization by whatsapp_phone_number_id
        const { data: org, error: orgError } = await supabase
          .from('crm_organizations')
          .select('*')
          .eq('whatsapp_phone_number_id', phoneNumberId)
          .single()

        if (orgError || !org) {
          console.error(
            `No organization found for phone_number_id: ${phoneNumberId}`,
            orgError
          )
          continue
        }

        // Process incoming messages
        if (value.messages && Array.isArray(value.messages)) {
          for (const message of value.messages) {
            await processIncomingMessage(
              supabase,
              org,
              message,
              value.contacts,
              phoneNumberId
            )
          }
        }

        // Process status updates
        if (value.statuses && Array.isArray(value.statuses)) {
          for (const status of value.statuses) {
            await processStatusUpdate(supabase, status)
          }
        }
      }
    }
  } catch (error) {
    console.error('Error processing webhook payload:', error)
  }
}

// -----------------------------------------------------------------------------
// Process Incoming Message
// -----------------------------------------------------------------------------

async function processIncomingMessage(
  supabase: any,
  org: any,
  message: any,
  contacts: any[] | undefined,
  phoneNumberId: string
): Promise<void> {
  try {
    const senderPhone = message.from // E.164 format
    const waMessageId = message.id
    const timestamp = message.timestamp

    // Extract sender profile info from the contacts array
    const contactProfile = contacts?.find(
      (c: any) => c.wa_id === senderPhone
    )
    const senderName = contactProfile?.profile?.name || null

    // 1. Upsert contact
    const contact = await upsertContact(
      supabase,
      org.org_id,
      senderPhone,
      senderName
    )

    // 2. Find or create conversation
    const conversation = await findOrCreateConversation(
      supabase,
      org.org_id,
      contact.id
    )

    // 3. Determine message type and extract content
    const { messageType, content, mediaId, mimeType, filename } =
      extractMessageContent(message)

    // 4. If media message, download and upload to Supabase Storage
    let mediaUrl: string | null = null
    let mediaMimeType: string | null = mimeType || null
    let mediaFilename: string | null = filename || null

    if (mediaId && (org.whatsapp_access_token || process.env.WHATSAPP_ACCESS_TOKEN)) {
      try {
        const result = await uploadMediaToSupabase(
          mediaId,
          (org.whatsapp_access_token || process.env.WHATSAPP_ACCESS_TOKEN),
          conversation.id
        )
        mediaUrl = result.publicUrl
        mediaMimeType = result.mimeType
      } catch (mediaError) {
        console.error('Error uploading media to Supabase:', mediaError)
      }
    }

    // 5. Save message to crm_messages
    const messagePreview = buildMessagePreview(messageType, content)

    const { data: savedMessage, error: msgError } = await supabase
      .from('crm_messages')
      .insert({
        conversation_id: conversation.id,
        sender_type: 'contact',
        sender_id: contact.id,
        message_type: messageType,
        content: content,
        media_url: mediaUrl,
        media_mime_type: mediaMimeType,
        media_filename: mediaFilename,
        whatsapp_message_id: waMessageId,
        status: 'delivered',
        reply_to_message_id: null,
      })
      .select()
      .single()

    if (msgError) {
      console.error('Error saving message:', msgError)
      return
    }

    // 6. Update conversation: last_message_at, last_message_preview, unread_count
    const { error: convUpdateError } = await supabase
      .from('crm_conversations')
      .update({
        last_message_at: new Date(parseInt(timestamp) * 1000).toISOString(),
        last_message_preview: messagePreview,
        unread_count: (conversation.unread_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversation.id)

    if (convUpdateError) {
      console.error('Error updating conversation:', convUpdateError)
    }

    // 7. If conversation has a bot active, skip agent assignment
    //    (the flow engine would handle this separately)
    if (conversation.is_bot_active) {
      // Bot flow will handle the response
      return
    }

    // 8. If no bot and conversation is pending, assign agent via round-robin
    if (
      conversation.status === 'pending' &&
      !conversation.assigned_agent_id
    ) {
      await assignAgent(supabase, org.org_id, conversation.id, conversation.queue)
    }

    // 9. Send auto-reply if conversation is new and org has auto_reply_message
    if (
      conversation.status === 'pending' &&
      org.auto_reply_message &&
      (org.whatsapp_access_token || process.env.WHATSAPP_ACCESS_TOKEN)
    ) {
      try {
        await sendTextMessage({
          to: senderPhone,
          text: org.auto_reply_message,
          phoneNumberId,
          accessToken: (org.whatsapp_access_token || process.env.WHATSAPP_ACCESS_TOKEN),
        })
      } catch (autoReplyError) {
        console.error('Error sending auto-reply:', autoReplyError)
      }
    }

    // 10. Mark message as read on WhatsApp
    if ((org.whatsapp_access_token || process.env.WHATSAPP_ACCESS_TOKEN)) {
      try {
        await markAsRead(waMessageId, phoneNumberId, (org.whatsapp_access_token || process.env.WHATSAPP_ACCESS_TOKEN))
      } catch (readError) {
        console.error('Error marking message as read:', readError)
      }
    }
  } catch (error) {
    console.error('Error processing incoming message:', error)
  }
}

// -----------------------------------------------------------------------------
// Process Status Update
// -----------------------------------------------------------------------------

async function processStatusUpdate(
  supabase: any,
  status: any
): Promise<void> {
  try {
    const waMessageId = status.id
    const statusValue = status.status as string // sent, delivered, read, failed
    const timestamp = status.timestamp
    const errors = status.errors

    // Map WhatsApp status to our message status
    const statusMap: Record<string, MessageStatus> = {
      sent: 'sent',
      delivered: 'delivered',
      read: 'read',
      failed: 'failed',
    }

    const mappedStatus = statusMap[statusValue]
    if (!mappedStatus) return

    const updateData: any = {
      status: mappedStatus,
    }

    if (mappedStatus === 'failed' && errors && errors.length > 0) {
      updateData.error_message = errors
        .map((e: any) => `${e.code}: ${e.title}`)
        .join('; ')
    }

    const { error } = await supabase
      .from('crm_messages')
      .update(updateData)
      .eq('whatsapp_message_id', waMessageId)

    if (error) {
      console.error('Error updating message status:', error)
    }
  } catch (error) {
    console.error('Error processing status update:', error)
  }
}

// -----------------------------------------------------------------------------
// Generate Protocol Number
// Format: YYYYMMDD-XXXXX (date + 5-digit random)
// -----------------------------------------------------------------------------

function generateProtocolNumber(): string {
  const date = new Date()
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '')
  const random = Math.floor(Math.random() * 99999)
    .toString()
    .padStart(5, '0')
  return `${dateStr}-${random}`
}

// -----------------------------------------------------------------------------
// Upsert Contact
// Creates a new contact or updates existing one by (org_id, phone)
// -----------------------------------------------------------------------------

async function upsertContact(
  supabase: any,
  orgId: string,
  phone: string,
  name?: string | null,
  profilePicture?: string | null
): Promise<Contact> {
  // Try to find existing contact first
  const { data: existing, error: findError } = await supabase
    .from('crm_contacts')
    .select('*')
    .eq('org_id', orgId)
    .eq('phone', phone)
    .single()

  if (existing && !findError) {
    // Update the contact if we have new information
    const updates: any = {
      updated_at: new Date().toISOString(),
    }

    if (name && !existing.name) {
      updates.name = name
    }
    if (profilePicture && profilePicture !== existing.profile_picture_url) {
      updates.profile_picture_url = profilePicture
    }

    // Only update if there are meaningful changes
    if (Object.keys(updates).length > 1) {
      const { data: updated, error: updateError } = await supabase
        .from('crm_contacts')
        .update(updates)
        .eq('id', existing.id)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating contact:', updateError)
        return existing
      }
      return updated
    }

    return existing
  }

  // Create new contact
  const { data: created, error: createError } = await supabase
    .from('crm_contacts')
    .insert({
      org_id: orgId,
      phone,
      name: name || null,
      profile_picture_url: profilePicture || null,
      custom_fields: {},
      tags: [],
    })
    .select()
    .single()

  if (createError) {
    throw new Error(`Failed to create contact: ${createError.message}`)
  }

  return created
}

// -----------------------------------------------------------------------------
// Find or Create Conversation
// Looks for an open/pending conversation for this contact, or creates a new one
// -----------------------------------------------------------------------------

async function findOrCreateConversation(
  supabase: any,
  orgId: string,
  contactId: string
): Promise<Conversation> {
  // Find an existing open or pending conversation for this contact
  const { data: existing, error: findError } = await supabase
    .from('crm_conversations')
    .select('*')
    .eq('org_id', orgId)
    .eq('contact_id', contactId)
    .in('status', ['pending', 'open', 'waiting'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing && !findError) {
    return existing
  }

  // Create a new conversation
  const protocolNumber = generateProtocolNumber()

  const { data: created, error: createError } = await supabase
    .from('crm_conversations')
    .insert({
      org_id: orgId,
      contact_id: contactId,
      status: 'pending',
      is_bot_active: false,
      current_flow_id: null,
      flow_variables: {},
      tags: [],
      classification: null,
      protocol_number: protocolNumber,
      last_message_at: new Date().toISOString(),
      last_message_preview: null,
      unread_count: 0,
    })
    .select()
    .single()

  if (createError) {
    throw new Error(`Failed to create conversation: ${createError.message}`)
  }

  // Log the protocol creation
  await supabase.from('crm_protocol_log').insert({
    org_id: orgId,
    conversation_id: created.id,
    protocol_number: protocolNumber,
    action: 'conversation_created',
    agent_id: null,
    details: { source: 'whatsapp_incoming' },
  })

  return created
}

// -----------------------------------------------------------------------------
// Assign Agent (Round-Robin / Least Busy)
// Finds the agent with the fewest open conversations who is online
// -----------------------------------------------------------------------------

async function assignAgent(
  supabase: any,
  orgId: string,
  conversationId: string,
  queue?: string | null
): Promise<void> {
  try {
    // Get all online/available agents for this org
    let agentQuery = supabase
      .from('crm_users')
      .select('*')
      .eq('org_id', orgId)
      .in('status', ['online', 'away'])
      .in('role', ['agent', 'admin', 'owner'])

    // If queue is specified, filter by agents who handle that queue
    if (queue) {
      agentQuery = agentQuery.or(`queue.eq.${queue},queue.eq.both`)
    }

    const { data: agents, error: agentError } = await agentQuery

    if (agentError || !agents || agents.length === 0) {
      console.log(
        'No available agents found for assignment in org:',
        orgId
      )
      return
    }

    // For each agent, count their currently open conversations
    const agentCounts: Array<{ agent: any; openCount: number }> = []

    for (const agent of agents) {
      const { count, error: countError } = await supabase
        .from('crm_conversations')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('assigned_agent_id', agent.id)
        .in('status', ['open', 'waiting'])

      if (countError) {
        console.error(
          `Error counting conversations for agent ${agent.id}:`,
          countError
        )
        continue
      }

      const openCount = count || 0

      // Skip agents at their max capacity
      if (openCount >= agent.max_concurrent_chats) {
        continue
      }

      agentCounts.push({ agent, openCount })
    }

    if (agentCounts.length === 0) {
      console.log('All agents are at max capacity in org:', orgId)
      return
    }

    // Sort by least busy (fewest open conversations), then by online status preference
    agentCounts.sort((a, b) => {
      // Prefer online over away
      if (a.agent.status === 'online' && b.agent.status !== 'online') return -1
      if (a.agent.status !== 'online' && b.agent.status === 'online') return 1
      // Then by open count
      return a.openCount - b.openCount
    })

    const selectedAgent = agentCounts[0].agent

    // Assign the conversation to this agent
    const { error: assignError } = await supabase
      .from('crm_conversations')
      .update({
        assigned_agent_id: selectedAgent.id,
        status: 'open',
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)

    if (assignError) {
      console.error('Error assigning agent:', assignError)
      return
    }

    // Log the assignment in the protocol log
    const { data: conv } = await supabase
      .from('crm_conversations')
      .select('protocol_number')
      .eq('id', conversationId)
      .single()

    if (conv?.protocol_number) {
      await supabase.from('crm_protocol_log').insert({
        org_id: orgId,
        conversation_id: conversationId,
        protocol_number: conv.protocol_number,
        action: 'agent_assigned',
        agent_id: null,
        details: {
          agent_id: selectedAgent.id,
          agent_name: selectedAgent.display_name,
          method: 'round_robin_least_busy',
        },
      })
    }

    // Log agent activity
    await supabase.from('crm_agent_activity_log').insert({
      org_id: orgId,
      agent_id: selectedAgent.id,
      activity_type: 'conversation_assigned',
      details: { conversation_id: conversationId },
    })
  } catch (error) {
    console.error('Error in assignAgent:', error)
  }
}

// -----------------------------------------------------------------------------
// Extract Message Content from WhatsApp Webhook Message
// -----------------------------------------------------------------------------

function extractMessageContent(message: any): {
  messageType: MessageType
  content: string | null
  mediaId: string | null
  mimeType: string | null
  filename: string | null
} {
  const type = message.type as string

  switch (type) {
    case 'text':
      return {
        messageType: 'text',
        content: message.text?.body || null,
        mediaId: null,
        mimeType: null,
        filename: null,
      }

    case 'image':
      return {
        messageType: 'image',
        content: message.image?.caption || null,
        mediaId: message.image?.id || null,
        mimeType: message.image?.mime_type || null,
        filename: null,
      }

    case 'audio':
      return {
        messageType: 'audio',
        content: null,
        mediaId: message.audio?.id || null,
        mimeType: message.audio?.mime_type || null,
        filename: null,
      }

    case 'video':
      return {
        messageType: 'video',
        content: message.video?.caption || null,
        mediaId: message.video?.id || null,
        mimeType: message.video?.mime_type || null,
        filename: null,
      }

    case 'document':
      return {
        messageType: 'document',
        content: message.document?.caption || null,
        mediaId: message.document?.id || null,
        mimeType: message.document?.mime_type || null,
        filename: message.document?.filename || null,
      }

    case 'sticker':
      return {
        messageType: 'sticker',
        content: null,
        mediaId: message.sticker?.id || null,
        mimeType: message.sticker?.mime_type || null,
        filename: null,
      }

    case 'location':
      return {
        messageType: 'location',
        content: JSON.stringify({
          latitude: message.location?.latitude,
          longitude: message.location?.longitude,
          name: message.location?.name,
          address: message.location?.address,
        }),
        mediaId: null,
        mimeType: null,
        filename: null,
      }

    case 'reaction':
      return {
        messageType: 'reaction',
        content: message.reaction?.emoji || null,
        mediaId: null,
        mimeType: null,
        filename: null,
      }

    default:
      return {
        messageType: 'text',
        content: `[Unsupported message type: ${type}]`,
        mediaId: null,
        mimeType: null,
        filename: null,
      }
  }
}

// -----------------------------------------------------------------------------
// Build Message Preview (for conversation list)
// -----------------------------------------------------------------------------

function buildMessagePreview(
  messageType: MessageType,
  content: string | null
): string {
  switch (messageType) {
    case 'text':
      return content
        ? content.length > 100
          ? content.substring(0, 100) + '...'
          : content
        : ''
    case 'image':
      return content ? `[Imagem] ${content}` : '[Imagem]'
    case 'audio':
      return '[Audio]'
    case 'video':
      return content ? `[Video] ${content}` : '[Video]'
    case 'document':
      return content ? `[Documento] ${content}` : '[Documento]'
    case 'sticker':
      return '[Sticker]'
    case 'location':
      return '[Localiza\u00e7\u00e3o]'
    case 'reaction':
      return content || '[Rea\u00e7\u00e3o]'
    default:
      return content || ''
  }
}
