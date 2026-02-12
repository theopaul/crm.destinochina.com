// =============================================================================
// Database Types - WhatsApp CRM
// Matches Supabase/PostgreSQL schema
// =============================================================================

// -----------------------------------------------------------------------------
// Enums / Constant Objects
// -----------------------------------------------------------------------------

export const USER_ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  AGENT: 'agent',
} as const

export const USER_STATUSES = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  AWAY: 'away',
  BUSY: 'busy',
} as const

export const QUEUE_TYPES = {
  SDR: 'sdr',
  CLOSURE: 'closure',
  BOTH: 'both',
} as const

export const CONVERSATION_STATUSES = {
  PENDING: 'pending',
  OPEN: 'open',
  WAITING: 'waiting',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
} as const

export const MESSAGE_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  AUDIO: 'audio',
  VIDEO: 'video',
  DOCUMENT: 'document',
  TEMPLATE: 'template',
  LOCATION: 'location',
  STICKER: 'sticker',
  REACTION: 'reaction',
  INTERNAL_NOTE: 'internal_note',
} as const

export const SENDER_TYPES = {
  CONTACT: 'contact',
  AGENT: 'agent',
  SYSTEM: 'system',
  BOT: 'bot',
} as const

export const MESSAGE_STATUSES = {
  PENDING: 'pending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  FAILED: 'failed',
} as const

export const CAMPAIGN_STATUSES = {
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  RUNNING: 'running',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  FAILED: 'failed',
} as const

export const CAMPAIGN_RECIPIENT_STATUSES = {
  PENDING: 'pending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  FAILED: 'failed',
} as const

export const FLOW_STATUSES = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
} as const

export const AGENT_ACTIVITY_TYPES = {
  LOGIN: 'login',
  LOGOUT: 'logout',
  STATUS_CHANGE: 'status_change',
  CONVERSATION_ASSIGNED: 'conversation_assigned',
  CONVERSATION_RESOLVED: 'conversation_resolved',
  MESSAGE_SENT: 'message_sent',
  BREAK_START: 'break_start',
  BREAK_END: 'break_end',
} as const

// Derived union types from const objects
export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES]
export type UserStatus = (typeof USER_STATUSES)[keyof typeof USER_STATUSES]
export type QueueType = (typeof QUEUE_TYPES)[keyof typeof QUEUE_TYPES]
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[keyof typeof CONVERSATION_STATUSES]
export type MessageType = (typeof MESSAGE_TYPES)[keyof typeof MESSAGE_TYPES]
export type SenderType = (typeof SENDER_TYPES)[keyof typeof SENDER_TYPES]
export type MessageStatus = (typeof MESSAGE_STATUSES)[keyof typeof MESSAGE_STATUSES]
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[keyof typeof CAMPAIGN_STATUSES]
export type CampaignRecipientStatus = (typeof CAMPAIGN_RECIPIENT_STATUSES)[keyof typeof CAMPAIGN_RECIPIENT_STATUSES]
export type FlowStatus = (typeof FLOW_STATUSES)[keyof typeof FLOW_STATUSES]
export type AgentActivityType = (typeof AGENT_ACTIVITY_TYPES)[keyof typeof AGENT_ACTIVITY_TYPES]

// -----------------------------------------------------------------------------
// Organization
// -----------------------------------------------------------------------------

export interface BusinessHours {
  timezone: string
  hours: Record<string, { start: string; end: string } | null>
}

export interface Organization {
  org_id: string
  name: string
  whatsapp_phone_number_id: string | null
  whatsapp_business_account_id: string | null
  whatsapp_access_token: string | null
  whatsapp_webhook_verify_token: string | null
  hubspot_access_token: string | null
  hubspot_refresh_token: string | null
  hubspot_portal_id: string | null
  business_hours: BusinessHours
  auto_reply_message: string | null
  sla_first_response_minutes: number
  created_at: string
  updated_at: string
}

