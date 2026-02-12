// =============================================================================
// WhatsApp Cloud API Types
// Based on Meta's WhatsApp Business Platform Cloud API
// =============================================================================

// -----------------------------------------------------------------------------
// Incoming Webhook Payload (from Meta)
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks
// -----------------------------------------------------------------------------

/** Top-level webhook payload sent by Meta */
export interface WhatsAppWebhookPayload {
  object: 'whatsapp_business_account'
  entry: WhatsAppWebhookEntry[]
}

export interface WhatsAppWebhookEntry {
  id: string // WhatsApp Business Account ID
  changes: WhatsAppWebhookChange[]
}

export interface WhatsAppWebhookChange {
  value: WhatsAppWebhookValue
  field: 'messages'
}

export interface WhatsAppWebhookValue {
  messaging_product: 'whatsapp'
  metadata: WhatsAppMetadata
  contacts?: WhatsAppContact[]
  messages?: WhatsAppMessage[]
  statuses?: WhatsAppStatus[]
  errors?: WhatsAppError[]
}

export interface WhatsAppMetadata {
  display_phone_number: string
  phone_number_id: string
}

// -----------------------------------------------------------------------------
// Incoming Contact
// -----------------------------------------------------------------------------

export interface WhatsAppContact {
  profile: {
    name: string
  }
  wa_id: string
}

// -----------------------------------------------------------------------------
// Incoming Messages
// -----------------------------------------------------------------------------

export interface WhatsAppMessageBase {
  from: string // sender phone number
  id: string // WhatsApp message ID (wamid.xxx)
  timestamp: string // Unix timestamp as string
  context?: WhatsAppMessageContext
  errors?: WhatsAppError[]
}

export interface WhatsAppMessageContext {
  from: string
  id: string // message ID being replied to
  referred_product?: {
    catalog_id: string
    product_retailer_id: string
  }
}

// --- Text ---
export interface WhatsAppTextMessage extends WhatsAppMessageBase {
  type: 'text'
  text: {
    body: string
  }
}

// --- Image ---
export interface WhatsAppImageMessage extends WhatsAppMessageBase {
  type: 'image'
  image: WhatsAppMedia & {
    caption?: string
  }
}

// --- Audio ---
export interface WhatsAppAudioMessage extends WhatsAppMessageBase {
  type: 'audio'
  audio: WhatsAppMedia
}

// --- Video ---
export interface WhatsAppVideoMessage extends WhatsAppMessageBase {
  type: 'video'
  video: WhatsAppMedia & {
    caption?: string
  }
}

// --- Document ---
export interface WhatsAppDocumentMessage extends WhatsAppMessageBase {
  type: 'document'
  document: WhatsAppMedia & {
    caption?: string
    filename?: string
  }
}

// --- Sticker ---
export interface WhatsAppStickerMessage extends WhatsAppMessageBase {
  type: 'sticker'
  sticker: WhatsAppMedia & {
    animated: boolean
  }
}

// --- Location ---
export interface WhatsAppLocationMessage extends WhatsAppMessageBase {
  type: 'location'
  location: {
    latitude: number
    longitude: number
    name?: string
    address?: string
    url?: string
  }
}

// --- Reaction ---
export interface WhatsAppReactionMessage extends WhatsAppMessageBase {
  type: 'reaction'
  reaction: {
    message_id: string
    emoji: string
  }
}

// --- Contacts (shared) ---
export interface WhatsAppContactsMessage extends WhatsAppMessageBase {
  type: 'contacts'
  contacts: WhatsAppSharedContact[]
}

export interface WhatsAppSharedContact {
  addresses?: Array<{
    street?: string
    city?: string
    state?: string
    zip?: string
    country?: string
    country_code?: string
    type?: 'HOME' | 'WORK'
  }>
  birthday?: string
  emails?: Array<{
    email: string
    type?: 'HOME' | 'WORK'
  }>
  name: {
    formatted_name: string
    first_name?: string
    last_name?: string
    middle_name?: string
    suffix?: string
    prefix?: string
  }
  org?: {
    company?: string
    department?: string
    title?: string
  }
  phones?: Array<{
    phone: string
    type?: 'CELL' | 'MAIN' | 'IPHONE' | 'HOME' | 'WORK'
    wa_id?: string
  }>
  urls?: Array<{
    url: string
    type?: 'HOME' | 'WORK'
  }>
}

// --- Interactive (button reply / list reply) ---
export interface WhatsAppInteractiveMessage extends WhatsAppMessageBase {
  type: 'interactive'
  interactive: {
    type: 'button_reply' | 'list_reply'
    button_reply?: {
      id: string
      title: string
    }
    list_reply?: {
      id: string
      title: string
      description?: string
    }
  }
}

// --- Button (template quick reply callback) ---
export interface WhatsAppButtonMessage extends WhatsAppMessageBase {
  type: 'button'
  button: {
    text: string
    payload: string
  }
}

