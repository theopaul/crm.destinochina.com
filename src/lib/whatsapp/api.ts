// =============================================================================
// WhatsApp Cloud API Wrapper
// Meta Graph API v21.0
// =============================================================================

import { createAdminClient } from '@/lib/supabase/admin'

const WHATSAPP_API_URL = 'https://graph.facebook.com/v21.0'

// -----------------------------------------------------------------------------
// Interfaces
// -----------------------------------------------------------------------------

interface SendTextMessageParams {
  to: string // E.164 phone number
  text: string
  phoneNumberId: string
  accessToken: string
  replyToMessageId?: string
}

interface SendTemplateMessageParams {
  to: string
  templateName: string
  language: string
  components?: any[]
  phoneNumberId: string
  accessToken: string
}

interface SendMediaMessageParams {
  to: string
  type: 'image' | 'audio' | 'video' | 'document'
  mediaUrl?: string
  mediaId?: string
  caption?: string
  filename?: string
  phoneNumberId: string
  accessToken: string
}

interface WhatsAppApiResponse {
  messaging_product: string
  contacts: Array<{ input: string; wa_id: string }>
  messages: Array<{ id: string }>
}

// -----------------------------------------------------------------------------
// Send Text Message
// -----------------------------------------------------------------------------

export async function sendTextMessage(
  params: SendTextMessageParams
): Promise<WhatsAppApiResponse> {
  const { to, text, phoneNumberId, accessToken, replyToMessageId } = params

  const body: any = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { body: text },
  }

  if (replyToMessageId) {
    body.context = { message_id: replyToMessageId }
  }

  const response = await fetch(
    `${WHATSAPP_API_URL}/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`WhatsApp API error: ${JSON.stringify(error)}`)
  }

  return response.json()
}

// -----------------------------------------------------------------------------
// Send Template Message
// -----------------------------------------------------------------------------

export async function sendTemplateMessage(
  params: SendTemplateMessageParams
): Promise<WhatsAppApiResponse> {
  const { to, templateName, language, components, phoneNumberId, accessToken } =
    params

  const body: any = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: language },
    },
  }

  if (components && components.length > 0) {
    body.template.components = components
  }

  const response = await fetch(
    `${WHATSAPP_API_URL}/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`WhatsApp API error: ${JSON.stringify(error)}`)
  }

  return response.json()
}

// -----------------------------------------------------------------------------
// Send Media Message (image, audio, video, document)
// -----------------------------------------------------------------------------

export async function sendMediaMessage(
  params: SendMediaMessageParams
): Promise<WhatsAppApiResponse> {
  const {
    to,
    type,
    mediaUrl,
    mediaId,
    caption,
    filename,
    phoneNumberId,
    accessToken,
  } = params

  if (!mediaUrl && !mediaId) {
    throw new Error('Either mediaUrl or mediaId must be provided')
  }

  const mediaObject: any = {}
  if (mediaId) {
    mediaObject.id = mediaId
  } else if (mediaUrl) {
    mediaObject.link = mediaUrl
  }
  if (caption && (type === 'image' || type === 'video' || type === 'document')) {
    mediaObject.caption = caption
  }
  if (filename && type === 'document') {
    mediaObject.filename = filename
  }

  const body: any = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type,
    [type]: mediaObject,
  }

  const response = await fetch(
    `${WHATSAPP_API_URL}/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`WhatsApp API error: ${JSON.stringify(error)}`)
  }

  return response.json()
}

// -----------------------------------------------------------------------------
// Mark Message as Read
// -----------------------------------------------------------------------------

export async function markAsRead(
  messageId: string,
  phoneNumberId: string,
  accessToken: string
): Promise<{ success: boolean }> {
  const body = {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId,
  }

  const response = await fetch(
    `${WHATSAPP_API_URL}/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`WhatsApp markAsRead error: ${JSON.stringify(error)}`)
  }

  return response.json()
}

// -----------------------------------------------------------------------------
// Get Media URL (retrieve the download URL for a media ID)
// -----------------------------------------------------------------------------

export async function getMediaUrl(
  mediaId: string,
  accessToken: string
): Promise<string> {
  const response = await fetch(`${WHATSAPP_API_URL}/${mediaId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`WhatsApp getMediaUrl error: ${JSON.stringify(error)}`)
  }

  const data = await response.json()
  return data.url as string
}

// -----------------------------------------------------------------------------
// Download Media (returns raw Buffer)
// -----------------------------------------------------------------------------

export async function downloadMedia(
  mediaId: string,
  accessToken: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  // Step 1: Get the media URL
  const mediaUrl = await getMediaUrl(mediaId, accessToken)

  // Step 2: Download the actual file from the URL
  const response = await fetch(mediaUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    throw new Error(
      `WhatsApp media download error: ${response.status} ${response.statusText}`
    )
  }

  const mimeType = response.headers.get('content-type') || 'application/octet-stream'
  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  return { buffer, mimeType }
}

// -----------------------------------------------------------------------------
// Upload Media to Supabase Storage
// Downloads from WhatsApp, then uploads to Supabase "whatsapp-media" bucket.
// Returns the public URL of the uploaded file.
// -----------------------------------------------------------------------------

export async function uploadMediaToSupabase(
  mediaId: string,
  accessToken: string,
  conversationId: string
): Promise<{ publicUrl: string; mimeType: string }> {
  // Download from WhatsApp
  const { buffer, mimeType } = await downloadMedia(mediaId, accessToken)

  // Determine file extension from MIME type
  const extensionMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/amr': 'amr',
    'audio/aac': 'aac',
    'video/mp4': 'mp4',
    'video/3gpp': '3gp',
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/msword': 'doc',
    'application/vnd.ms-excel': 'xls',
    'text/plain': 'txt',
  }
  const ext = extensionMap[mimeType] || 'bin'

  // Build the storage path: conversations/{conversationId}/{timestamp}-{mediaId}.{ext}
  const timestamp = Date.now()
  const storagePath = `conversations/${conversationId}/${timestamp}-${mediaId}.${ext}`

  // Upload to Supabase Storage
  const supabase = createAdminClient()
  const { error: uploadError } = await supabase.storage
    .from('whatsapp-media')
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: false,
    })

  if (uploadError) {
    throw new Error(`Supabase storage upload error: ${uploadError.message}`)
  }

  // Get the public URL
  const { data: urlData } = supabase.storage
    .from('whatsapp-media')
    .getPublicUrl(storagePath)

  return {
    publicUrl: urlData.publicUrl,
    mimeType,
  }
}