// -----------------------------------------------------------------------------
// CRM User (Agent)
// -----------------------------------------------------------------------------

export interface CrmUser {
  id: string
  org_id: string
  display_name: string
  email: string
  role: UserRole
  queue: QueueType
  status: UserStatus
  max_concurrent_chats: number
  avatar_url: string | null
  created_at: string
  updated_at: string
}

// -----------------------------------------------------------------------------
// Contact
// -----------------------------------------------------------------------------

export interface Contact {
  id: string
  org_id: string
  phone: string
  name: string | null
  email: string | null
  profile_picture_url: string | null
  custom_fields: Record<string, unknown>
  hubspot_contact_id: string | null
  existing_client_id: string | null
  tags: string[]
  created_at: string
  updated_at: string
}

// -----------------------------------------------------------------------------
// Contact Groups
// -----------------------------------------------------------------------------

export interface ContactGroup {
  id: string
  org_id: string
  name: string
  description: string | null
  color: string | null
  member_count: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ContactGroupMember {
  id: string
  group_id: string
  contact_id: string
  contact?: Contact // joined
  added_at: string
}

// -----------------------------------------------------------------------------
// Conversation
// -----------------------------------------------------------------------------

export interface Conversation {
  id: string
  org_id: string
  contact_id: string
  contact?: Contact // joined
  assigned_agent_id: string | null
  assigned_agent?: CrmUser // joined
  queue: string | null
  status: ConversationStatus
  is_bot_active: boolean
  current_flow_id: string | null
  flow_variables: Record<string, unknown>
  tags: string[]
  classification: string | null
  protocol_number: string | null
  last_message_at: string | null
  last_message_preview: string | null
  unread_count: number
  created_at: string
  updated_at: string
}

// -----------------------------------------------------------------------------
// Message
// -----------------------------------------------------------------------------

export interface Message {
  id: string
  conversation_id: string
  sender_type: SenderType
  sender_id: string | null
  sender?: CrmUser // joined
  message_type: MessageType
  content: string | null
  media_url: string | null
  media_mime_type: string | null
  media_filename: string | null
  template_name: string | null
  template_params: Record<string, unknown> | null
  whatsapp_message_id: string | null
  status: MessageStatus
  error_message: string | null
  reply_to_message_id: string | null
  reply_to_message?: Message | null // joined (self-reference)
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

// -----------------------------------------------------------------------------
// Flow (Chatbot)
// -----------------------------------------------------------------------------

export interface FlowNode {
  id: string
  type: string
  data: Record<string, unknown>
  position: { x: number; y: number }
}

export interface FlowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  label?: string
  condition?: Record<string, unknown>
}

export interface Flow {
  id: string
  org_id: string
  name: string
  description: string | null
  status: FlowStatus
  trigger_type: string
  trigger_value: string | null
  flow_data: { nodes: FlowNode[]; edges: FlowEdge[] } | null
  created_at: string
  updated_at: string
}

// -----------------------------------------------------------------------------
// Campaign
// -----------------------------------------------------------------------------

export interface Campaign {
  id: string
  org_id: string
  name: string
  description: string | null
  template_name: string
  template_params: Record<string, unknown>
  status: CampaignStatus
  scheduled_at: string | null
  started_at: string | null
  completed_at: string | null
  total_recipients: number
  sent_count: number
  delivered_count: number
  read_count: number
  replied_count: number
  failed_count: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CampaignRecipient {
  id: string
  campaign_id: string
  contact_id: string
  contact?: Contact // joined
  phone: string
  status: CampaignRecipientStatus
  whatsapp_message_id: string | null
  sent_at: string | null
  delivered_at: string | null
  read_at: string | null
  replied_at: string | null
  error_message: string | null
  created_at: string
}

// -----------------------------------------------------------------------------
// Team Channels (Internal Chat)
// -----------------------------------------------------------------------------

export interface TeamChannel {
  id: string
  org_id: string
  name: string
  description: string | null
  type: 'public' | 'private' | 'dm'
  created_by: string | null
  created_at: string
}

export interface TeamChannelMember {
  channel_id: string
  user_id: string
  user?: CrmUser // joined
  last_read_at: string | null
  joined_at: string
}

export interface TeamMessage {
  id: string
  channel_id: string
  sender_id: string
  user?: CrmUser // joined
  content: string
  reply_to_id: string | null
  created_at: string
  updated_at: string | null
}

// -----------------------------------------------------------------------------
// Tags
// -----------------------------------------------------------------------------

export interface Tag {
  id: string
  org_id: string
  name: string
  color: string
  created_at: string
}

// -----------------------------------------------------------------------------
// Quick Replies
// -----------------------------------------------------------------------------

export interface QuickReply {
  id: string
  org_id: string
  title: string
  shortcut: string
  content: string
  media_url: string | null
  media_type: string | null
  category: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// -----------------------------------------------------------------------------
// WhatsApp Templates (cached from Meta)
// -----------------------------------------------------------------------------

export interface WhatsAppTemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS'
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'
  text?: string
  buttons?: Array<{
    type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER'
    text: string
    url?: string
    phone_number?: string
  }>
  example?: Record<string, unknown>
}

export interface WhatsAppTemplate {
  id: string
  org_id: string
  whatsapp_template_id: string
  name: string
  language: string
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'DISABLED'
  components: WhatsAppTemplateComponent[]
  updated_at: string
  created_at: string
}

// -----------------------------------------------------------------------------
// Protocol Log (audit trail for conversations)
// -----------------------------------------------------------------------------

export interface ProtocolLog {
  id: string
  org_id: string
  conversation_id: string
  protocol_number: string
  action: string
  agent_id: string | null
  performer?: CrmUser // joined
  details: Record<string, unknown> | null
  created_at: string
}

// -----------------------------------------------------------------------------
// Agent Activity Log
// -----------------------------------------------------------------------------

export interface AgentActivityLog {
  id: string
  org_id: string
  agent_id: string
  user?: CrmUser // joined
  activity_type: AgentActivityType
  details: Record<string, unknown> | null
  created_at: string
}

// -----------------------------------------------------------------------------
// Queue Configuration
// -----------------------------------------------------------------------------

export interface Queue {
  id: string
  org_id: string
  name: string
  slug: string
  description: string | null
  assignment_strategy: 'round_robin' | 'least_busy' | 'manual'
  max_wait_time_minutes: number | null
  auto_assign: boolean
  fallback_queue_id: string | null
  created_at: string
  updated_at: string
}

// =============================================================================
// Composite / Joined Types
// =============================================================================

/** Conversation with the contact object always included */
export type ConversationWithContact = Conversation & {
  contact: Contact
}

/** Conversation with both contact and assigned agent included */
export type ConversationFull = Conversation & {
  contact: Contact
  assigned_agent: CrmUser | null
}

/** Message with the sender (agent) object included */
export type MessageWithSender = Message & {
  sender: CrmUser | null
}

/** Message with sender and reply-to message included */
export type MessageFull = Message & {
  sender: CrmUser | null
  reply_to_message: Message | null
}

/** Campaign with recipients list */
export type CampaignWithRecipients = Campaign & {
  recipients: CampaignRecipient[]
}

/** Contact group with its members */
export type ContactGroupWithMembers = ContactGroup & {
  members: (ContactGroupMember & { contact: Contact })[]
}

/** Team channel with members and last messages */
export type TeamChannelWithMembers = TeamChannel & {
  members: (TeamChannelMember & { user: CrmUser })[]
}

// =============================================================================
// Supabase Realtime Types
// =============================================================================

export type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE'

export interface RealtimePayload<T = Record<string, unknown>> {
  commit_timestamp: string
  eventType: RealtimeEvent
  schema: string
  table: string
  new: T
  old: Partial<T>
  errors: string[] | null
}

export interface RealtimeMessagePayload extends RealtimePayload<Message> {
  table: 'messages'
}

export interface RealtimeConversationPayload extends RealtimePayload<Conversation> {
  table: 'conversations'
}

export interface RealtimeContactPayload extends RealtimePayload<Contact> {
  table: 'contacts'
}

export interface RealtimeCrmUserPayload extends RealtimePayload<CrmUser> {
  table: 'crm_users'
}

// =============================================================================
// Query / Filter Helpers
// =============================================================================

export interface ConversationFilters {
  status?: ConversationStatus | ConversationStatus[]
  assigned_agent_id?: string | null
  queue?: string
  tags?: string[]
  classification?: string
  search?: string
  date_from?: string
  date_to?: string
}

export interface ContactFilters {
  search?: string
  tags?: string[]
  group_id?: string
  has_hubspot?: boolean
  date_from?: string
  date_to?: string
}

export interface MessageFilters {
  conversation_id: string
  message_type?: MessageType | MessageType[]
  sender_type?: SenderType
  before?: string
  after?: string
  limit?: number
}

export interface PaginationParams {
  page: number
  per_page: number
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

// =============================================================================
// Insert / Update types (omit server-generated fields)
// =============================================================================

export type OrganizationInsert = Omit<Organization, 'org_id' | 'created_at' | 'updated_at'>
export type OrganizationUpdate = Partial<Omit<Organization, 'org_id' | 'created_at' | 'updated_at'>>

export type CrmUserInsert = Omit<CrmUser, 'id' | 'created_at' | 'updated_at'>
export type CrmUserUpdate = Partial<Omit<CrmUser, 'id' | 'org_id' | 'created_at' | 'updated_at'>>

export type ContactInsert = Omit<Contact, 'id' | 'created_at' | 'updated_at' | 'contact' | 'assigned_agent'>
export type ContactUpdate = Partial<Omit<Contact, 'id' | 'org_id' | 'created_at' | 'updated_at'>>

export type ConversationInsert = Omit<Conversation, 'id' | 'created_at' | 'updated_at' | 'contact' | 'assigned_agent'>
export type ConversationUpdate = Partial<Omit<Conversation, 'id' | 'org_id' | 'contact_id' | 'created_at' | 'updated_at' | 'contact' | 'assigned_agent'>>

export type MessageInsert = Omit<Message, 'id' | 'created_at' | 'updated_at' | 'sender' | 'reply_to_message'>
export type MessageUpdate = Partial<Pick<Message, 'status' | 'error_message' | 'media_url' | 'metadata'>>

export type FlowInsert = Omit<Flow, 'id' | 'created_at' | 'updated_at'>
export type FlowUpdate = Partial<Omit<Flow, 'id' | 'org_id' | 'created_at' | 'updated_at'>>

export type CampaignInsert = Omit<Campaign, 'id' | 'created_at' | 'updated_at' | 'sent_count' | 'delivered_count' | 'read_count' | 'replied_count' | 'failed_count' | 'started_at' | 'completed_at'>
export type CampaignUpdate = Partial<Omit<Campaign, 'id' | 'org_id' | 'created_at' | 'updated_at'>>

export type TagInsert = Omit<Tag, 'id' | 'created_at'>
export type TagUpdate = Partial<Omit<Tag, 'id' | 'org_id' | 'created_at'>>

export type QuickReplyInsert = Omit<QuickReply, 'id' | 'created_at' | 'updated_at'>
export type QuickReplyUpdate = Partial<Omit<QuickReply, 'id' | 'org_id' | 'created_at' | 'updated_at'>>

export type QueueInsert = Omit<Queue, 'id' | 'created_at' | 'updated_at'>
export type QueueUpdate = Partial<Omit<Queue, 'id' | 'org_id' | 'created_at' | 'updated_at'>>
