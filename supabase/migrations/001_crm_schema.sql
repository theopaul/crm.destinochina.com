-- ============================================================================
-- CRM Schema Migration for WhatsApp CRM System
-- Project: crm.destinochina.com
-- Date: 2026-02-12
--
-- This migration creates all CRM-prefixed tables in the public schema.
-- It coexists with existing tables (profiles, clients, companies, etc.)
-- already present in the Supabase instance.
-- ============================================================================

-- ============================================================================
-- 1. UTILITY FUNCTIONS
-- ============================================================================

-- Updated_at trigger function (reusable across all tables)
CREATE OR REPLACE FUNCTION public.crm_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Protocol number generator: YYYYMMDD-XXXXX (sequential per day)
CREATE OR REPLACE FUNCTION public.crm_generate_protocol_number()
RETURNS text AS $$
DECLARE
  today_prefix text;
  seq_num int;
BEGIN
  today_prefix := to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMMDD');

  SELECT COALESCE(MAX(
    CAST(split_part(protocol_number, '-', 2) AS int)
  ), 0) + 1
  INTO seq_num
  FROM public.crm_protocol_log
  WHERE protocol_number LIKE today_prefix || '-%';

  RETURN today_prefix || '-' || lpad(seq_num::text, 5, '0');
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- 2. TABLE DEFINITIONS
-- ============================================================================

-- --------------------------------------------------------------------------
-- 2.1 crm_organizations
-- --------------------------------------------------------------------------
CREATE TABLE public.crm_organizations (
  org_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,

  -- WhatsApp Cloud API credentials
  whatsapp_phone_number_id       text,
  whatsapp_business_account_id   text,
  whatsapp_access_token          text,  -- encrypt at app layer or via vault
  whatsapp_webhook_verify_token  text,

  -- HubSpot integration
  hubspot_access_token   text,
  hubspot_refresh_token  text,
  hubspot_portal_id      text,

  -- Operational settings
  business_hours jsonb NOT NULL DEFAULT '{
    "timezone": "America/Sao_Paulo",
    "hours": {
      "mon": {"start": "08:00", "end": "18:00"},
      "tue": {"start": "08:00", "end": "18:00"},
      "wed": {"start": "08:00", "end": "18:00"},
      "thu": {"start": "08:00", "end": "18:00"},
      "fri": {"start": "08:00", "end": "18:00"}
    }
  }'::jsonb,
  auto_reply_message          text,
  sla_first_response_minutes  int NOT NULL DEFAULT 5,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER crm_organizations_updated_at
  BEFORE UPDATE ON public.crm_organizations
  FOR EACH ROW EXECUTE FUNCTION public.crm_set_updated_at();


-- --------------------------------------------------------------------------
-- 2.2 crm_users
-- --------------------------------------------------------------------------
CREATE TABLE public.crm_users (
  id            uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  org_id        uuid NOT NULL REFERENCES public.crm_organizations(org_id) ON DELETE CASCADE,
  display_name  text NOT NULL,
  email         text NOT NULL,
  role          text NOT NULL DEFAULT 'agent'
                  CHECK (role IN ('owner', 'admin', 'agent')),
  queue         text NOT NULL DEFAULT 'both'
                  CHECK (queue IN ('sdr', 'closure', 'both')),
  status        text NOT NULL DEFAULT 'offline'
                  CHECK (status IN ('online', 'offline', 'away', 'busy')),
  max_concurrent_chats  int NOT NULL DEFAULT 10,
  avatar_url    text,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER crm_users_updated_at
  BEFORE UPDATE ON public.crm_users
  FOR EACH ROW EXECUTE FUNCTION public.crm_set_updated_at();


-- --------------------------------------------------------------------------
-- 2.3 crm_contacts
-- --------------------------------------------------------------------------
CREATE TABLE public.crm_contacts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES public.crm_organizations(org_id) ON DELETE CASCADE,
  phone               text NOT NULL,          -- E.164 format, e.g. +5511999999999
  name                text,
  email               text,
  profile_picture_url text,
  custom_fields       jsonb NOT NULL DEFAULT '{}',
  hubspot_contact_id  text,
  existing_client_id  uuid,                   -- nullable FK to existing clients table
  tags                text[] NOT NULL DEFAULT '{}',

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (org_id, phone)
);

