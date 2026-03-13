-- OCULOPS INT-2 Demo Workflow Pack (provider-independent)
-- Adds deterministic workflow templates to validate:
-- 1) bug -> patch -> test -> review
-- 2) feature -> implement -> evaluate
-- 3) campaign -> execute -> score -> improve

-- 1) Insert system templates if missing
INSERT INTO public.pipeline_templates (
  org_id,
  name,
  code_name,
  pipeline_type,
  description,
  goal_prompt,
  default_context,
  success_criteria,
  retry_policy,
  is_active,
  is_system
)
SELECT
  NULL::uuid,
  t.name,
  t.code_name,
  t.pipeline_type,
  t.description,
  t.goal_prompt,
  t.default_context::jsonb,
  t.success_criteria::jsonb,
  t.retry_policy::jsonb,
  TRUE,
  TRUE
FROM (
  VALUES
    (
      'Self Improvement Patch Cycle',
      'self_improvement_patch_cycle',
      'engineering',
      'INT-2.1 deterministic workflow for issue -> patch -> test -> review.',
      'Resolve a runtime issue with controlled patch cycle.',
      '{"risk_class":"low","target_environment":"staging","int2_workflow":"INT-2.1"}',
      '{"completion":"all_steps_completed","artifact":"patch_cycle_report"}',
      '{"mode":"step","max_attempts":1}'
    ),
    (
      'Feature Delivery Evaluation Cycle',
      'feature_delivery_eval_cycle',
      'product',
      'INT-2.2 deterministic workflow for feature -> implement -> evaluate.',
      'Deliver a scoped feature increment and evaluate output quality.',
      '{"risk_class":"low","target_environment":"staging","int2_workflow":"INT-2.2"}',
      '{"completion":"all_steps_completed","artifact":"feature_eval_report"}',
      '{"mode":"step","max_attempts":1}'
    ),
    (
      'Campaign Execution Improvement Cycle',
      'campaign_execution_improvement_cycle',
      'growth',
      'INT-2.3 deterministic workflow for campaign -> execute -> score -> improve.',
      'Run a campaign loop and propose improvement actions.',
      '{"risk_class":"low","target_environment":"staging","int2_workflow":"INT-2.3"}',
      '{"completion":"all_steps_completed","artifact":"campaign_improvement_report"}',
      '{"mode":"step","max_attempts":1}'
    )
) AS t(name, code_name, pipeline_type, description, goal_prompt, default_context, success_criteria, retry_policy)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.pipeline_templates p
  WHERE p.org_id IS NULL
    AND p.code_name = t.code_name
);

-- 2) Insert template steps if missing
WITH template_catalog AS (
  SELECT id AS template_id, code_name
  FROM public.pipeline_templates
  WHERE org_id IS NULL
    AND code_name IN (
      'self_improvement_patch_cycle',
      'feature_delivery_eval_cycle',
      'campaign_execution_improvement_cycle'
    )
),
step_catalog AS (
  SELECT *
  FROM (
    VALUES
      -- INT-2.1 bug -> patch -> test -> review
      ('self_improvement_patch_cycle', 1, 'detect_issue', 'event', NULL, 'issue.detect', 'int2.issue.detected', '{"phase":"detect"}'),
      ('self_improvement_patch_cycle', 2, 'generate_patch', 'task', NULL, 'patch.generate', NULL, '{"phase":"patch"}'),
      ('self_improvement_patch_cycle', 3, 'run_tests', 'task', NULL, 'tests.run', NULL, '{"phase":"test"}'),
      ('self_improvement_patch_cycle', 4, 'review_patch', 'event', NULL, 'review.run', 'int2.patch.reviewed', '{"phase":"review"}'),

      -- INT-2.2 feature -> implement -> evaluate
      ('feature_delivery_eval_cycle', 1, 'scope_feature', 'task', NULL, 'feature.scope', NULL, '{"phase":"scope"}'),
      ('feature_delivery_eval_cycle', 2, 'implement_feature', 'task', NULL, 'feature.implement', NULL, '{"phase":"implement"}'),
      ('feature_delivery_eval_cycle', 3, 'evaluate_feature', 'event', NULL, 'feature.evaluate', 'int2.feature.evaluated', '{"phase":"evaluate"}'),

      -- INT-2.3 campaign -> execute -> score -> improve
      ('campaign_execution_improvement_cycle', 1, 'plan_campaign', 'task', NULL, 'campaign.plan', NULL, '{"phase":"plan"}'),
      ('campaign_execution_improvement_cycle', 2, 'execute_campaign', 'task', NULL, 'campaign.execute', NULL, '{"phase":"execute"}'),
      ('campaign_execution_improvement_cycle', 3, 'score_campaign', 'event', NULL, 'campaign.score', 'int2.campaign.scored', '{"phase":"score"}'),
      ('campaign_execution_improvement_cycle', 4, 'propose_improvement', 'event', NULL, 'campaign.improve', 'int2.campaign.improvement_proposed', '{"phase":"improve"}')
  ) AS s(template_code_name, step_number, step_key, step_type, agent_code_name, action, emits_event, metadata)
)
INSERT INTO public.pipeline_template_steps (
  template_id,
  org_id,
  step_number,
  step_key,
  step_type,
  agent_code_name,
  action,
  input_mapping,
  emits_event,
  success_condition,
  retry_limit,
  timeout_ms,
  is_blocking,
  metadata
)
SELECT
  t.template_id,
  NULL::uuid,
  s.step_number,
  s.step_key,
  s.step_type,
  s.agent_code_name,
  s.action,
  '{}'::jsonb,
  s.emits_event,
  '{"expect":"step_completed"}'::jsonb,
  1,
  30000,
  TRUE,
  s.metadata::jsonb
FROM step_catalog s
JOIN template_catalog t
  ON t.code_name = s.template_code_name
WHERE NOT EXISTS (
  SELECT 1
  FROM public.pipeline_template_steps pts
  WHERE pts.template_id = t.template_id
    AND pts.step_number = s.step_number
);
