-- OCULOPS AG2-C3 baseline hardening
-- Seed default governance policies and guardrails for all organizations.

-- 1) Guardrail: approval required for medium/high/critical risk flows
INSERT INTO public.guardrails (
  org_id,
  name,
  code_name,
  type,
  config,
  applies_to,
  is_active
)
SELECT
  o.id,
  'Approval Gate for High Risk Runs',
  'approval-high-risk',
  'approval_required',
  jsonb_build_object('risk_threshold', 'medium'),
  ARRAY['goal', 'pipeline', 'pipeline_step'],
  true
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1
  FROM public.guardrails g
  WHERE g.org_id = o.id
    AND g.code_name = 'approval-high-risk'
);

-- 2) Guardrail: rate limit orchestration pressure
INSERT INTO public.guardrails (
  org_id,
  name,
  code_name,
  type,
  config,
  applies_to,
  is_active
)
SELECT
  o.id,
  'Pipeline Run Rate Limit',
  'pipeline-rate-limit',
  'rate_limit',
  jsonb_build_object('max_runs_per_hour', 30, 'max_runs_per_window', 30),
  ARRAY['pipeline'],
  true
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1
  FROM public.guardrails g
  WHERE g.org_id = o.id
    AND g.code_name = 'pipeline-rate-limit'
);

-- 3) Guardrail: budget-like complexity cap per run
INSERT INTO public.guardrails (
  org_id,
  name,
  code_name,
  type,
  config,
  applies_to,
  is_active
)
SELECT
  o.id,
  'Run Complexity Limit',
  'run-complexity-limit',
  'budget_limit',
  jsonb_build_object('max_steps_per_run', 12),
  ARRAY['goal', 'pipeline'],
  true
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1
  FROM public.guardrails g
  WHERE g.org_id = o.id
    AND g.code_name = 'run-complexity-limit'
);

-- 4) Policy: require approval for medium+ risk
INSERT INTO public.governance_policies (
  org_id,
  name,
  code_name,
  category,
  description,
  rules,
  enforcement,
  applies_to,
  is_active,
  version
)
SELECT
  o.id,
  'Require Approval Above Medium Risk',
  'require-approval-above-medium',
  'agent',
  'Governance policy that blocks high-impact execution without explicit approval signal.',
  jsonb_build_array(
    jsonb_build_object(
      'kind', 'require_approval_above',
      'value', 'medium'
    )
  ),
  'soft_block',
  ARRAY['goal', 'pipeline', 'pipeline_step'],
  true,
  '1.0'
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1
  FROM public.governance_policies p
  WHERE p.org_id = o.id
    AND p.code_name = 'require-approval-above-medium'
);

-- 5) Escalation route: governance/approval timeout & budget exceeded
INSERT INTO public.escalation_rules (
  org_id,
  name,
  trigger_type,
  trigger_config,
  escalation_chain,
  is_active
)
SELECT
  o.id,
  'Governance Escalation Chain',
  'approval_timeout',
  jsonb_build_object('max_wait_minutes', 30),
  jsonb_build_array(
    jsonb_build_object('role', 'operator', 'channel', 'inbox'),
    jsonb_build_object('role', 'owner', 'channel', 'dashboard')
  ),
  true
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1
  FROM public.escalation_rules e
  WHERE e.org_id = o.id
    AND e.name = 'Governance Escalation Chain'
);