-- Attempt to add FK to existing clients table; skip gracefully if it doesn't exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'clients'
  ) THEN
    ALTER TABLE public.crm_contacts
      ADD CONSTRAINT crm_contacts_existing_client_fk
      FOREIGN KEY (existing_client_id)
      REFERENCES public.clients(id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE TRIGGER crm_contacts_updated_at
  BEFORE UPDATE ON public.crm_contacts
  FOR EACH ROW EXECUTE FUNCTION public.crm_set_updated_at();


-- --------------------------------------------------------------------------
-- 2.4 crm_contact_groups
-- --------------------------------------------------------------------------
CREATE TABLE public.crm_contact_groups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES public.crm_organizations(org_id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,

  created_at  timestamptz NOT NULL DEFAULT now()
);


-- --------------------------------------------------------------------------
-- 2.5 crm_contact_group_members
-- --------------------------------------------------------------------------
CREATE TABLE public.crm_contact_group_members (
  group_id    uuid NOT NULL REFERENCES public.crm_contact_groups(id) ON DELETE CASCADE,
  contact_id  uuid NOT NULL REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  added_at    timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (group_id, contact_id)
);


-- --------------------------------------------------------------------------
-- 2.6 crm_conversations
-- --------------------------------------------------------------------------
CREATE TABLE public.crm_conversations (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid NOT NULL REFERENCES public.crm_organizations(org_id) ON DELETE CASCADE,
  contact_id           uuid NOT NULL REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  assigned_agent_id    uuid REFERENCES public.crm_users(id) ON DELETE SET NULL,
  queue                text,
  status               text NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'open', 'waiting', 'resolved', 'closed')),

  -- Bot / flow engine
  is_bot_active        boolean NOT NULL DEFAULT false,
  current_flow_id      uuid,
  flow_variables       jsonb NOT NULL DEFAULT '{}',

  -- Metadata
  tags                 text[] NOT NULL DEFAULT '{}',
  classification       text,
  protocol_number      text UNIQUE,
  last_message_at      timestamptz,
  last_message_preview text,
  unread_count         int NOT NULL DEFAULT 0,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_conversations_org_status
  ON public.crm_conversations (org_id, status);

CREATE INDEX idx_crm_conversations_agent_status
  ON public.crm_conversations (assigned_agent_id, status);

CREATE INDEX idx_crm_conversations_contact
  ON public.crm_conversations (contact_id);

CREATE TRIGGER crm_conversations_updated_at
  BEFORE UPDATE ON public.crm_conversations
  FOR EACH ROW EXECUTE FUNCTION public.crm_set_updated_at();


-- --------------------------------------------------------------------------
-- 2.7 crm_messages
-- --------------------------------------------------------------------------
CREATE TABLE public.crm_messages (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id      uuid NOT NULL REFERENCES public.crm_conversations(id) ON DELETE CASCADE,
  sender_type          text NOT NULL
                         CHECK (sender_type IN ('contact', 'agent', 'system', 'bot')),
  sender_id            uuid REFERENCES public.crm_users(id) ON DELETE SET NULL,
  message_type         text NOT NULL
                         CHECK (message_type IN (
                           'text', 'image', 'audio', 'video', 'document',
                           'template', 'location', 'sticker', 'reaction', 'internal_note'
                         )),
  content              text,
  media_url            text,
  media_mime_type      text,
  media_filename       text,
  template_name        text,
  template_params      jsonb,
  whatsapp_message_id  text UNIQUE,
  status               text NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  error_message        text,
  reply_to_message_id  uuid REFERENCES public.crm_messages(id) ON DELETE SET NULL,

  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_messages_conversation_created
  ON public.crm_messages (conversation_id, created_at);

CREATE INDEX idx_crm_messages_whatsapp_id
  ON public.crm_messages (whatsapp_message_id);


-- --------------------------------------------------------------------------
-- 2.8 crm_flows
-- --------------------------------------------------------------------------
CREATE TABLE public.crm_flows (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES public.crm_organizations(org_id) ON DELETE CASCADE,
  name             text NOT NULL,
  description      text,
  flow_data        jsonb NOT NULL DEFAULT '{"nodes": [], "edges": []}'::jsonb,
  trigger_type     text NOT NULL DEFAULT 'keyword'
                     CHECK (trigger_type IN ('keyword', 'first_message', 'manual', 'bulk', 'welcome')),
  trigger_keywords text[] NOT NULL DEFAULT '{}',
  status           text NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'published', 'archived')),

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER crm_flows_updated_at
  BEFORE UPDATE ON public.crm_flows
  FOR EACH ROW EXECUTE FUNCTION public.crm_set_updated_at();

-- Now add the FK from crm_conversations.current_flow_id to crm_flows
ALTER TABLE public.crm_conversations
  ADD CONSTRAINT crm_conversations_current_flow_fk
  FOREIGN KEY (current_flow_id) REFERENCES public.crm_flows(id) ON DELETE SET NULL;


