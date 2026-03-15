import { describe, expect, it } from 'vitest'
import {
  buildDeterministicVariableResolution,
  evaluateVariableConstraints,
} from '../../supabase/functions/_shared/variable-runtime-v2.ts'

describe('variable-runtime-v2', () => {
  it('resolves variables with fixed precedence deterministically', async () => {
    const definitions = [
      {
        variable_key: 'budget_limit',
        default_value: 100,
        validation_rules: { required: true },
        updated_at: '2026-03-14T10:00:00.000Z',
      },
      {
        variable_key: 'channel',
        default_value: 'email',
        validation_rules: { required: true },
        updated_at: '2026-03-14T10:00:00.000Z',
      },
    ]
    const bindings = [
      {
        variable_key: 'budget_limit',
        precedence_level: 'org',
        source_ref: 'org-default',
        value: 90,
        effective_from: null,
        effective_to: null,
        updated_at: '2026-03-14T10:00:00.000Z',
      },
      {
        variable_key: 'budget_limit',
        precedence_level: 'workflow',
        source_ref: 'wf-1',
        value: 70,
        effective_from: null,
        effective_to: null,
        updated_at: '2026-03-14T11:00:00.000Z',
      },
      {
        variable_key: 'channel',
        precedence_level: 'agent',
        source_ref: 'atlas',
        value: 'whatsapp',
        effective_from: null,
        effective_to: null,
        updated_at: '2026-03-14T11:00:00.000Z',
      },
    ]

    const result = await buildDeterministicVariableResolution({
      definitions,
      bindings,
      runtimeOverrides: { budget_limit: 55 },
      workflowId: 'wf-1',
      agentId: 'atlas',
      nowIso: '2026-03-14T12:00:00.000Z',
    })

    expect(result.value_map.budget_limit).toBe(55)
    expect(result.value_map.channel).toBe('whatsapp')
    expect(result.diagnostics.missing_required_keys).toEqual([])
    expect(result.bindings.map((binding) => binding.variable_key)).toEqual(['budget_limit', 'channel'])
  })

  it('produces stable checksums with different input order', async () => {
    const definitions = [
      {
        variable_key: 'alpha',
        default_value: 1,
        validation_rules: {},
        updated_at: '2026-03-14T10:00:00.000Z',
      },
      {
        variable_key: 'beta',
        default_value: 2,
        validation_rules: {},
        updated_at: '2026-03-14T10:00:00.000Z',
      },
    ]
    const bindingsA = [
      {
        variable_key: 'beta',
        precedence_level: 'org',
        source_ref: 'org',
        value: 99,
        effective_from: null,
        effective_to: null,
        updated_at: '2026-03-14T11:00:00.000Z',
      },
      {
        variable_key: 'alpha',
        precedence_level: 'org',
        source_ref: 'org',
        value: 88,
        effective_from: null,
        effective_to: null,
        updated_at: '2026-03-14T11:00:00.000Z',
      },
    ]
    const bindingsB = [...bindingsA].reverse()

    const a = await buildDeterministicVariableResolution({
      definitions,
      bindings: bindingsA,
      nowIso: '2026-03-14T12:00:00.000Z',
    })
    const b = await buildDeterministicVariableResolution({
      definitions,
      bindings: bindingsB,
      nowIso: '2026-03-14T12:00:00.000Z',
    })

    expect(a.checksum).toBe(b.checksum)
    expect(a.bindings).toEqual(b.bindings)
  })

  it('applies tie-break rules for same precedence bindings', async () => {
    const definitions = [
      {
        variable_key: 'threshold',
        default_value: 10,
        validation_rules: {},
        updated_at: '2026-03-14T10:00:00.000Z',
      },
    ]
    const bindings = [
      {
        variable_key: 'threshold',
        precedence_level: 'org',
        source_ref: 'z-source',
        value: 20,
        effective_from: null,
        effective_to: null,
        updated_at: '2026-03-14T10:00:00.000Z',
      },
      {
        variable_key: 'threshold',
        precedence_level: 'org',
        source_ref: 'a-source',
        value: 15,
        effective_from: null,
        effective_to: null,
        updated_at: '2026-03-14T10:00:00.000Z',
      },
    ]

    const result = await buildDeterministicVariableResolution({
      definitions,
      bindings,
      nowIso: '2026-03-14T12:00:00.000Z',
    })

    expect(result.value_map.threshold).toBe(15)
    expect(result.diagnostics.conflict_keys).toEqual(['threshold'])
    expect(result.diagnostics.tie_break_count).toBeGreaterThan(0)
  })

  it('does not flag precedence layering as a conflict', async () => {
    const definitions = [
      {
        variable_key: 'mode',
        default_value: 'shadow',
        validation_rules: {},
        updated_at: '2026-03-14T10:00:00.000Z',
      },
    ]
    const bindings = [
      {
        variable_key: 'mode',
        precedence_level: 'org',
        source_ref: 'org-default',
        value: 'dry_run',
        effective_from: null,
        effective_to: null,
        updated_at: '2026-03-14T11:00:00.000Z',
      },
    ]

    const result = await buildDeterministicVariableResolution({
      definitions,
      bindings,
      nowIso: '2026-03-14T12:00:00.000Z',
    })

    expect(result.value_map.mode).toBe('dry_run')
    expect(result.diagnostics.conflict_keys).toEqual([])
    expect(result.diagnostics.tie_break_count).toBe(0)
  })

  it('does not flag default-plus-global-binding overlap as conflict', async () => {
    const definitions = [
      {
        variable_key: 'budget',
        default_value: 25,
        validation_rules: {},
        updated_at: '2026-03-14T10:00:00.000Z',
      },
    ]
    const bindings = [
      {
        variable_key: 'budget',
        precedence_level: 'global',
        source_ref: 'bootstrap',
        value: 20,
        effective_from: null,
        effective_to: null,
        updated_at: '2026-03-14T11:00:00.000Z',
      },
    ]

    const result = await buildDeterministicVariableResolution({
      definitions,
      bindings,
      nowIso: '2026-03-14T12:00:00.000Z',
    })

    expect(result.value_map.budget).toBe(20)
    expect(result.diagnostics.conflict_keys).toEqual([])
    expect(result.diagnostics.tie_break_count).toBe(0)
  })

  it('selects scoped definitions deterministically by workflow and scope precedence', async () => {
    const definitions = [
      {
        variable_key: 'mode',
        scope: 'global',
        owner_ref: 'platform',
        default_value: 'shadow',
        validation_rules: { required: true },
        updated_at: '2026-03-14T09:00:00.000Z',
      },
      {
        variable_key: 'mode',
        scope: 'org',
        owner_ref: 'org-default',
        default_value: 'dry_run',
        validation_rules: { required: true },
        updated_at: '2026-03-14T10:00:00.000Z',
      },
      {
        variable_key: 'mode',
        scope: 'workflow',
        owner_ref: 'wf-main',
        default_value: 'replay',
        validation_rules: { required: true },
        updated_at: '2026-03-14T11:00:00.000Z',
      },
    ]

    const workflowScoped = await buildDeterministicVariableResolution({
      definitions,
      bindings: [],
      workflowId: 'wf-main',
      nowIso: '2026-03-14T12:00:00.000Z',
    })
    expect(workflowScoped.value_map.mode).toBe('replay')
    expect(workflowScoped.bindings[0].precedence_level).toBe('workflow')

    const fallbackScoped = await buildDeterministicVariableResolution({
      definitions,
      bindings: [],
      workflowId: 'wf-other',
      nowIso: '2026-03-14T12:00:00.000Z',
    })
    expect(fallbackScoped.value_map.mode).toBe('dry_run')
    expect(fallbackScoped.bindings[0].precedence_level).toBe('org')
  })

  it('evaluates constraint severity and blocking behavior', () => {
    const constraints = [
      {
        constraint_id: 'required_channel',
        expression: { type: 'required', variable_key: 'channel' },
        severity: 'critical',
        fail_mode: 'hard_block',
      },
      {
        constraint_id: 'budget_limit',
        expression: { type: 'budget_max', limit: 50 },
        severity: 'medium',
        fail_mode: 'advisory',
      },
    ]

    const evaluation = evaluateVariableConstraints({
      constraints,
      values: { estimated_cost: 75 },
      executionContext: { estimated_cost: 75 },
    })

    expect(evaluation.violations.length).toBe(2)
    expect(evaluation.blocking_count).toBe(1)
    expect(evaluation.constraint_status).toBe('failed_blocking')
  })
})
