# Control Plane Smoke Runbook

Updated: 2026-03-13

## Objective
Validate the Level-7 `control-plane` edge function and the core action surface:

- `goal_parse`
- `goal_route`
- `task_graph_build`
- `task_graph_execute`
- `run_status`
- `governance_check`
- `evaluate`
- `simulate`
- `improve`
- `metrics`

## Prerequisites

- `SUPABASE_URL` available in env.
- `SUPABASE_SERVICE_ROLE_KEY` available in env.
- Latest migrations applied (including `20260327110000_control_plane_event_envelope_v2.sql`).

## Execute

```bash
npm run smoke:control-plane
```

## Expected result

- JSON output with `ok: true`.
- `goal_parse` returns normalized `goal_spec`.
- `metrics` returns current SLO measurements and governance stats.

## Deep verification (optional)

1. Call function manually:
```bash
curl -s "$SUPABASE_URL/functions/v1/control-plane" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -d '{"action":"registry_snapshot","limit":20}'
```

2. Verify `event_log` contains events where:
- `event_type` starts with `control_plane.`
- `metadata.envelope_v2` is present.
- `trace_id` column is populated after migration.
