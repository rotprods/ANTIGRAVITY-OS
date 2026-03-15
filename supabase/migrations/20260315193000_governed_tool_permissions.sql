-- Seed missing governed tool definitions needed by the product UI reroutes.

INSERT INTO public.tool_registry (
  org_id,
  name,
  code_name,
  category,
  description,
  endpoint_url,
  provider,
  invocation_type,
  risk_level,
  requires_approval,
  default_config,
  metadata
)
SELECT
  NULL,
  seed.name,
  seed.code_name,
  seed.category,
  seed.description,
  seed.endpoint_url,
  seed.provider,
  seed.invocation_type,
  seed.risk_level,
  seed.requires_approval,
  seed.default_config,
  seed.metadata
FROM (
  VALUES
    ('API Proxy', 'api-proxy', 'integration', 'Governed execution path for connector calls.', 'supabase://functions/api-proxy', 'supabase', 'edge_function', 2, false, '{}'::jsonb, '{"managed_by":"system"}'::jsonb),
    ('Agent Runner', 'agent-runner', 'orchestration', 'Governed execution path for vault-backed agent runs.', 'supabase://functions/agent-runner', 'supabase', 'edge_function', 2, false, '{}'::jsonb, '{"managed_by":"system"}'::jsonb)
) AS seed(name, code_name, category, description, endpoint_url, provider, invocation_type, risk_level, requires_approval, default_config, metadata)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.tool_registry existing
  WHERE existing.org_id IS NULL
    AND existing.code_name = seed.code_name
);

INSERT INTO public.agent_tool_permissions (
  org_id,
  agent_code_name,
  tool_code_name,
  permission_level,
  max_calls_per_run,
  metadata
)
SELECT NULL, seed.agent_code_name, seed.tool_code_name, seed.permission_level, seed.max_calls_per_run, seed.metadata
FROM (
  VALUES
    ('copilot', 'api-proxy', 'allow', 25, '{"managed_by":"system"}'::jsonb),
    ('cortex', 'api-proxy', 'allow', 25, '{"managed_by":"system"}'::jsonb),
    ('outreach', 'api-proxy', 'allow', 25, '{"managed_by":"system"}'::jsonb),
    ('copilot', 'agent-runner', 'allow', 10, '{"managed_by":"system"}'::jsonb),
    ('nexus', 'agent-runner', 'allow', 10, '{"managed_by":"system"}'::jsonb)
) AS seed(agent_code_name, tool_code_name, permission_level, max_calls_per_run, metadata)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.agent_tool_permissions existing
  WHERE existing.org_id IS NULL
    AND existing.agent_code_name = seed.agent_code_name
    AND existing.tool_code_name = seed.tool_code_name
);
