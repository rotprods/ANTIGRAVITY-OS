-- ═══════════════════════════════════════════════════
-- OCULOPS OS — Multi-Tenancy Migration
-- Organizations, memberships, org-scoped RLS
-- ═══════════════════════════════════════════════════

-- ── 1. Organizations ──
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  owner_id UUID REFERENCES auth.users(id),
  plan TEXT DEFAULT 'free',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. Org Members ──
CREATE TABLE IF NOT EXISTS org_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

-- ── 3. Add org_id to all tenant-scoped tables ──
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'contacts', 'companies', 'deals', 'tasks', 'campaigns', 'campaign_metrics',
    'signals', 'experiments', 'decisions', 'alerts', 'finance_entries',
    'knowledge_entries', 'niches', 'bets', 'opportunities',
    'automation_workflows', 'automation_runs', 'conversations', 'messages',
    'detected_leads', 'detection_rules', 'daily_snapshots',
    'prospector_leads', 'prospector_scans', 'crm_activities',
    'agent_studies', 'agent_delivery_targets', 'event_log'
  ])
  LOOP
    EXECUTE format(
      'ALTER TABLE %I ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id)',
      tbl
    );
  END LOOP;
END $$;

-- ── 4. Indexes on org_id ──
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'contacts', 'companies', 'deals', 'tasks', 'campaigns', 'campaign_metrics',
    'signals', 'experiments', 'decisions', 'alerts', 'finance_entries',
    'knowledge_entries', 'niches', 'bets', 'opportunities',
    'automation_workflows', 'automation_runs', 'conversations', 'messages',
    'detected_leads', 'detection_rules', 'daily_snapshots',
    'prospector_leads', 'prospector_scans', 'crm_activities',
    'agent_studies', 'agent_delivery_targets', 'event_log'
  ])
  LOOP
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_%s_org_id ON %I (org_id)',
      tbl, tbl
    );
  END LOOP;
END $$;

-- ── 5. Helper function: user_org_ids() ──
CREATE OR REPLACE FUNCTION user_org_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT org_id FROM org_members WHERE user_id = auth.uid()
$$;

-- ── 6. Enable RLS on organizations and org_members ──
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;

-- ── 7a. RLS policies for organizations ──
DROP POLICY IF EXISTS "org_select" ON organizations;
CREATE POLICY "org_select" ON organizations
  FOR SELECT TO authenticated
  USING (id IN (SELECT user_org_ids()));

DROP POLICY IF EXISTS "org_insert" ON organizations;
CREATE POLICY "org_insert" ON organizations
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "org_update" ON organizations;
CREATE POLICY "org_update" ON organizations
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "org_delete" ON organizations;
CREATE POLICY "org_delete" ON organizations
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- ── 7b. RLS policies for org_members ──
DROP POLICY IF EXISTS "org_members_select" ON org_members;
CREATE POLICY "org_members_select" ON org_members
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT user_org_ids()));

