# Ecosystem Readiness

Generated: 2026-03-14T05:09:50.589Z
Version: 1.0.0
Overall state: YELLOW
Window: 24h

## Governance

- Dispatch total: 14
- Blocked total: 0
- Approval pending: 0
- High-risk routed: 12
- Trace coverage: 100.00%

## Module States

| module | state | reason_code | last_success_at | route | smoke_case |
|---|---|---|---|---|---|
| control_tower | degraded | governance_advisory_mode | 2026-03-14T05:09:50.589Z | /control-tower | hard_block_routing |
| governance | degraded | governance_metrics_warning | 2026-03-14T05:09:50.589Z | /control-tower | governor_runtime |
| orchestration | connected | pipeline_activity_ok | 2026-03-13T06:25:47.317Z | /automation | hard_block_routing |
| messaging | simulated | messaging_synthetic_only | 2026-03-14T02:16:22.847Z | /messaging | ag2_c6_synthetic |
| connector_proxy | connected | connectors_live | 2026-03-14T02:16:29.865Z | /automation | hard_block_routing |
| automation | connected | automation_workflows_available | 2026-03-14T01:49:43.760Z | /automation | hard_block_routing |
| api_catalog | connected | api_catalog_live_connectors | 2026-03-14T01:49:21.167Z | /intelligence | hard_block_routing |
| n8n_catalog | connected | n8n_catalog_synced | 2026-03-14T01:50:18.613Z | /automation | hard_block_routing |
| marketplace | connected | marketplace_agents_active | 2026-03-11T16:24:17.968Z | /marketplace | hard_block_routing |
| simulation | connected | simulation_runs_available | 2026-03-14T00:35:55.856Z | /simulation | ag2_c6_synthetic |
| readiness_observability | degraded | readiness_partial_warnings | 2026-03-14T05:09:50.589Z | /control-tower | — |

## Smoke Checks

| smoke_case_id | status | checked_at | evidence_count |
|---|---|---|---|
| hard_block_routing | pass | 2026-03-14T05:09:50.589Z | 40 |
| ag2_c6_synthetic | pass | 2026-03-14T05:09:50.589Z | 3 |
| governor_runtime | pass | 2026-03-14T05:09:50.589Z | 2 |

## Failures

- control_tower (degraded) — No org scope provided; governor_metrics returned advisory defaults. → /control-tower?tab=readiness
- governance (degraded) — No org scope provided; governor_metrics returned advisory defaults. → /control-tower?tab=governance
- readiness_observability (degraded) — No org scope provided; governor_metrics returned advisory defaults. → /control-tower?tab=readiness
