-- ═══════════════════════════════════════════════════
-- OCULOPS v2 HARDCORE — Phase 3: Intelligence
-- Insights, Hypotheses, Recommendations, Actions Log
-- ═══════════════════════════════════════════════════

-- ── 1. Insights ──
CREATE TABLE IF NOT EXISTS insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general',
  source_agent TEXT,
  source_data JSONB DEFAULT '{}',
  confidence FLOAT CHECK (confidence BETWEEN 0 AND 1),
  impact_score INT CHECK (impact_score BETWEEN 0 AND 100),
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'actioned', 'dismissed', 'archived')),
  actioned_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_insights_org_id ON insights(org_id);
CREATE INDEX IF NOT EXISTS idx_insights_status ON insights(status);
CREATE INDEX IF NOT EXISTS idx_insights_category ON insights(category);
CREATE INDEX IF NOT EXISTS idx_insights_created ON insights(created_at DESC);

-- ── 2. Hypotheses ──
CREATE TABLE IF NOT EXISTS hypotheses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  statement TEXT NOT NULL,
  category TEXT DEFAULT 'growth',
  status TEXT DEFAULT 'proposed' CHECK (status IN ('proposed', 'testing', 'validated', 'invalidated', 'archived')),
  confidence FLOAT DEFAULT 0.5 CHECK (confidence BETWEEN 0 AND 1),
  evidence_for JSONB DEFAULT '[]',
  evidence_against JSONB DEFAULT '[]',
  experiment_id UUID REFERENCES experiments(id) ON DELETE SET NULL,
  insight_id UUID REFERENCES insights(id) ON DELETE SET NULL,
  proposed_by TEXT,
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hypotheses_org_id ON hypotheses(org_id);
CREATE INDEX IF NOT EXISTS idx_hypotheses_status ON hypotheses(status);

-- ── 3. Recommendations ──
CREATE TABLE IF NOT EXISTS recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'action',
  source_agent TEXT,
  insight_id UUID REFERENCES insights(id) ON DELETE SET NULL,
  hypothesis_id UUID REFERENCES hypotheses(id) ON DELETE SET NULL,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  expected_impact TEXT,
  estimated_roi NUMERIC,
  effort_estimate TEXT CHECK (effort_estimate IN ('trivial', 'small', 'medium', 'large', 'epic')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'in_progress', 'completed', 'expired')),
  accepted_by UUID REFERENCES auth.users(id),
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  due_date DATE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recommendations_org_id ON recommendations(org_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_status ON recommendations(status);
CREATE INDEX IF NOT EXISTS idx_recommendations_priority ON recommendations(priority);

-- ── 4. Actions Log ──
CREATE TABLE IF NOT EXISTS actions_log (
  id BIGSERIAL PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('agent', 'user', 'system', 'cron')),
  actor_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  description TEXT,
  input JSONB DEFAULT '{}',
  output JSONB DEFAULT '{}',
  recommendation_id UUID REFERENCES recommendations(id) ON DELETE SET NULL,
  trace_id UUID REFERENCES reasoning_traces(id) ON DELETE SET NULL,
  duration_ms INT,
  status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'failed', 'partial')),
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_actions_log_org_id ON actions_log(org_id);
CREATE INDEX IF NOT EXISTS idx_actions_log_actor ON actions_log(actor_type, actor_id);
CREATE INDEX IF NOT EXISTS idx_actions_log_entity ON actions_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_actions_log_created ON actions_log(created_at DESC);

-- ── 5. ALTERs to existing tables ──
ALTER TABLE signals ADD COLUMN IF NOT EXISTS insight_id UUID REFERENCES insights(id) ON DELETE SET NULL;
ALTER TABLE signals ADD COLUMN IF NOT EXISTS urgency TEXT DEFAULT 'medium';
ALTER TABLE signals ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

ALTER TABLE experiments ADD COLUMN IF NOT EXISTS hypothesis_id UUID REFERENCES hypotheses(id) ON DELETE SET NULL;
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS insight_ids UUID[] DEFAULT '{}';

-- ── 6. Enable RLS + Policies ──
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'insights', 'hypotheses', 'recommendations', 'actions_log'
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
  FOR tbl IN SELECT unnest(ARRAY['insights', 'hypotheses', 'recommendations'])
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
  FOR tbl IN SELECT unnest(ARRAY['insights', 'hypotheses', 'recommendations', 'actions_log'])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS auto_set_org_id ON %I', tbl);
    EXECUTE format(
      'CREATE TRIGGER auto_set_org_id BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION set_default_org_id()',
      tbl
    );
  END LOOP;
END $$;

-- ── 9. Realtime ──
ALTER PUBLICATION supabase_realtime ADD TABLE insights;
ALTER PUBLICATION supabase_realtime ADD TABLE recommendations;
