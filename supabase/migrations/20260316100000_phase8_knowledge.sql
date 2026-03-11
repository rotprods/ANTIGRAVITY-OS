-- ═══════════════════════════════════════════════════
-- OCULOPS v2 HARDCORE — Phase 8: Knowledge
-- Categories, Learning Records, Playbook Entries
-- ═══════════════════════════════════════════════════

-- ── 1. Knowledge Categories ──
CREATE TABLE IF NOT EXISTS knowledge_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  parent_id UUID REFERENCES knowledge_categories(id) ON DELETE CASCADE,
  description TEXT,
  icon TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_knowledge_categories_org_id ON knowledge_categories(org_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_categories_parent_id ON knowledge_categories(parent_id);

-- ── 2. Learning Records ──
CREATE TABLE IF NOT EXISTS learning_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent TEXT NOT NULL,
  learning_type TEXT NOT NULL CHECK (learning_type IN ('feedback', 'correction', 'pattern', 'preference', 'rule')),
  subject TEXT NOT NULL,
  description TEXT,
  source_entity_type TEXT,
  source_entity_id UUID,
  confidence FLOAT DEFAULT 0.8 CHECK (confidence BETWEEN 0 AND 1),
  applied_count INT DEFAULT 0,
  last_applied_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_learning_records_org_id ON learning_records(org_id);
CREATE INDEX IF NOT EXISTS idx_learning_records_agent ON learning_records(agent);
CREATE INDEX IF NOT EXISTS idx_learning_records_type ON learning_records(learning_type);

-- ── 3. Playbook Entries ──
CREATE TABLE IF NOT EXISTS playbook_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id UUID NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  step_number INT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  action_type TEXT CHECK (action_type IN ('manual', 'automated', 'decision', 'checkpoint')),
  automation_ref TEXT,
  conditions JSONB DEFAULT '{}',
  expected_duration_minutes INT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(playbook_id, step_number)
);
CREATE INDEX IF NOT EXISTS idx_playbook_entries_playbook_id ON playbook_entries(playbook_id);

-- ── 4. ALTERs to knowledge_entries ──
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES knowledge_categories(id) ON DELETE SET NULL;
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS access_level TEXT DEFAULT 'org' CHECK (access_level IN ('private', 'team', 'org', 'public'));
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES knowledge_entries(id) ON DELETE SET NULL;

-- ── 5. Enable RLS + Policies ──
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'knowledge_categories', 'learning_records', 'playbook_entries'
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

-- ── 6. Updated_at triggers ──
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['knowledge_categories', 'learning_records', 'playbook_entries'])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_%s_updated_at ON %I', tbl, tbl);
    EXECUTE format(
      'CREATE TRIGGER set_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at()',
      tbl, tbl
    );
  END LOOP;
END $$;

-- ── 7. Auto-set org_id triggers ──
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['knowledge_categories', 'learning_records', 'playbook_entries'])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS auto_set_org_id ON %I', tbl);
    EXECUTE format(
      'CREATE TRIGGER auto_set_org_id BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION set_default_org_id()',
      tbl
    );
  END LOOP;
END $$;
