-- ═══════════════════════════════════════════════════
-- OCULOPS v2 HARDCORE — Phase 6: Governance & Risk
-- Policies, Risk Cases, Guardrails, Kill Switches, Compliance
-- ═══════════════════════════════════════════════════

-- ── 1. Governance Policies ──
CREATE TABLE IF NOT EXISTS governance_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('data', 'agent', 'financial', 'compliance', 'operational', 'security')),
  description TEXT,
  rules JSONB NOT NULL DEFAULT '[]',
  enforcement TEXT DEFAULT 'advisory' CHECK (enforcement IN ('advisory', 'soft_block', 'hard_block')),
  applies_to TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  version TEXT DEFAULT '1.0',
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, code_name)
);
CREATE INDEX IF NOT EXISTS idx_governance_policies_org_id ON governance_policies(org_id);
CREATE INDEX IF NOT EXISTS idx_governance_policies_category ON governance_policies(category);

-- ── 2. Risk Cases ──
CREATE TABLE IF NOT EXISTS risk_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'operational' CHECK (category IN ('operational', 'financial', 'compliance', 'reputational', 'security', 'agent')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  probability TEXT DEFAULT 'medium' CHECK (probability IN ('rare', 'unlikely', 'possible', 'likely', 'certain')),
  impact_score INT CHECK (impact_score BETWEEN 0 AND 100),
  status TEXT DEFAULT 'identified' CHECK (status IN ('identified', 'assessed', 'mitigating', 'accepted', 'resolved', 'closed')),
  mitigation_plan TEXT,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  source_agent TEXT,
  incident_id UUID REFERENCES incidents(id) ON DELETE SET NULL,
  due_date DATE,
  resolved_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_risk_cases_org_id ON risk_cases(org_id);
CREATE INDEX IF NOT EXISTS idx_risk_cases_severity ON risk_cases(severity);
CREATE INDEX IF NOT EXISTS idx_risk_cases_status ON risk_cases(status);

-- ── 3. Guardrails ──
CREATE TABLE IF NOT EXISTS guardrails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('rate_limit', 'budget_limit', 'content_filter', 'approval_required', 'scope_restriction')),
  config JSONB NOT NULL,
  applies_to TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  violation_count INT DEFAULT 0,
  last_triggered TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, code_name)
);
CREATE INDEX IF NOT EXISTS idx_guardrails_org_id ON guardrails(org_id);
CREATE INDEX IF NOT EXISTS idx_guardrails_type ON guardrails(type);

-- ── 4. Kill Switches ──
CREATE TABLE IF NOT EXISTS kill_switches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('agent', 'automation', 'integration', 'all')),
  target_id TEXT,
  is_active BOOLEAN DEFAULT false,
  reason TEXT,
  activated_by UUID REFERENCES auth.users(id),
  activated_at TIMESTAMPTZ,
  deactivated_at TIMESTAMPTZ,
  auto_reactivate_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kill_switches_org_id ON kill_switches(org_id);
CREATE INDEX IF NOT EXISTS idx_kill_switches_target ON kill_switches(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_kill_switches_active ON kill_switches(is_active) WHERE is_active = true;

-- ── 5. Escalation Rules ──
CREATE TABLE IF NOT EXISTS escalation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('incident', 'approval_timeout', 'budget_exceeded', 'sla_breach', 'custom')),
  trigger_config JSONB NOT NULL,
  escalation_chain JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_escalation_rules_org_id ON escalation_rules(org_id);

-- ── 6. Consent Records ──
CREATE TABLE IF NOT EXISTS consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('marketing_email', 'data_processing', 'cookie', 'terms', 'privacy', 'third_party')),
  granted BOOLEAN NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  source TEXT,
  version TEXT DEFAULT '1.0',
  granted_at TIMESTAMPTZ DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_consent_records_org_id ON consent_records(org_id);
CREATE INDEX IF NOT EXISTS idx_consent_records_contact_id ON consent_records(contact_id);
CREATE INDEX IF NOT EXISTS idx_consent_records_type ON consent_records(consent_type);

-- ── 7. Data Retention Policies ──
CREATE TABLE IF NOT EXISTS data_retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  retention_days INT NOT NULL,
  archive_before_delete BOOLEAN DEFAULT true,
  condition TEXT,
  last_purge_at TIMESTAMPTZ,
  purged_count INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, table_name)
);

-- ── 8. Compliance Checks ──
CREATE TABLE IF NOT EXISTS compliance_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  check_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'passed', 'failed', 'warning')),
  results JSONB DEFAULT '{}',
  score INT CHECK (score BETWEEN 0 AND 100),
  run_by TEXT,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_compliance_checks_org_id ON compliance_checks(org_id);
CREATE INDEX IF NOT EXISTS idx_compliance_checks_status ON compliance_checks(status);

-- ── 9. Enable RLS + Policies ──
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'governance_policies', 'risk_cases', 'guardrails', 'kill_switches',
    'escalation_rules', 'consent_records', 'data_retention_policies', 'compliance_checks'
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

-- ── 10. Updated_at triggers ──
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'governance_policies', 'risk_cases', 'guardrails', 'kill_switches',
    'escalation_rules', 'data_retention_policies'
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
    'governance_policies', 'risk_cases', 'guardrails', 'kill_switches',
    'escalation_rules', 'consent_records', 'data_retention_policies', 'compliance_checks'
  ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS auto_set_org_id ON %I', tbl);
    EXECUTE format(
      'CREATE TRIGGER auto_set_org_id BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION set_default_org_id()',
      tbl
    );
  END LOOP;
END $$;

-- ── 12. Realtime ──
ALTER PUBLICATION supabase_realtime ADD TABLE kill_switches;
ALTER PUBLICATION supabase_realtime ADD TABLE risk_cases;
