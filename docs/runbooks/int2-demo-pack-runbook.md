# INT-2 Demo Pack Runbook

## Objective
Execute the 3 required INT-2 workflows in provider-independent mode and produce auditable evidence.

## Command
```bash
node scripts/run-int2-demo-pack.mjs --window-hours 24
```

## What It Runs
- `INT-2.1` bug -> patch -> test -> review (`self_improvement_patch_cycle`)
- `INT-2.2` feature -> implement -> evaluate (`feature_delivery_eval_cycle`)
- `INT-2.3` campaign -> execute -> score -> improve (`campaign_execution_improvement_cycle`)

## Artifacts Produced
- `docs/runbooks/int2-demo-pack.latest.json`
- `docs/runbooks/int2-demo-pack.md`

## Validation Criteria
- 3 pipeline runs created and executed through `orchestration-engine`.
- Each workflow has taxonomy from `get_run_taxonomy`.
- Each workflow has evaluation metrics (decision distribution + escalation count).
- Simulation taxonomy/latest_failures are attached (can be zero in low-risk mode).

## Notes
- Uses `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from `.env` or `supabase/.env.deploy`.
- Designed to run without Gmail/WhatsApp credentials.
