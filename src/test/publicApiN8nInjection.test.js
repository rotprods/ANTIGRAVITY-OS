import { describe, it, expect } from 'vitest'
import { buildN8nApiTriggerPack } from '../lib/publicApiN8nInjection'

describe('publicApiN8nInjection', () => {
  it('builds event packs from ecosystem entries and registration backlog', () => {
    const layer = {
      source: 'test',
      entries: [
        {
          slug: 'geo-open',
          name: 'Geo Open',
          category: 'Geocoding',
          docs_url: 'https://example.com/geo',
          auth_type: 'none',
          activation_tier: 'candidate',
          business_fit_score: 70,
          module_targets: ['prospector'],
          agent_targets: ['atlas'],
          bridge_profile: { bridge_mode: 'docs_only', executable_now: false },
          ecosystem_profile: {
            integration_priority: 78,
            module_targets: ['prospector'],
            agent_targets: ['atlas'],
            auto_import_eligible: true,
            command_bindings: ['run_api'],
            automation_actions: ['run_api', 'run_agent'],
            n8n_patterns: ['n8n_http_request_geocode'],
          },
        },
        {
          slug: 'macro-live',
          name: 'Macro Live',
          category: 'Finance',
          docs_url: 'https://example.com/macro',
          auth_type: 'none',
          activation_tier: 'live',
          business_fit_score: 88,
          module_targets: ['finance', 'world_monitor'],
          agent_targets: ['strategist', 'cortex'],
          bridge_profile: { bridge_mode: 'connector_proxy', executable_now: true },
          ecosystem_profile: {
            integration_priority: 92,
            module_targets: ['finance', 'world_monitor'],
            agent_targets: ['strategist', 'cortex'],
            auto_import_eligible: true,
            command_bindings: ['run_connector'],
            automation_actions: ['run_connector', 'run_agent'],
            n8n_patterns: ['n8n_macro_snapshot_pipeline'],
          },
        },
      ],
      registration_backlog: [
        {
          slug: 'macro-key',
          name: 'Macro Key',
          category: 'Finance',
          auth_type: 'api_key',
          registration_url: 'https://example.com/register',
          module_targets: ['finance'],
          agent_targets: ['strategist'],
          integration_priority: 86,
        },
      ],
    }

    const triggerPack = buildN8nApiTriggerPack(layer, {
      generatedAt: '2026-03-14T00:00:00.000Z',
      source: 'unit-test',
    })

    expect(triggerPack.generated_at).toBe('2026-03-14T00:00:00.000Z')
    expect(triggerPack.source).toBe('unit-test')

    const leadPack = triggerPack.event_packs['lead.qualified']
    expect(leadPack.totals.matching_entries).toBe(1)
    expect(leadPack.totals.open_direct).toBe(1)

    const strategyPack = triggerPack.event_packs['strategy.requested']
    expect(strategyPack.totals.matching_entries).toBe(1)
    expect(strategyPack.totals.live_connector).toBe(1)
    expect(strategyPack.totals.registration_pending).toBe(1)
  })
})
