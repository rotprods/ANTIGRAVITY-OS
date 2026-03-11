-- ═══════════════════════════════════════════════════
-- OCULOPS v2 HARDCORE — Phase 10: GTM & Meta
-- ICPs, Channels, Partners, User Prefs, Saved Views, Command History, Maturity
-- ═══════════════════════════════════════════════════

-- ── 1. ICP Definitions ──
CREATE TABLE IF NOT EXISTS icp_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  criteria JSONB NOT NULL,
  scoring_weights JSONB DEFAULT '{}',
  status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived')),
  match_count INT DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_icp_defs_org_id ON icp_definitions(org_id);

-- ── 2. Channel Configs ──
CREATE TABLE IF NOT EXISTS channel_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'paused', 'retired')),
  budget_monthly NUMERIC DEFAULT 0,
  target_leads INT DEFAULT 0,
  actual_leads INT DEFAULT 0,
  cost_per_lead NUMERIC DEFAULT 0,
  conversion_rate NUMERIC DEFAULT 0,
  config JSONB DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, channel)
);
CREATE INDEX IF NOT EXISTS idx_channel_configs_org_id ON channel_configs(org_id);

-- ── 3. Partner Programs ──
CREATE TABLE IF NOT EXISTS partner_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  partner_name TEXT NOT NULL,
  partner_type TEXT DEFAULT 'referral' CHECK (partner_type IN ('referral', 'reseller', 'technology', 'strategic', 'affiliate')),
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  commission_pct NUMERIC DEFAULT 0 CHECK (commission_pct BETWEEN 0 AND 100),
  status TEXT DEFAULT 'active' CHECK (status IN ('prospect', 'active', 'paused', 'terminated')),
  agreement_url TEXT,
  total_referrals INT DEFAULT 0,
  total_revenue NUMERIC DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_partner_programs_org_id ON partner_programs(org_id);
CREATE INDEX IF NOT EXISTS idx_partner_programs_status ON partner_programs(status);

-- ── 4. User Preferences ──
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, org_id, key)
);
CREATE INDEX IF NOT EXISTS idx_user_prefs_user_id ON user_preferences(user_id);

-- ── 5. Saved Views ──
CREATE TABLE IF NOT EXISTS saved_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  name TEXT NOT NULL,
  filters JSONB DEFAULT '{}',
  sort JSONB DEFAULT '{}',
  columns JSONB DEFAULT '[]',
  is_default BOOLEAN DEFAULT false,
  is_shared BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_saved_views_user_module ON saved_views(user_id, module);
CREATE INDEX IF NOT EXISTS idx_saved_views_org_id ON saved_views(org_id);

-- ── 6. Command History ──
CREATE TABLE IF NOT EXISTS command_history (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  command TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  result_status TEXT DEFAULT 'completed' CHECK (result_status IN ('completed', 'failed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_command_history_user_id ON command_history(user_id, created_at DESC);

-- ── 7. Maturity Assessments ──
CREATE TABLE IF NOT EXISTS maturity_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assessment_date DATE NOT NULL,
  dimensions JSONB NOT NULL,
  overall_score NUMERIC,
  recommendations JSONB DEFAULT '[]',
  assessed_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_maturity_assessments_org_id ON maturity_assessments(org_id);
CREATE INDEX IF NOT EXISTS idx_maturity_assessments_date ON maturity_assessments(assessment_date DESC);

-- ── 8. ALTERs to existing tables ──
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS icp_id UUID REFERENCES icp_definitions(id) ON DELETE SET NULL;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS icp_match_score INT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS source_channel TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES partner_programs(id) ON DELETE SET NULL;

-- ── 9. Enable RLS + Policies ──
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'icp_definitions', 'channel_configs', 'partner_programs',
    'user_preferences', 'saved_views', 'command_history', 'maturity_assessments'
  ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);

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

-- user_preferences: user can only access their own
DROP POLICY IF EXISTS "org_select_user_preferences" ON user_preferences;
CREATE POLICY "user_select_user_preferences" ON user_preferences
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "org_insert_user_preferences" ON user_preferences;
CREATE POLICY "user_insert_user_preferences" ON user_preferences
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "org_update_user_preferences" ON user_preferences;
CREATE POLICY "user_update_user_preferences" ON user_preferences
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "org_delete_user_preferences" ON user_preferences;
CREATE POLICY "user_delete_user_preferences" ON user_preferences
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- command_history: user can only access their own
DROP POLICY IF EXISTS "org_select_command_history" ON command_history;
CREATE POLICY "user_select_command_history" ON command_history
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "org_insert_command_history" ON command_history;
CREATE POLICY "user_insert_command_history" ON command_history
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "org_delete_command_history" ON command_history;
CREATE POLICY "user_delete_command_history" ON command_history
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ── 10. Updated_at triggers ──
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'icp_definitions', 'channel_configs', 'partner_programs',
    'user_preferences', 'saved_views'
  ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_%s_updated_at ON %I', tbl, tbl);
    EXECUTE format(
      'CREATE TRIGGER set_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at()',
      tbl, tbl
    );
  END LOOP;
END $$;

-- ── 11. Auto-set org_id triggers ──
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'icp_definitions', 'channel_configs', 'partner_programs',
    'saved_views', 'maturity_assessments'
  ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS auto_set_org_id ON %I', tbl);
    EXECUTE format(
      'CREATE TRIGGER auto_set_org_id BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION set_default_org_id()',
      tbl
    );
  END LOOP;
END $$;
