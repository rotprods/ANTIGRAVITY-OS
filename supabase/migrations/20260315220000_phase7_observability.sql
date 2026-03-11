-- ═══════════════════════════════════════════════════
-- OCULOPS v2 HARDCORE — Phase 7: Observability
-- Metrics, Alert Rules, Dashboards
-- ═══════════════════════════════════════════════════

-- ── 1. Metric Definitions ──
CREATE TABLE IF NOT EXISTS metric_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code_name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'business' CHECK (category IN ('business', 'operational', 'agent', 'financial', 'custom')),
  unit TEXT DEFAULT 'count',
  aggregation TEXT DEFAULT 'sum' CHECK (aggregation IN ('sum', 'avg', 'min', 'max', 'count', 'last')),
  source_query TEXT,
  threshold_warning NUMERIC,
  threshold_critical NUMERIC,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, code_name)
);
CREATE INDEX IF NOT EXISTS idx_metric_defs_org_id ON metric_definitions(org_id);
CREATE INDEX IF NOT EXISTS idx_metric_defs_category ON metric_definitions(category);

-- ── 2. Metric Values (time-series) ──
CREATE TABLE IF NOT EXISTS metric_values (
  id BIGSERIAL PRIMARY KEY,
  metric_id UUID NOT NULL REFERENCES metric_definitions(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  value NUMERIC NOT NULL,
  dimensions JSONB DEFAULT '{}',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_metric_values_metric_recorded ON metric_values(metric_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_metric_values_org_id ON metric_values(org_id);

-- ── 3. Alert Rules ──
CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  metric_id UUID REFERENCES metric_definitions(id) ON DELETE SET NULL,
  condition TEXT NOT NULL,
  threshold NUMERIC,
  window_minutes INT DEFAULT 60,
  severity TEXT DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  notification_channels JSONB DEFAULT '[]',
  cooldown_minutes INT DEFAULT 30,
  is_active BOOLEAN DEFAULT true,
  last_triggered TIMESTAMPTZ,
  trigger_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alert_rules_org_id ON alert_rules(org_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_metric_id ON alert_rules(metric_id);

-- ── 4. Dashboards Config ──
CREATE TABLE IF NOT EXISTS dashboards_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  is_shared BOOLEAN DEFAULT false,
  layout JSONB NOT NULL DEFAULT '[]',
  filters JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dashboards_org_id ON dashboards_config(org_id);
CREATE INDEX IF NOT EXISTS idx_dashboards_user_id ON dashboards_config(user_id);

-- ── 5. ALTERs to existing alerts table ──
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS rule_id UUID REFERENCES alert_rules(id) ON DELETE SET NULL;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS acknowledged_by UUID REFERENCES auth.users(id);
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;

-- ── 6. Enable RLS + Policies ──
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'metric_definitions', 'metric_values', 'alert_rules', 'dashboards_config'
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

-- ── 7. Updated_at triggers ──
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['metric_definitions', 'alert_rules', 'dashboards_config'])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_%s_updated_at ON %I', tbl, tbl);
    EXECUTE format(
      'CREATE TRIGGER set_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at()',
      tbl, tbl
    );
  END LOOP;
END $$;

-- ── 8. Auto-set org_id triggers ──
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'metric_definitions', 'metric_values', 'alert_rules', 'dashboards_config'
  ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS auto_set_org_id ON %I', tbl);
    EXECUTE format(
      'CREATE TRIGGER auto_set_org_id BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION set_default_org_id()',
      tbl
    );
  END LOOP;
END $$;
