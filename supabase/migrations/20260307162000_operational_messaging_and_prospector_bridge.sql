-- ═══════════════════════════════════════════════════
-- Operational bridge for CRM, messaging, and prospector
-- Aligns the SQL schema with the richer frontend/edge runtime
-- ═══════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.set_row_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS crm_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  type TEXT DEFAULT 'note',
  subject TEXT,
  description TEXT,
  outcome TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE crm_activities ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE crm_activities ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE crm_activities ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE crm_activities ADD COLUMN IF NOT EXISTS deal_id UUID REFERENCES deals(id) ON DELETE SET NULL;
ALTER TABLE crm_activities ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL;
ALTER TABLE crm_activities ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'note';
ALTER TABLE crm_activities ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE crm_activities ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE crm_activities ADD COLUMN IF NOT EXISTS outcome TEXT;
ALTER TABLE crm_activities ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE crm_activities ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE crm_activities ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS messaging_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  is_default BOOLEAN DEFAULT FALSE,
  email_address TEXT,
  phone_number TEXT,
  phone_number_id TEXT,
  external_account_id TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  scope TEXT[] DEFAULT '{}'::text[],
  metadata JSONB DEFAULT '{}'::jsonb,
  last_history_id BIGINT,
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE messaging_channels ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE messaging_channels ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE messaging_channels ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE messaging_channels ADD COLUMN IF NOT EXISTS provider TEXT;
ALTER TABLE messaging_channels ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';
ALTER TABLE messaging_channels ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE;
ALTER TABLE messaging_channels ADD COLUMN IF NOT EXISTS email_address TEXT;
ALTER TABLE messaging_channels ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE messaging_channels ADD COLUMN IF NOT EXISTS phone_number_id TEXT;
ALTER TABLE messaging_channels ADD COLUMN IF NOT EXISTS external_account_id TEXT;
ALTER TABLE messaging_channels ADD COLUMN IF NOT EXISTS access_token TEXT;
ALTER TABLE messaging_channels ADD COLUMN IF NOT EXISTS refresh_token TEXT;
ALTER TABLE messaging_channels ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;
ALTER TABLE messaging_channels ADD COLUMN IF NOT EXISTS scope TEXT[] DEFAULT '{}'::text[];
ALTER TABLE messaging_channels ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE messaging_channels ADD COLUMN IF NOT EXISTS last_history_id BIGINT;
ALTER TABLE messaging_channels ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;
ALTER TABLE messaging_channels ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE messaging_channels ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE messaging_channels ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE companies ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS google_maps_id TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS meta_page_id TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS linkedin_url TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS instagram_url TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS score INT DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS company_id UUID;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS linkedin_url TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS instagram_handle TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS instagram_url TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS confidence INT DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_decision_maker BOOLEAN DEFAULT FALSE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'contacts_company_id_fkey'
  ) THEN
    ALTER TABLE contacts
      ADD CONSTRAINT contacts_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE deals ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS company_id UUID;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS monthly_value NUMERIC DEFAULT 0;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'deals_company_id_fkey'
  ) THEN
    ALTER TABLE deals
      ADD CONSTRAINT deals_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE automation_workflows ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE automation_workflows ADD COLUMN IF NOT EXISTS steps JSONB DEFAULT '[]'::jsonb;
