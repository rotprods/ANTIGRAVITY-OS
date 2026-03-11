-- ═══════════════════════════════════════════════════
-- OCULOPS v2 HARDCORE — Phase 1: Foundation
-- Workspaces, Teams, Permissions, Tools, Integrations
-- ═══════════════════════════════════════════════════

-- ── 1. Workspaces ──
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  is_default BOOLEAN DEFAULT false,
  settings JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_workspaces_org_id ON workspaces(org_id);

-- ── 2. Teams ──
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  lead_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_teams_org_id ON teams(org_id);
CREATE INDEX IF NOT EXISTS idx_teams_workspace_id ON teams(workspace_id);

-- ── 3. Team Members ──
CREATE TABLE IF NOT EXISTS team_members (
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('lead', 'member', 'viewer')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);

-- ── 4. Permissions ──
CREATE TABLE IF NOT EXISTS permissions (
  id BIGSERIAL PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role_id BIGINT REFERENCES roles(id) ON DELETE CASCADE,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  conditions JSONB DEFAULT '{}',
  granted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, role_id, resource, action)
);
CREATE INDEX IF NOT EXISTS idx_permissions_org_role ON permissions(org_id, role_id);
CREATE INDEX IF NOT EXISTS idx_permissions_resource ON permissions(resource);

-- ── 5. Tool Registry ──
CREATE TABLE IF NOT EXISTS tool_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code_name TEXT NOT NULL,
  category TEXT DEFAULT 'utility',
  description TEXT,
  input_schema JSONB DEFAULT '{}',
  output_schema JSONB DEFAULT '{}',
  endpoint_url TEXT,
  auth_type TEXT DEFAULT 'service_role' CHECK (auth_type IN ('service_role', 'api_key', 'oauth', 'none')),
  is_active BOOLEAN DEFAULT true,
  version TEXT DEFAULT '1.0.0',
  cost_per_call NUMERIC DEFAULT 0,
  max_calls_per_hour INT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, code_name)
);
CREATE INDEX IF NOT EXISTS idx_tool_registry_org_id ON tool_registry(org_id);
CREATE INDEX IF NOT EXISTS idx_tool_registry_code_name ON tool_registry(code_name);
CREATE INDEX IF NOT EXISTS idx_tool_registry_category ON tool_registry(category);

-- ── 6. Integrations ──
CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'error', 'revoked', 'expired')),
  auth_type TEXT DEFAULT 'oauth2' CHECK (auth_type IN ('oauth2', 'api_key', 'webhook', 'basic')),
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  api_key TEXT,
  webhook_url TEXT,
  webhook_secret TEXT,
  scopes TEXT[] DEFAULT '{}',
  config JSONB DEFAULT '{}',
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  connected_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, provider, name)
);
CREATE INDEX IF NOT EXISTS idx_integrations_org_id ON integrations(org_id);
CREATE INDEX IF NOT EXISTS idx_integrations_provider ON integrations(provider);
CREATE INDEX IF NOT EXISTS idx_integrations_status ON integrations(status);

-- ── 7. Connectors ──
CREATE TABLE IF NOT EXISTS connectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  direction TEXT DEFAULT 'inbound' CHECK (direction IN ('inbound', 'outbound', 'bidirectional')),
  source_entity TEXT NOT NULL,
  target_table TEXT NOT NULL,
  field_mapping JSONB DEFAULT '{}',
  sync_frequency TEXT DEFAULT 'manual' CHECK (sync_frequency IN ('realtime', 'hourly', 'daily', 'manual')),
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  last_sync_count INT DEFAULT 0,
  last_error TEXT,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_connectors_org_id ON connectors(org_id);
CREATE INDEX IF NOT EXISTS idx_connectors_integration_id ON connectors(integration_id);