-- --------------------------------------------------------------------------
-- 2.9 crm_campaigns
-- --------------------------------------------------------------------------
CREATE TABLE public.crm_campaigns (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                 uuid NOT NULL REFERENCES public.crm_organizations(org_id) ON DELETE CASCADE,
  name                   text NOT NULL,
  template_name          text,
  template_params        jsonb,
  flow_id                uuid REFERENCES public.crm_flows(id) ON DELETE SET NULL,
  target_group_id        uuid REFERENCES public.crm_contact_groups(id) ON DELETE SET NULL,
  target_contacts        uuid[] NOT NULL DEFAULT '{}',
  batch_size             int NOT NULL DEFAULT 20,
  batch_interval_seconds int NOT NULL DEFAULT 60,
  scheduled_at           timestamptz,
  started_at             timestamptz,
  completed_at           timestamptz,
  status                 text NOT NULL DEFAULT 'draft'
                           CHECK (status IN ('draft', 'scheduled', 'running', 'paused', 'completed', 'failed')),

  -- Counters
  total_recipients  int NOT NULL DEFAULT 0,
  sent_count        int NOT NULL DEFAULT 0,
  delivered_count   int NOT NULL DEFAULT 0,
  read_count        int NOT NULL DEFAULT 0,
  failed_count      int NOT NULL DEFAULT 0,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER crm_campaigns_updated_at
  BEFORE UPDATE ON public.crm_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.crm_set_updated_at();


-- --------------------------------------------------------------------------
-- 2.10 crm_campaign_recipients
-- --------------------------------------------------------------------------
CREATE TABLE public.crm_campaign_recipients (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id          uuid NOT NULL REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
  contact_id           uuid NOT NULL REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  status               text NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  whatsapp_message_id  text,
  error_message        text,
  sent_at              timestamptz,

  created_at  timestamptz NOT NULL DEFAULT now()
);


-- --------------------------------------------------------------------------
-- 2.11 crm_team_channels
-- --------------------------------------------------------------------------
CREATE TABLE public.crm_team_channels (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES public.crm_organizations(org_id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  type        text NOT NULL DEFAULT 'public'
                CHECK (type IN ('public', 'private', 'dm')),
  created_by  uuid REFERENCES public.crm_users(id) ON DELETE SET NULL,

  created_at  timestamptz NOT NULL DEFAULT now()
);


-- --------------------------------------------------------------------------
-- 2.12 crm_team_channel_members
-- --------------------------------------------------------------------------
CREATE TABLE public.crm_team_channel_members (
  channel_id   uuid NOT NULL REFERENCES public.crm_team_channels(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.crm_users(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  joined_at    timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (channel_id, user_id)
);


-- --------------------------------------------------------------------------
-- 2.13 crm_team_messages
-- --------------------------------------------------------------------------
CREATE TABLE public.crm_team_messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id   uuid NOT NULL REFERENCES public.crm_team_channels(id) ON DELETE CASCADE,
  sender_id    uuid NOT NULL REFERENCES public.crm_users(id) ON DELETE CASCADE,
  content      text NOT NULL,
  reply_to_id  uuid REFERENCES public.crm_team_messages(id) ON DELETE SET NULL,
  attachments  jsonb NOT NULL DEFAULT '[]'::jsonb,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER crm_team_messages_updated_at
  BEFORE UPDATE ON public.crm_team_messages
  FOR EACH ROW EXECUTE FUNCTION public.crm_set_updated_at();


-- --------------------------------------------------------------------------
-- 2.14 crm_tags
-- --------------------------------------------------------------------------
CREATE TABLE public.crm_tags (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id  uuid NOT NULL REFERENCES public.crm_organizations(org_id) ON DELETE CASCADE,
  name    text NOT NULL,
  color   text NOT NULL DEFAULT '#6B7280',

  created_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (org_id, name)
);


-- --------------------------------------------------------------------------
-- 2.15 crm_quick_replies
-- --------------------------------------------------------------------------
CREATE TABLE public.crm_quick_replies (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id    uuid NOT NULL REFERENCES public.crm_organizations(org_id) ON DELETE CASCADE,
  shortcut  text NOT NULL,    -- e.g. '/hello'
  title     text NOT NULL,
  content   text NOT NULL,

  created_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (org_id, shortcut)
);


-- --------------------------------------------------------------------------
-- 2.16 crm_whatsapp_templates
-- --------------------------------------------------------------------------
CREATE TABLE public.crm_whatsapp_templates (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES public.crm_organizations(org_id) ON DELETE CASCADE,
  name                  text NOT NULL,
  language              text NOT NULL DEFAULT 'pt_BR',
  category              text,
  components            jsonb,
  status                text NOT NULL DEFAULT 'PENDING'
                          CHECK (status IN ('APPROVED', 'PENDING', 'REJECTED')),
  whatsapp_template_id  text,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER crm_whatsapp_templates_updated_at
  BEFORE UPDATE ON public.crm_whatsapp_templates
  FOR EACH ROW EXECUTE FUNCTION public.crm_set_updated_at();


-- --------------------------------------------------------------------------
-- 2.17 crm_protocol_log
-- --------------------------------------------------------------------------
CREATE TABLE public.crm_protocol_log (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  uuid NOT NULL REFERENCES public.crm_organizations(org_id) ON DELETE CASCADE,
  conversation_id         uuid REFERENCES public.crm_conversations(id) ON DELETE SET NULL,
  protocol_number         text NOT NULL,
  agent_id                uuid REFERENCES public.crm_users(id) ON DELETE SET NULL,
  contact_id              uuid REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  opened_at               timestamptz NOT NULL DEFAULT now(),
  closed_at               timestamptz,
  first_response_at       timestamptz,
  response_time_seconds   int,
  resolution_time_seconds int,
  classification          text,
  tags                    text[] NOT NULL DEFAULT '{}'
);


-- --------------------------------------------------------------------------
-- 2.18 crm_agent_activity_log
-- --------------------------------------------------------------------------
CREATE TABLE public.crm_agent_activity_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES public.crm_organizations(org_id) ON DELETE CASCADE,
  agent_id       uuid NOT NULL REFERENCES public.crm_users(id) ON DELETE CASCADE,
  activity_type  text NOT NULL
                   CHECK (activity_type IN (
                     'login', 'logout', 'break_start', 'break_end',
                     'status_change', 'conversation_assigned', 'conversation_resolved'
                   )),
  metadata       jsonb NOT NULL DEFAULT '{}',

  created_at  timestamptz NOT NULL DEFAULT now()
);


-- --------------------------------------------------------------------------
-- 2.19 crm_queues
-- --------------------------------------------------------------------------
CREATE TABLE public.crm_queues (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES public.crm_organizations(org_id) ON DELETE CASCADE,
  name                  text NOT NULL,
  description           text,
  assignment_strategy   text NOT NULL DEFAULT 'round_robin'
                          CHECK (assignment_strategy IN ('round_robin', 'least_busy', 'manual')),

  created_at  timestamptz NOT NULL DEFAULT now()
);


-- ============================================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all CRM tables
ALTER TABLE public.crm_organizations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_contacts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_contact_groups         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_contact_group_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_conversations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_messages               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_flows                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_campaigns              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_campaign_recipients    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_team_channels          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_team_channel_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_team_messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_tags                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_quick_replies          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_whatsapp_templates     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_protocol_log           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_agent_activity_log     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_queues                 ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Helper: get the current user's org_id from crm_users
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crm_current_user_org_id()
RETURNS uuid AS $$
  SELECT org_id FROM public.crm_users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- 3.1 crm_organizations policies
-- ---------------------------------------------------------------------------
CREATE POLICY "crm_organizations_select"
  ON public.crm_organizations FOR SELECT
  USING (org_id = public.crm_current_user_org_id());

CREATE POLICY "crm_organizations_insert"
  ON public.crm_organizations FOR INSERT
  WITH CHECK (true);  -- any authenticated user can create an org (they become owner)

CREATE POLICY "crm_organizations_update"
  ON public.crm_organizations FOR UPDATE
  USING (org_id = public.crm_current_user_org_id())
  WITH CHECK (org_id = public.crm_current_user_org_id());

CREATE POLICY "crm_organizations_delete"
  ON public.crm_organizations FOR DELETE
  USING (
    org_id = public.crm_current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM public.crm_users
      WHERE id = auth.uid() AND role = 'owner'
    )
  );

-- ---------------------------------------------------------------------------
-- 3.2 crm_users policies
-- ---------------------------------------------------------------------------
CREATE POLICY "crm_users_select"
  ON public.crm_users FOR SELECT
  USING (org_id = public.crm_current_user_org_id());

CREATE POLICY "crm_users_insert"
  ON public.crm_users FOR INSERT
  WITH CHECK (
    org_id = public.crm_current_user_org_id()
    OR NOT EXISTS (SELECT 1 FROM public.crm_users WHERE id = auth.uid())
    -- allow first-time insert (user joining an org)
  );

CREATE POLICY "crm_users_update"
  ON public.crm_users FOR UPDATE
  USING (org_id = public.crm_current_user_org_id())
  WITH CHECK (org_id = public.crm_current_user_org_id());

CREATE POLICY "crm_users_delete"
  ON public.crm_users FOR DELETE
  USING (
    org_id = public.crm_current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM public.crm_users
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ---------------------------------------------------------------------------
-- 3.3 crm_contacts policies
-- ---------------------------------------------------------------------------
CREATE POLICY "crm_contacts_select"
  ON public.crm_contacts FOR SELECT
  USING (org_id = public.crm_current_user_org_id());

CREATE POLICY "crm_contacts_insert"
  ON public.crm_contacts FOR INSERT
  WITH CHECK (org_id = public.crm_current_user_org_id());

CREATE POLICY "crm_contacts_update"
  ON public.crm_contacts FOR UPDATE
  USING (org_id = public.crm_current_user_org_id())
  WITH CHECK (org_id = public.crm_current_user_org_id());

CREATE POLICY "crm_contacts_delete"
  ON public.crm_contacts FOR DELETE
  USING (org_id = public.crm_current_user_org_id());

-- ---------------------------------------------------------------------------
-- 3.4 crm_contact_groups policies
-- ---------------------------------------------------------------------------
CREATE POLICY "crm_contact_groups_select"
  ON public.crm_contact_groups FOR SELECT
  USING (org_id = public.crm_current_user_org_id());

CREATE POLICY "crm_contact_groups_insert"
  ON public.crm_contact_groups FOR INSERT
  WITH CHECK (org_id = public.crm_current_user_org_id());

CREATE POLICY "crm_contact_groups_update"
  ON public.crm_contact_groups FOR UPDATE
  USING (org_id = public.crm_current_user_org_id())
  WITH CHECK (org_id = public.crm_current_user_org_id());

CREATE POLICY "crm_contact_groups_delete"
  ON public.crm_contact_groups FOR DELETE
  USING (org_id = public.crm_current_user_org_id());

-- ---------------------------------------------------------------------------
-- 3.5 crm_contact_group_members policies (join through group for org_id)
-- ---------------------------------------------------------------------------
CREATE POLICY "crm_contact_group_members_select"
  ON public.crm_contact_group_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.crm_contact_groups g
      WHERE g.id = group_id AND g.org_id = public.crm_current_user_org_id()
    )
  );

CREATE POLICY "crm_contact_group_members_insert"
  ON public.crm_contact_group_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.crm_contact_groups g
      WHERE g.id = group_id AND g.org_id = public.crm_current_user_org_id()
    )
  );