ALTER TABLE automation_workflows ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS company_id UUID;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS channel_id UUID;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS assigned_to TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS provider_thread_id TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_inbound_at TIMESTAMPTZ;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_outbound_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'conversations_company_id_fkey'
  ) THEN
    ALTER TABLE conversations
      ADD CONSTRAINT conversations_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'conversations_channel_id_fkey'
  ) THEN
    ALTER TABLE conversations
      ADD CONSTRAINT conversations_channel_id_fkey
      FOREIGN KEY (channel_id) REFERENCES messaging_channels(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE messages ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS channel_id UUID;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS direction TEXT DEFAULT 'outbound';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS content_type TEXT DEFAULT 'text';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS provider_message_id TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS raw_payload JSONB DEFAULT '{}'::jsonb;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'messages_channel_id_fkey'
  ) THEN
    ALTER TABLE messages
      ADD CONSTRAINT messages_channel_id_fkey
      FOREIGN KEY (channel_id) REFERENCES messaging_channels(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE prospector_scans ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE prospector_scans ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'atlas';
ALTER TABLE prospector_scans ADD COLUMN IF NOT EXISTS area_label TEXT;
ALTER TABLE prospector_scans ADD COLUMN IF NOT EXISTS area JSONB DEFAULT '{}'::jsonb;
ALTER TABLE prospector_scans ADD COLUMN IF NOT EXISTS search_center JSONB DEFAULT '{}'::jsonb;
ALTER TABLE prospector_scans ADD COLUMN IF NOT EXISTS filters JSONB DEFAULT '{}'::jsonb;
ALTER TABLE prospector_scans ADD COLUMN IF NOT EXISTS raw_payload JSONB DEFAULT '{}'::jsonb;
ALTER TABLE prospector_scans ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE prospector_scans ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE prospector_scans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE prospector_leads ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE prospector_leads ADD COLUMN IF NOT EXISTS company_id UUID;
ALTER TABLE prospector_leads ADD COLUMN IF NOT EXISTS contact_id UUID;
ALTER TABLE prospector_leads ADD COLUMN IF NOT EXISTS deal_id UUID;
ALTER TABLE prospector_leads ADD COLUMN IF NOT EXISTS scan_id UUID;
ALTER TABLE prospector_leads ADD COLUMN IF NOT EXISTS place_id TEXT;
ALTER TABLE prospector_leads ADD COLUMN IF NOT EXISTS google_maps_id TEXT;
ALTER TABLE prospector_leads ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE prospector_leads ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE prospector_leads ADD COLUMN IF NOT EXISTS lat NUMERIC;
ALTER TABLE prospector_leads ADD COLUMN IF NOT EXISTS lng NUMERIC;
ALTER TABLE prospector_leads ADD COLUMN IF NOT EXISTS maps_url TEXT;
ALTER TABLE prospector_leads ADD COLUMN IF NOT EXISTS review_count INT;
ALTER TABLE prospector_leads ADD COLUMN IF NOT EXISTS social_profiles JSONB DEFAULT '{}'::jsonb;
ALTER TABLE prospector_leads ADD COLUMN IF NOT EXISTS ai_score INT;
ALTER TABLE prospector_leads ADD COLUMN IF NOT EXISTS ai_reasoning TEXT;
ALTER TABLE prospector_leads ADD COLUMN IF NOT EXISTS estimated_deal_value NUMERIC;
ALTER TABLE prospector_leads ADD COLUMN IF NOT EXISTS tech_stack TEXT[] DEFAULT '{}'::text[];
ALTER TABLE prospector_leads ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE prospector_leads ADD COLUMN IF NOT EXISTS contact_name TEXT;
ALTER TABLE prospector_leads ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE prospector_leads ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE prospector_leads ADD COLUMN IF NOT EXISTS business_status TEXT;
ALTER TABLE prospector_leads ADD COLUMN IF NOT EXISTS raw_payload JSONB DEFAULT '{}'::jsonb;
ALTER TABLE prospector_leads ADD COLUMN IF NOT EXISTS discovered_at TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'prospector_leads_company_id_fkey'
  ) THEN
    ALTER TABLE prospector_leads
      ADD CONSTRAINT prospector_leads_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'prospector_leads_contact_id_fkey'
  ) THEN
    ALTER TABLE prospector_leads
      ADD CONSTRAINT prospector_leads_contact_id_fkey
      FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'prospector_leads_deal_id_fkey'
  ) THEN
    ALTER TABLE prospector_leads
      ADD CONSTRAINT prospector_leads_deal_id_fkey
      FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'prospector_leads_scan_id_fkey'
  ) THEN
    ALTER TABLE prospector_leads
      ADD CONSTRAINT prospector_leads_scan_id_fkey
      FOREIGN KEY (scan_id) REFERENCES prospector_scans(id) ON DELETE SET NULL;
  END IF;
END $$;

UPDATE companies
SET data = COALESCE(data, '{}'::jsonb);

UPDATE contacts
SET
  data = COALESCE(data, '{}'::jsonb),
  confidence = COALESCE(confidence, 0);

/* Removed data migration for matching string company names as columns don't exist */

/* Removed obsolete data migration steps */

ALTER TABLE prospector_leads ALTER COLUMN status SET DEFAULT 'detected';

CREATE INDEX IF NOT EXISTS idx_contacts_company_id ON contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_deals_company_id ON deals(company_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_user_created ON crm_activities(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_user_last_message ON conversations(user_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_provider_message_id ON messages(provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messaging_channels_user_type ON messaging_channels(user_id, type, status);
CREATE INDEX IF NOT EXISTS idx_prospector_scans_user_created ON prospector_scans(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prospector_leads_user_status ON prospector_leads(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prospector_leads_place_id ON prospector_leads(place_id) WHERE place_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prospector_leads_maps_id ON prospector_leads(google_maps_id) WHERE google_maps_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_user_external_id
  ON conversations(user_id, external_id)
  WHERE user_id IS NOT NULL AND external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_messaging_channels_email_unique
  ON messaging_channels(user_id, type, email_address)
  WHERE email_address IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_messaging_channels_phone_number_id_unique
  ON messaging_channels(phone_number_id)
  WHERE phone_number_id IS NOT NULL;

ALTER TABLE crm_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE messaging_channels ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'contacts',
      'companies',
      'deals',
      'automation_workflows',
      'conversations',
      'messages',
      'prospector_leads',
      'prospector_scans',
      'crm_activities',
      'messaging_channels'
    ])
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = t
        AND policyname = 'anon_all_' || t
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR ALL TO anon USING (true) WITH CHECK (true)',
        'anon_all_' || t,
        t
      );
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'contacts',
    'companies',
    'deals',
    'automation_workflows',
    'conversations',
    'messages',
    'prospector_leads',
    'prospector_scans',
    'crm_activities',
    'messaging_channels'
  ])
  LOOP
    EXECUTE 'DROP TRIGGER IF EXISTS '
      || quote_ident('set_' || tbl || '_updated_at')
      || ' ON '
      || quote_ident(tbl);
    EXECUTE 'CREATE TRIGGER '
      || quote_ident('set_' || tbl || '_updated_at')
      || ' BEFORE UPDATE ON '
      || quote_ident(tbl)
      || ' FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at()';
  END LOOP;
END $$;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE companies;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE contacts;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE deals;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE automation_workflows;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE prospector_leads;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE prospector_scans;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE crm_activities;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE messaging_channels;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
