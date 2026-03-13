-- ═══════════════════════════════════════════════════
-- OCULOPS OS — n8n Template Catalog
-- Full template index (actions + skills metadata)
-- ═══════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS n8n_template_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url TEXT NOT NULL,
  entry_count INTEGER DEFAULT 0,
  installable_count INTEGER DEFAULT 0,
  install_ready_count INTEGER DEFAULT 0,
  priority_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running',
  error TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS n8n_template_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id BIGINT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  author_username TEXT,
  author_verified BOOLEAN DEFAULT false,
  total_views INTEGER DEFAULT 0,
  recent_views INTEGER DEFAULT 0,
  price TEXT,
  purchase_url TEXT,
  ready_to_demo BOOLEAN DEFAULT false,
  page_url TEXT NOT NULL,
  api_url TEXT NOT NULL,
  node_types TEXT[] DEFAULT ARRAY[]::TEXT[],
  action_keys TEXT[] DEFAULT ARRAY[]::TEXT[],
  skill_tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  module_targets TEXT[] DEFAULT ARRAY[]::TEXT[],
  agent_targets TEXT[] DEFAULT ARRAY[]::TEXT[],
  install_tier TEXT NOT NULL DEFAULT 'catalog_only',
  is_installable BOOLEAN DEFAULT false,
  raw_source JSONB DEFAULT '{}'::JSONB,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  is_listed BOOLEAN DEFAULT true,
  sync_run_id UUID REFERENCES n8n_template_sync_runs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_n8n_template_entries_install_tier ON n8n_template_entries(install_tier);
CREATE INDEX IF NOT EXISTS idx_n8n_template_entries_recent_views ON n8n_template_entries(recent_views DESC);
CREATE INDEX IF NOT EXISTS idx_n8n_template_entries_total_views ON n8n_template_entries(total_views DESC);
CREATE INDEX IF NOT EXISTS idx_n8n_template_entries_module_targets ON n8n_template_entries USING GIN(module_targets);
CREATE INDEX IF NOT EXISTS idx_n8n_template_entries_agent_targets ON n8n_template_entries USING GIN(agent_targets);
CREATE INDEX IF NOT EXISTS idx_n8n_template_entries_action_keys ON n8n_template_entries USING GIN(action_keys);
CREATE INDEX IF NOT EXISTS idx_n8n_template_entries_skill_tags ON n8n_template_entries USING GIN(skill_tags);

ALTER TABLE n8n_template_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE n8n_template_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "personal_open" ON n8n_template_sync_runs;
DROP POLICY IF EXISTS "personal_open" ON n8n_template_entries;

CREATE POLICY "personal_open" ON n8n_template_sync_runs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "personal_open" ON n8n_template_entries FOR ALL USING (true) WITH CHECK (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_n8n_template_entries_updated_at'
  ) THEN
    CREATE TRIGGER update_n8n_template_entries_updated_at
      BEFORE UPDATE ON n8n_template_entries
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'n8n_template_sync_runs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE n8n_template_sync_runs;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'n8n_template_entries'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE n8n_template_entries;
  END IF;
END $$;