DROP POLICY IF EXISTS "org_members_insert" ON org_members;
CREATE POLICY "org_members_insert" ON org_members
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT om.org_id FROM org_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "org_members_delete" ON org_members;
CREATE POLICY "org_members_delete" ON org_members
  FOR DELETE TO authenticated
  USING (
    -- admin/owner can remove anyone, or user can remove self
    user_id = auth.uid()
    OR org_id IN (
      SELECT om.org_id FROM org_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- ── 7c. RLS policies for all org-scoped tables ──
-- Drop old open-access policies and replace with org-scoped ones
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'contacts', 'companies', 'deals', 'tasks', 'campaigns', 'campaign_metrics',
    'signals', 'experiments', 'decisions', 'alerts', 'finance_entries',
    'knowledge_entries', 'niches', 'bets', 'opportunities',
    'automation_workflows', 'automation_runs', 'conversations', 'messages',
    'detected_leads', 'detection_rules', 'daily_snapshots',
    'prospector_leads', 'prospector_scans', 'crm_activities',
    'agent_studies', 'agent_delivery_targets', 'event_log'
  ])
  LOOP
    -- Drop old open-access authenticated policies from initial schema
    EXECUTE format('DROP POLICY IF EXISTS "authenticated_select_%s" ON %I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "authenticated_insert_%s" ON %I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "authenticated_update_%s" ON %I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "authenticated_delete_%s" ON %I', tbl, tbl);

    -- Drop old auth_* policies from agent_studies/agent_delivery_targets migration
    EXECUTE format('DROP POLICY IF EXISTS "auth_select_%s" ON %I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "auth_insert_%s" ON %I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "auth_update_%s" ON %I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "auth_delete_%s" ON %I', tbl, tbl);

    -- Drop anon policies (will re-add for service role / edge functions below)
    EXECUTE format('DROP POLICY IF EXISTS "anon_all_%s" ON %I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "anon_select_%s" ON %I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "anon_insert_%s" ON %I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "anon_update_%s" ON %I', tbl, tbl);

    -- Drop our own policies in case of re-run
    EXECUTE format('DROP POLICY IF EXISTS "org_select_%s" ON %I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "org_insert_%s" ON %I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "org_update_%s" ON %I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "org_delete_%s" ON %I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "anon_agent_%s" ON %I', tbl, tbl);

    -- SELECT: org member OR org_id is NULL (backward compat)
    EXECUTE format(
      'CREATE POLICY "org_select_%s" ON %I FOR SELECT TO authenticated USING (org_id IN (SELECT user_org_ids()) OR org_id IS NULL)',
      tbl, tbl
    );

    -- INSERT: org member OR org_id is NULL
    EXECUTE format(
      'CREATE POLICY "org_insert_%s" ON %I FOR INSERT TO authenticated WITH CHECK (org_id IN (SELECT user_org_ids()) OR org_id IS NULL)',
      tbl, tbl
    );

    -- UPDATE: org member OR org_id is NULL
    EXECUTE format(
      'CREATE POLICY "org_update_%s" ON %I FOR UPDATE TO authenticated USING (org_id IN (SELECT user_org_ids()) OR org_id IS NULL) WITH CHECK (org_id IN (SELECT user_org_ids()) OR org_id IS NULL)',
      tbl, tbl
    );

    -- DELETE: org member OR org_id is NULL
    EXECUTE format(
      'CREATE POLICY "org_delete_%s" ON %I FOR DELETE TO authenticated USING (org_id IN (SELECT user_org_ids()) OR org_id IS NULL)',
      tbl, tbl
    );

    -- Anon policy for edge functions / agents (service_role bypasses RLS anyway,
    -- but anon-invoked functions need this for tables they write to)
    EXECUTE format(
      'CREATE POLICY "anon_agent_%s" ON %I FOR ALL TO anon USING (true) WITH CHECK (true)',
      tbl, tbl
    );
  END LOOP;
END $$;

-- ── 8. Trigger function: auto-set org_id on INSERT if NULL ──
CREATE OR REPLACE FUNCTION set_default_org_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.org_id IS NULL THEN
    NEW.org_id := (SELECT org_id FROM org_members WHERE user_id = auth.uid() LIMIT 1);
  END IF;
  RETURN NEW;
END;
$$;

-- ── 9. Auto-set org_id trigger on all org-scoped tables ──
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'contacts', 'companies', 'deals', 'tasks', 'campaigns', 'campaign_metrics',
    'signals', 'experiments', 'decisions', 'alerts', 'finance_entries',
    'knowledge_entries', 'niches', 'bets', 'opportunities',
    'automation_workflows', 'automation_runs', 'conversations', 'messages',
    'detected_leads', 'detection_rules', 'daily_snapshots',
    'prospector_leads', 'prospector_scans', 'crm_activities',
    'agent_studies', 'agent_delivery_targets', 'event_log'
  ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS auto_set_org_id ON %I', tbl);
    EXECUTE format(
      'CREATE TRIGGER auto_set_org_id BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION set_default_org_id()',
      tbl
    );
  END LOOP;
END $$;

-- ── 10. Add default_org_id to profiles ──
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS default_org_id UUID REFERENCES organizations(id);

-- ── Updated_at triggers for new tables ──
DROP TRIGGER IF EXISTS set_organizations_updated_at ON organizations;
CREATE TRIGGER set_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at();