CREATE POLICY "crm_contact_group_members_delete"
  ON public.crm_contact_group_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.crm_contact_groups g
      WHERE g.id = group_id AND g.org_id = public.crm_current_user_org_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 3.6 crm_conversations policies
-- ---------------------------------------------------------------------------
CREATE POLICY "crm_conversations_select"
  ON public.crm_conversations FOR SELECT
  USING (org_id = public.crm_current_user_org_id());

CREATE POLICY "crm_conversations_insert"
  ON public.crm_conversations FOR INSERT
  WITH CHECK (org_id = public.crm_current_user_org_id());

CREATE POLICY "crm_conversations_update"
  ON public.crm_conversations FOR UPDATE
  USING (org_id = public.crm_current_user_org_id())
  WITH CHECK (org_id = public.crm_current_user_org_id());

CREATE POLICY "crm_conversations_delete"
  ON public.crm_conversations FOR DELETE
  USING (org_id = public.crm_current_user_org_id());

-- ---------------------------------------------------------------------------
-- 3.7 crm_messages policies (join through conversations for org_id)
-- ---------------------------------------------------------------------------
CREATE POLICY "crm_messages_select"
  ON public.crm_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.crm_conversations c
      WHERE c.id = conversation_id AND c.org_id = public.crm_current_user_org_id()
    )
  );