-- ── 8. Integration Sync Logs ──
CREATE TABLE IF NOT EXISTS integration_sync_logs (
  id BIGSERIAL PRIMARY KEY,
  connector_id UUID NOT NULL REFERENCES connectors(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  direction TEXT NOT NULL,
  records_synced INT DEFAULT 0,
  records_failed INT DEFAULT 0,
  errors JSONB DEFAULT '[]',
  duration_ms INT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled'))
);
CREATE INDEX IF NOT EXISTS idx_sync_logs_connector_id ON integration_sync_logs(connector_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_org_id ON integration_sync_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_started_at ON integration_sync_logs(started_at DESC);

-- ── 9. ALTERs to existing tables ──
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── 10. Enable RLS ──
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_sync_logs ENABLE ROW LEVEL SECURITY;

-- ── 11. RLS Policies ──
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'workspaces', 'teams', 'permissions', 'tool_registry',
    'integrations', 'connectors', 'integration_sync_logs'
  ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "org_select_%s" ON %I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "org_insert_%s" ON %I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "org_update_%s" ON %I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "org_delete_%s" ON %I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "anon_agent_%s" ON %I', tbl, tbl);

    EXECUTE format(
      'CREATE POLICY "org_select_%s" ON %I FOR SELECT TO authenticated USING (org_id IN (SELECT user_org_ids()) OR org_id IS NULL)',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY "org_insert_%s" ON %I FOR INSERT TO authenticated WITH CHECK (org_id IN (SELECT user_org_ids()) OR org_id IS NULL)',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY "org_update_%s" ON %I FOR UPDATE TO authenticated USING (org_id IN (SELECT user_org_ids()) OR org_id IS NULL) WITH CHECK (org_id IN (SELECT user_org_ids()) OR org_id IS NULL)',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY "org_delete_%s" ON %I FOR DELETE TO authenticated USING (org_id IN (SELECT user_org_ids()) OR org_id IS NULL)',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY "anon_agent_%s" ON %I FOR ALL TO anon USING (true) WITH CHECK (true)',
      tbl, tbl
    );
  END LOOP;
END $$;

-- team_members: access if you're in the same org as the team
DROP POLICY IF EXISTS "org_select_team_members" ON team_members;
CREATE POLICY "org_select_team_members" ON team_members
  FOR SELECT TO authenticated
  USING (team_id IN (SELECT id FROM teams WHERE org_id IN (SELECT user_org_ids())));

DROP POLICY IF EXISTS "org_insert_team_members" ON team_members;
CREATE POLICY "org_insert_team_members" ON team_members
  FOR INSERT TO authenticated
  WITH CHECK (team_id IN (SELECT id FROM teams WHERE org_id IN (SELECT user_org_ids())));

DROP POLICY IF EXISTS "org_update_team_members" ON team_members;
CREATE POLICY "org_update_team_members" ON team_members
  FOR UPDATE TO authenticated
  USING (team_id IN (SELECT id FROM teams WHERE org_id IN (SELECT user_org_ids())));

DROP POLICY IF EXISTS "org_delete_team_members" ON team_members;
CREATE POLICY "org_delete_team_members" ON team_members
  FOR DELETE TO authenticated
  USING (team_id IN (SELECT id FROM teams WHERE org_id IN (SELECT user_org_ids())));

DROP POLICY IF EXISTS "anon_agent_team_members" ON team_members;
CREATE POLICY "anon_agent_team_members" ON team_members
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- ── 12. Updated_at triggers ──
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'workspaces', 'teams', 'tool_registry', 'integrations', 'connectors'
  ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_%s_updated_at ON %I', tbl, tbl);
    EXECUTE format(
      'CREATE TRIGGER set_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at()',
      tbl, tbl
    );
  END LOOP;
END $$;

-- ── 13. Auto-set org_id triggers ──
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'workspaces', 'teams', 'permissions', 'tool_registry',
    'integrations', 'connectors', 'integration_sync_logs'
  ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS auto_set_org_id ON %I', tbl);
    EXECUTE format(
      'CREATE TRIGGER auto_set_org_id BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION set_default_org_id()',
      tbl
    );
  END LOOP;
END $$;

-- ── 14. Realtime ──
ALTER PUBLICATION supabase_realtime ADD TABLE workspaces;
ALTER PUBLICATION supabase_realtime ADD TABLE teams;
ALTER PUBLICATION supabase_realtime ADD TABLE integrations;
