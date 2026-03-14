# AG2-C6 Synthetic Smoke

Generated at: 2026-03-14T05:09:53.516Z
Result: PASS

## Flow

- Create synthetic outbound queue + sent message
- Trigger `gmail-inbound` synthetic inbound action
- Verify `outreach_queue.status = replied` and message linkage

## Verification

- Queue status: replied
- Provider status: replied
- Queue message_id == inbound message id: true
- Conversation last_inbound_at set: true

## IDs

- org_id: `a11b1e98-7fd9-4789-aab9-ab5a77494627`
- channel_id: `1003d3c7-12e0-4b3f-a53e-833d454a02d9`
- contact_id: `cf0b4179-617e-4854-a9b2-f2df159c2b17`
- conversation_id: `fff921ad-b052-49bd-93a3-cbf3a2a15f20`
- queue_id: `92921594-973b-440a-bfde-3cf275abeb5c`
- outbound_message_id: `ca837e2c-ad14-4ffc-8c84-3d73dbabe044`
- inbound_message_id: `22f2e733-5bbd-4d89-8fb6-bb09ff171dd5`

## Artifacts

- JSON: `docs/runbooks/ag2-c6-synthetic-smoke.latest.json`
- Markdown: `docs/runbooks/ag2-c6-synthetic-smoke.md`