CREATE POLICY "crm_messages_insert"
  ON public.crm_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.crm_conversations c
      WHERE c.id = conversation_id AND c.org_id = public.crm_current_user_org_id()
    )
  );

CREATE POLICY "crm_messages_update"
  ON public.crm_messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.crm_conversations c
      WHERE c.id = conversation_id AND c.org_id = public.crm_current_user_org_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.crm_conversations c
      WHERE c.id = conversation_id AND c.org_id = public.crm_current_user_org_id()
    )
  );

CREATE POLICY "crm_messages_delete"
  ON public.crm_messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.crm_conversations c
      WHERE c.id = conversation_id AND c.org_id = public.crm_current_user_org_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 3.8 crm_flows policies
-- ---------------------------------------------------------------------------
CREATE POLICY "crm_flows_select"
  ON public.crm_flows FOR SELECT
  USING (org_id = public.crm_current_user_org_id());

CREATE POLICY "crm_flows_insert"
  ON public.crm_flows FOR INSERT
  WITH CHECK (org_id = public.crm_current_user_org_id());

CREATE POLICY "crm_flows_update"
  ON public.crm_flows FOR UPDATE
  USING (org_id = public.crm_current_user_org_id())
  WITH CHECK (org_id = public.crm_current_user_org_id());