// --- Order ---
export interface WhatsAppOrderMessage extends WhatsAppMessageBase {
  type: 'order'
  order: {
    catalog_id: string
    text?: string
    product_items: Array<{
      product_retailer_id: string
      quantity: number
      item_price: number
      currency: string
    }>
  }
}

// --- Referral (ad click) ---
export interface WhatsAppReferralMessage extends WhatsAppMessageBase {
  type: 'text'
  text: {
    body: string
  }
  referral: {
    source_url: string
    source_type: 'ad' | 'post'
    source_id: string
    headline?: string
    body?: string
    media_type?: 'image' | 'video'
    image_url?: string
    video_url?: string
    thumbnail_url?: string
    ctwa_clid?: string
  }
}

// --- System ---
export interface WhatsAppSystemMessage extends WhatsAppMessageBase {
  type: 'system'
  system: {
    body: string
    identity: string
    new_wa_id?: string
    wa_id?: string
    type: 'customer_changed_number' | 'customer_identity_changed'
  }
}

/** Discriminated union of all incoming message types */
export type WhatsAppMessage =
  | WhatsAppTextMessage
  | WhatsAppImageMessage
  | WhatsAppAudioMessage
  | WhatsAppVideoMessage
  | WhatsAppDocumentMessage
  | WhatsAppStickerMessage
  | WhatsAppLocationMessage
  | WhatsAppReactionMessage
  | WhatsAppContactsMessage
  | WhatsAppInteractiveMessage
  | WhatsAppButtonMessage
  | WhatsAppOrderMessage
  | WhatsAppReferralMessage
  | WhatsAppSystemMessage

/** Convenience union for messages that carry media files */
export type WhatsAppMediaMessage =
  | WhatsAppImageMessage
  | WhatsAppAudioMessage
  | WhatsAppVideoMessage
  | WhatsAppDocumentMessage
  | WhatsAppStickerMessage

// Common media object shape
export interface WhatsAppMedia {
  id: string
  mime_type: string
  sha256?: string
  link?: string // only present for some media types
}

// -----------------------------------------------------------------------------
// Incoming Status Updates
// -----------------------------------------------------------------------------

export interface WhatsAppStatus {
  id: string // wamid of the message
  status: 'sent' | 'delivered' | 'read' | 'failed'
  timestamp: string
  recipient_id: string
  conversation?: {
    id: string
    origin: {
      type: 'business_initiated' | 'user_initiated' | 'referral_conversion'
    }
    expiration_timestamp?: string
  }
  pricing?: {
    billable: boolean
    pricing_model: 'CBP'
    category: 'business_initiated' | 'user_initiated' | 'referral_conversion' | 'authentication' | 'marketing' | 'utility' | 'service'
  }
  errors?: WhatsAppError[]
}

// -----------------------------------------------------------------------------
// Errors
// -----------------------------------------------------------------------------

export interface WhatsAppError {
  code: number
  title: string
  message?: string
  error_data?: {
    details: string
  }
  href?: string
}

// =============================================================================
// Outgoing / Send Message Types (to Meta Cloud API)
// =============================================================================

// --- Send Text Message ---
export interface SendTextMessageRequest {
  messaging_product: 'whatsapp'
  recipient_type: 'individual'
  to: string
  type: 'text'
  text: {
    preview_url?: boolean
    body: string
  }
  context?: {
    message_id: string // reply to
  }
}

// --- Send Image Message ---
export interface SendImageMessageRequest {
  messaging_product: 'whatsapp'
  recipient_type: 'individual'
  to: string
  type: 'image'
  image: {
    link?: string
    id?: string
    caption?: string
  }
}

// --- Send Audio Message ---
export interface SendAudioMessageRequest {
  messaging_product: 'whatsapp'
  recipient_type: 'individual'
  to: string
  type: 'audio'
  audio: {
    link?: string
    id?: string
  }
}

// --- Send Video Message ---
export interface SendVideoMessageRequest {
  messaging_product: 'whatsapp'
  recipient_type: 'individual'
  to: string
  type: 'video'
  video: {
    link?: string
    id?: string
    caption?: string
  }
}

// --- Send Document Message ---
export interface SendDocumentMessageRequest {
  messaging_product: 'whatsapp'
  recipient_type: 'individual'
  to: string
  type: 'document'
  document: {
    link?: string
    id?: string
    caption?: string
    filename?: string
  }
}

// --- Send Sticker Message ---
export interface SendStickerMessageRequest {
  messaging_product: 'whatsapp'
  recipient_type: 'individual'
  to: string
  type: 'sticker'
  sticker: {
    link?: string
    id?: string
  }
}

// --- Send Location Message ---
export interface SendLocationMessageRequest {
  messaging_product: 'whatsapp'
  recipient_type: 'individual'
  to: string
  type: 'location'
  location: {
    longitude: number
    latitude: number
    name?: string
    address?: string
  }
}

// --- Send Reaction ---
export interface SendReactionMessageRequest {
  messaging_product: 'whatsapp'
  recipient_type: 'individual'
  to: string
  type: 'reaction'
  reaction: {
    message_id: string
    emoji: string
  }
}

