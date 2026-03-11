-- ═══════════════════════════════════════════════════
-- OCULOPS v2 HARDCORE — Phase 2: Process & Pipeline
-- SOPs, Configurable Pipelines, Templates
-- ═══════════════════════════════════════════════════

-- ── 1. Pipeline Definitions ──
CREATE TABLE IF NOT EXISTS pipeline_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code_name TEXT NOT NULL,
  entity_type TEXT NOT NULL DEFAULT 'deal',
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, code_name)
);
CREATE INDEX IF NOT EXISTS idx_pipeline_defs_org_id ON pipeline_definitions(org_id);

-- ── 2. Pipeline Stages ──
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES pipeline_definitions(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code_name TEXT NOT NULL,
  position INT NOT NULL,
  color TEXT,
  is_terminal BOOLEAN DEFAULT false,
  terminal_type TEXT CHECK (terminal_type IN ('won', 'lost', 'completed', 'cancelled', NULL)),
  required_fields JSONB DEFAULT '[]',
  auto_actions JSONB DEFAULT '[]',
  sla_hours INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(pipeline_id, code_name)
);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_pipeline_id ON pipeline_stages(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_position ON pipeline_stages(pipeline_id, position);

-- ── 3. Pipeline Transitions ──
CREATE TABLE IF NOT EXISTS pipeline_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES pipeline_definitions(id) ON DELETE CASCADE,
  from_stage_id UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE CASCADE,
  to_stage_id UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE CASCADE,
  requires_approval BOOLEAN DEFAULT false,
  approval_role TEXT,
  conditions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(pipeline_id, from_stage_id, to_stage_id)
);

-- ── 4. Processes ──
CREATE TABLE IF NOT EXISTS processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code_name TEXT NOT NULL,
  category TEXT DEFAULT 'operational' CHECK (category IN ('operational', 'sales', 'support', 'onboarding', 'custom')),
  description TEXT,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'deprecated')),
  version TEXT DEFAULT '1.0',
  steps JSONB DEFAULT '[]',
  triggers JSONB DEFAULT '[]',
  sla_hours INT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, code_name)
);
CREATE INDEX IF NOT EXISTS idx_processes_org_id ON processes(org_id);
CREATE INDEX IF NOT EXISTS idx_processes_status ON processes(status);

-- ── 5. SOPs ──
CREATE TABLE IF NOT EXISTS sops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  process_id UUID REFERENCES processes(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT,
  category TEXT,
  version TEXT DEFAULT '1.0',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  attachments JSONB DEFAULT '[]',
  last_reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sops_org_id ON sops(org_id);
CREATE INDEX IF NOT EXISTS idx_sops_process_id ON sops(process_id);
CREATE INDEX IF NOT EXISTS idx_sops_status ON sops(status);

-- ── 6. Playbooks ──
CREATE TABLE IF NOT EXISTS playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'sales' CHECK (category IN ('sales', 'support', 'onboarding', 'crisis', 'custom')),
  description TEXT,
  steps JSONB DEFAULT '[]',
  trigger_conditions JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  success_criteria JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_playbooks_org_id ON playbooks(org_id);
CREATE INDEX IF NOT EXISTS idx_playbooks_category ON playbooks(category);

-- ── 7. Checklists ──
CREATE TABLE IF NOT EXISTS checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  template_id UUID,
  title TEXT NOT NULL,
  items JSONB DEFAULT '[]',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_checklists_org_id ON checklists(org_id);
CREATE INDEX IF NOT EXISTS idx_checklists_entity ON checklists(entity_type, entity_id);

-- ── 8. Templates Registry ──
CREATE TABLE IF NOT EXISTS templates_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  category TEXT,
  content JSONB NOT NULL,
  variables TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  usage_count INT DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_templates_org_id ON templates_registry(org_id);
CREATE INDEX IF NOT EXISTS idx_templates_type ON templates_registry(type);

-- ── 9. ALTERs to deals ──
ALTER TABLE deals ADD COLUMN IF NOT EXISTS pipeline_id UUID REFERENCES pipeline_definitions(id) ON DELETE SET NULL;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS stage_id UUID REFERENCES pipeline_stages(id) ON DELETE SET NULL;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS entered_stage_at TIMESTAMPTZ;

-- ── 10. Enable RLS ──
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'pipeline_definitions', 'pipeline_stages', 'pipeline_transitions',
    'processes', 'sops', 'playbooks', 'checklists', 'templates_registry'
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

-- ── 11. Updated_at triggers ──
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'pipeline_definitions', 'pipeline_stages', 'processes', 'sops',
    'playbooks', 'checklists', 'templates_registry'
  ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_%s_updated_at ON %I', tbl, tbl);
    EXECUTE format(
      'CREATE TRIGGER set_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at()',
      tbl, tbl
    );
  END LOOP;
END $$;

-- ── 12. Auto-set org_id triggers ──
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'pipeline_definitions', 'pipeline_stages', 'processes', 'sops',
    'playbooks', 'checklists', 'templates_registry'
  ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS auto_set_org_id ON %I', tbl);
    EXECUTE format(
      'CREATE TRIGGER auto_set_org_id BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION set_default_org_id()',
      tbl
    );
  END LOOP;
END $$;

-- ── 13. Realtime ──
ALTER PUBLICATION supabase_realtime ADD TABLE pipeline_definitions;
ALTER PUBLICATION supabase_realtime ADD TABLE pipeline_stages;
ALTER PUBLICATION supabase_realtime ADD TABLE checklists;