CREATE POLICY "crm_flows_delete"
  ON public.crm_flows FOR DELETE
  USING (org_id = public.crm_current_user_org_id());

-- ---------------------------------------------------------------------------
-- 3.9 crm_campaigns policies
-- ---------------------------------------------------------------------------
CREATE POLICY "crm_campaigns_select"
  ON public.crm_campaigns FOR SELECT
  USING (org_id = public.crm_current_user_org_id());

CREATE POLICY "crm_campaigns_insert"
  ON public.crm_campaigns FOR INSERT
  WITH CHECK (org_id = public.crm_current_user_org_id());

CREATE POLICY "crm_campaigns_update"
  ON public.crm_campaigns FOR UPDATE
  USING (org_id = public.crm_current_user_org_id())
  WITH CHECK (org_id = public.crm_current_user_org_id());

CREATE POLICY "crm_campaigns_delete"
  ON public.crm_campaigns FOR DELETE
  USING (org_id = public.crm_current_user_org_id());

-- ---------------------------------------------------------------------------
-- 3.10 crm_campaign_recipients policies (join through campaigns)
-- ---------------------------------------------------------------------------
CREATE POLICY "crm_campaign_recipients_select"
  ON public.crm_campaign_recipients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.crm_campaigns c
      WHERE c.id = campaign_id AND c.org_id = public.crm_current_user_org_id()
    )
  );

CREATE POLICY "crm_campaign_recipients_insert"
  ON public.crm_campaign_recipients FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.crm_campaigns c
      WHERE c.id = campaign_id AND c.org_id = public.crm_current_user_org_id()
    )
  );

CREATE POLICY "crm_campaign_recipients_update"
  ON public.crm_campaign_recipients FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.crm_campaigns c
      WHERE c.id = campaign_id AND c.org_id = public.crm_current_user_org_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.crm_campaigns c
      WHERE c.id = campaign_id AND c.org_id = public.crm_current_user_org_id()
    )
  );

CREATE POLICY "crm_campaign_recipients_delete"
  ON public.crm_campaign_recipients FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.crm_campaigns c
      WHERE c.id = campaign_id AND c.org_id = public.crm_current_user_org_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 3.11 crm_team_channels policies
-- ---------------------------------------------------------------------------
CREATE POLICY "crm_team_channels_select"
  ON public.crm_team_channels FOR SELECT
  USING (org_id = public.crm_current_user_org_id());

CREATE POLICY "crm_team_channels_insert"
  ON public.crm_team_channels FOR INSERT
  WITH CHECK (org_id = public.crm_current_user_org_id());

CREATE POLICY "crm_team_channels_update"
  ON public.crm_team_channels FOR UPDATE
  USING (org_id = public.crm_current_user_org_id())
  WITH CHECK (org_id = public.crm_current_user_org_id());

CREATE POLICY "crm_team_channels_delete"
  ON public.crm_team_channels FOR DELETE
  USING (org_id = public.crm_current_user_org_id());

-- ---------------------------------------------------------------------------
-- 3.12 crm_team_channel_members policies (join through channels)
-- ---------------------------------------------------------------------------
CREATE POLICY "crm_team_channel_members_select"
  ON public.crm_team_channel_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.crm_team_channels ch
      WHERE ch.id = channel_id AND ch.org_id = public.crm_current_user_org_id()
    )
  );

CREATE POLICY "crm_team_channel_members_insert"
  ON public.crm_team_channel_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.crm_team_channels ch
      WHERE ch.id = channel_id AND ch.org_id = public.crm_current_user_org_id()
    )
  );

CREATE POLICY "crm_team_channel_members_update"
  ON public.crm_team_channel_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.crm_team_channels ch
      WHERE ch.id = channel_id AND ch.org_id = public.crm_current_user_org_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.crm_team_channels ch
      WHERE ch.id = channel_id AND ch.org_id = public.crm_current_user_org_id()
    )
  );