// --- Send Template Message ---
export interface SendTemplateRequest {
  messaging_product: 'whatsapp'
  recipient_type: 'individual'
  to: string
  type: 'template'
  template: {
    name: string
    language: {
      code: string // e.g. 'pt_BR', 'en_US', 'zh_CN'
    }
    components?: TemplateComponent[]
  }
}

export interface TemplateComponent {
  type: 'header' | 'body' | 'button'
  sub_type?: 'quick_reply' | 'url'
  index?: number
  parameters: TemplateParameter[]
}

export type TemplateParameter =
  | { type: 'text'; text: string }
  | { type: 'currency'; currency: { fallback_value: string; code: string; amount_1000: number } }
  | { type: 'date_time'; date_time: { fallback_value: string } }
  | { type: 'image'; image: { link?: string; id?: string } }
  | { type: 'video'; video: { link?: string; id?: string } }
  | { type: 'document'; document: { link?: string; id?: string; filename?: string } }
  | { type: 'payload'; payload: string }

// --- Send Interactive Message (buttons / list) ---
export interface SendInteractiveMessageRequest {
  messaging_product: 'whatsapp'
  recipient_type: 'individual'
  to: string
  type: 'interactive'
  interactive: InteractiveButton | InteractiveList
}

export interface InteractiveButton {
  type: 'button'
  header?: InteractiveHeader
  body: { text: string }
  footer?: { text: string }
  action: {
    buttons: Array<{
      type: 'reply'
      reply: {
        id: string
        title: string // max 20 chars
      }
    }>
  }
}

export interface InteractiveList {
  type: 'list'
  header?: InteractiveHeader
  body: { text: string }
  footer?: { text: string }
  action: {
    button: string // max 20 chars, the CTA button text
    sections: Array<{
      title: string
      rows: Array<{
        id: string
        title: string // max 24 chars
        description?: string // max 72 chars
      }>
    }>
  }
}

export type InteractiveHeader =
  | { type: 'text'; text: string }
  | { type: 'image'; image: { link?: string; id?: string } }
  | { type: 'video'; video: { link?: string; id?: string } }
  | { type: 'document'; document: { link?: string; id?: string; filename?: string } }

// --- Union of all outgoing request types ---
export type SendMessageRequest =
  | SendTextMessageRequest
  | SendImageMessageRequest
  | SendAudioMessageRequest
  | SendVideoMessageRequest
  | SendDocumentMessageRequest
  | SendStickerMessageRequest
  | SendLocationMessageRequest
  | SendReactionMessageRequest
  | SendTemplateRequest
  | SendInteractiveMessageRequest

// =============================================================================
// Cloud API Response Types
// =============================================================================

export interface WhatsAppSendResponse {
  messaging_product: 'whatsapp'
  contacts: Array<{
    input: string
    wa_id: string
  }>
  messages: Array<{
    id: string // wamid
    message_status?: string
  }>
}

export interface WhatsAppMediaUploadResponse {
  id: string
}

export interface WhatsAppMediaUrlResponse {
  messaging_product: 'whatsapp'
  url: string
  mime_type: string
  sha256: string
  file_size: number
  id: string
}

// =============================================================================
// Template Management Types
// =============================================================================

export interface WhatsAppTemplateListResponse {
  data: WhatsAppTemplateData[]
  paging?: {
    cursors: {
      before: string
      after: string
    }
    next?: string
  }
}

export interface WhatsAppTemplateData {
  name: string
  components: Array<{
    type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS'
    format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'
    text?: string
    buttons?: Array<{
      type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER'
      text: string
      url?: string
      phone_number?: string
      example?: string[]
    }>
    example?: {
      header_text?: string[]
      header_handle?: string[]
      body_text?: string[][]
    }
  }>
  language: string
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'DISABLED' | 'PAUSED'
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
  id: string
}

// =============================================================================
// Utility / Helper Types
// =============================================================================

/** Extract the message body text regardless of message type */
export function getMessageText(message: WhatsAppMessage): string | null {
  switch (message.type) {
    case 'text':
      return message.text.body
    case 'image':
      return message.image.caption ?? null
    case 'video':
      return message.video.caption ?? null
    case 'document':
      return message.document.caption ?? null
    case 'interactive':
      return message.interactive.button_reply?.title
        ?? message.interactive.list_reply?.title
        ?? null
    case 'button':
      return message.button.text
    case 'location':
      return message.location.name ?? message.location.address ?? null
    case 'reaction':
      return message.reaction.emoji
    default:
      return null
  }
}

/** Check if a message is a media message */
export function isMediaMessage(message: WhatsAppMessage): message is WhatsAppMediaMessage {
  return ['image', 'audio', 'video', 'document', 'sticker'].includes(message.type)
}

/** Get the media object from a media message */
export function getMediaFromMessage(message: WhatsAppMediaMessage): WhatsAppMedia {
  switch (message.type) {
    case 'image':
      return message.image
    case 'audio':
      return message.audio
    case 'video':
      return message.video
    case 'document':
      return message.document
    case 'sticker':
      return message.sticker
  }
}