CREATE POLICY "crm_team_channel_members_delete"
  ON public.crm_team_channel_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.crm_team_channels ch
      WHERE ch.id = channel_id AND ch.org_id = public.crm_current_user_org_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 3.13 crm_team_messages policies (join through channels)
-- ---------------------------------------------------------------------------
CREATE POLICY "crm_team_messages_select"
  ON public.crm_team_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.crm_team_channels ch
      WHERE ch.id = channel_id AND ch.org_id = public.crm_current_user_org_id()
    )
  );

CREATE POLICY "crm_team_messages_insert"
  ON public.crm_team_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.crm_team_channels ch
      WHERE ch.id = channel_id AND ch.org_id = public.crm_current_user_org_id()
    )
  );

CREATE POLICY "crm_team_messages_update"
  ON public.crm_team_messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.crm_team_channels ch
      WHERE ch.id = channel_id AND ch.org_id = public.crm_current_user_org_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.crm_team_channels ch
      WHERE ch.id = channel_id AND ch.org_id = public.crm_current_user_org_id()
    )
  );

CREATE POLICY "crm_team_messages_delete"
  ON public.crm_team_messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.crm_team_channels ch
      WHERE ch.id = channel_id AND ch.org_id = public.crm_current_user_org_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 3.14 crm_tags policies
-- ---------------------------------------------------------------------------
CREATE POLICY "crm_tags_select"
  ON public.crm_tags FOR SELECT
  USING (org_id = public.crm_current_user_org_id());

CREATE POLICY "crm_tags_insert"
  ON public.crm_tags FOR INSERT
  WITH CHECK (org_id = public.crm_current_user_org_id());

CREATE POLICY "crm_tags_update"
  ON public.crm_tags FOR UPDATE
  USING (org_id = public.crm_current_user_org_id())
  WITH CHECK (org_id = public.crm_current_user_org_id());

CREATE POLICY "crm_tags_delete"
  ON public.crm_tags FOR DELETE
  USING (org_id = public.crm_current_user_org_id());

-- ---------------------------------------------------------------------------
-- 3.15 crm_quick_replies policies
-- ---------------------------------------------------------------------------
CREATE POLICY "crm_quick_replies_select"
  ON public.crm_quick_replies FOR SELECT
  USING (org_id = public.crm_current_user_org_id());

CREATE POLICY "crm_quick_replies_insert"
  ON public.crm_quick_replies FOR INSERT
  WITH CHECK (org_id = public.crm_current_user_org_id());

CREATE POLICY "crm_quick_replies_update"
  ON public.crm_quick_replies FOR UPDATE
  USING (org_id = public.crm_current_user_org_id())
  WITH CHECK (org_id = public.crm_current_user_org_id());

CREATE POLICY "crm_quick_replies_delete"
  ON public.crm_quick_replies FOR DELETE
  USING (org_id = public.crm_current_user_org_id());

-- ---------------------------------------------------------------------------
-- 3.16 crm_whatsapp_templates policies
-- ---------------------------------------------------------------------------
CREATE POLICY "crm_whatsapp_templates_select"
  ON public.crm_whatsapp_templates FOR SELECT
  USING (org_id = public.crm_current_user_org_id());

CREATE POLICY "crm_whatsapp_templates_insert"
  ON public.crm_whatsapp_templates FOR INSERT
  WITH CHECK (org_id = public.crm_current_user_org_id());

CREATE POLICY "crm_whatsapp_templates_update"
  ON public.crm_whatsapp_templates FOR UPDATE
  USING (org_id = public.crm_current_user_org_id())
  WITH CHECK (org_id = public.crm_current_user_org_id());

CREATE POLICY "crm_whatsapp_templates_delete"
  ON public.crm_whatsapp_templates FOR DELETE
  USING (org_id = public.crm_current_user_org_id());

-- ---------------------------------------------------------------------------
-- 3.17 crm_protocol_log policies
-- ---------------------------------------------------------------------------
CREATE POLICY "crm_protocol_log_select"
  ON public.crm_protocol_log FOR SELECT
  USING (org_id = public.crm_current_user_org_id());

CREATE POLICY "crm_protocol_log_insert"
  ON public.crm_protocol_log FOR INSERT
  WITH CHECK (org_id = public.crm_current_user_org_id());

CREATE POLICY "crm_protocol_log_update"
  ON public.crm_protocol_log FOR UPDATE
  USING (org_id = public.crm_current_user_org_id())
  WITH CHECK (org_id = public.crm_current_user_org_id());

CREATE POLICY "crm_protocol_log_delete"
  ON public.crm_protocol_log FOR DELETE
  USING (org_id = public.crm_current_user_org_id());

-- ---------------------------------------------------------------------------
-- 3.18 crm_agent_activity_log policies
-- ---------------------------------------------------------------------------
CREATE POLICY "crm_agent_activity_log_select"
  ON public.crm_agent_activity_log FOR SELECT
  USING (org_id = public.crm_current_user_org_id());

CREATE POLICY "crm_agent_activity_log_insert"
  ON public.crm_agent_activity_log FOR INSERT
  WITH CHECK (org_id = public.crm_current_user_org_id());

CREATE POLICY "crm_agent_activity_log_delete"
  ON public.crm_agent_activity_log FOR DELETE
  USING (org_id = public.crm_current_user_org_id());

-- ---------------------------------------------------------------------------
-- 3.19 crm_queues policies
-- ---------------------------------------------------------------------------
CREATE POLICY "crm_queues_select"
  ON public.crm_queues FOR SELECT
  USING (org_id = public.crm_current_user_org_id());

CREATE POLICY "crm_queues_insert"
  ON public.crm_queues FOR INSERT
  WITH CHECK (org_id = public.crm_current_user_org_id());

CREATE POLICY "crm_queues_update"
  ON public.crm_queues FOR UPDATE
  USING (org_id = public.crm_current_user_org_id())
  WITH CHECK (org_id = public.crm_current_user_org_id());

CREATE POLICY "crm_queues_delete"
  ON public.crm_queues FOR DELETE
  USING (org_id = public.crm_current_user_org_id());


-- ============================================================================
-- 4. SUPABASE REALTIME
-- ============================================================================

-- Enable realtime subscriptions for conversations and messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_team_messages;


-- ============================================================================
-- 5. GRANTS (service_role bypasses RLS; anon/authenticated go through RLS)
-- ============================================================================

-- Grant usage on the public schema (should already exist, but ensuring)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Grant table-level permissions to authenticated users (RLS enforces row access)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION public.crm_set_updated_at() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_generate_protocol_number() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_current_user_org_id() TO authenticated, service_role;


-- ============================================================================
-- 6. COMMENTS (documentation)
-- ============================================================================

COMMENT ON TABLE public.crm_organizations IS 'Multi-tenant organizations. Each org has its own WhatsApp number and HubSpot integration.';
COMMENT ON TABLE public.crm_users IS 'CRM users (agents, admins, owners). References auth.users for authentication.';
COMMENT ON TABLE public.crm_contacts IS 'WhatsApp contacts. One per phone number per organization.';
COMMENT ON TABLE public.crm_contact_groups IS 'Named groups of contacts for bulk messaging and campaigns.';
COMMENT ON TABLE public.crm_contact_group_members IS 'Junction table linking contacts to groups.';
COMMENT ON TABLE public.crm_conversations IS 'Chat conversations between agents and contacts. Core entity for the inbox.';
COMMENT ON TABLE public.crm_messages IS 'Individual messages within conversations. Supports text, media, templates, internal notes.';
COMMENT ON TABLE public.crm_flows IS 'Chatbot flow definitions (nodes and edges for the visual builder).';
COMMENT ON TABLE public.crm_campaigns IS 'Bulk messaging campaigns with batching and scheduling.';
COMMENT ON TABLE public.crm_campaign_recipients IS 'Per-recipient tracking for campaign delivery status.';
COMMENT ON TABLE public.crm_team_channels IS 'Internal team communication channels.';
COMMENT ON TABLE public.crm_team_channel_members IS 'Members of internal team channels.';
COMMENT ON TABLE public.crm_team_messages IS 'Messages in internal team channels.';
COMMENT ON TABLE public.crm_tags IS 'Reusable tags for organizing conversations and contacts.';
COMMENT ON TABLE public.crm_quick_replies IS 'Shortcut templates for agents (e.g. /hello expands to a greeting).';
COMMENT ON TABLE public.crm_whatsapp_templates IS 'WhatsApp message templates synced from the Business API.';
COMMENT ON TABLE public.crm_protocol_log IS 'Service protocol records with SLA tracking metrics.';
COMMENT ON TABLE public.crm_agent_activity_log IS 'Agent activity audit trail (logins, breaks, status changes).';
COMMENT ON TABLE public.crm_queues IS 'Named queues with assignment strategies for routing conversations.';
COMMENT ON FUNCTION public.crm_generate_protocol_number() IS 'Generates a sequential protocol number in YYYYMMDD-XXXXX format based on Sao Paulo timezone.';
COMMENT ON FUNCTION public.crm_current_user_org_id() IS 'Returns the org_id of the currently authenticated user from crm_users.';
