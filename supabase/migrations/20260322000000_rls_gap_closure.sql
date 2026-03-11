-- ═══════════════════════════════════════════════════════════════════════════
-- OCULOPS — RLS Gap Closure
-- Closes multi-tenancy isolation gaps across 12 tables
--
-- Security review findings applied (2026-03-22):
--   [CRITICAL] Removed all anon USING(true) open policies
--              → edge functions use service_role key → RLS bypassed natively
--              → anon open policy = unauthenticated public write access
--   [HIGH]     Removed OR org_id IS NULL escape hatch from all policies
--              → backfill first, NOT NULL enforced before strict policy ships
--   [HIGH]     Policies added BEFORE old ones dropped (Group B)
--              → prevents RLS deny-all window causing outage
--   [MEDIUM]   set_default_org_id() trigger hardened: rejects multi-org ambiguity
--   [MEDIUM]   user_org_ids() search_path locked
--   [MEDIUM]   WITH CHECK (true) added to all service_role ALL policies
--
-- Rollback: see bottom of file
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 0. Harden SECURITY DEFINER functions against schema injection ────────────

ALTER FUNCTION public.user_org_ids() SET search_path = public, pg_temp;

-- ── 1. Harden set_default_org_id() — reject multi-org ambiguity ─────────────
-- Old version: LIMIT 1 without ORDER BY → non-deterministic org assignment
-- New version: single-org users get auto-set; multi-org users must be explicit

CREATE OR REPLACE FUNCTION public.set_default_org_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_org_ids UUID[];
BEGIN
  -- Already set: pass through
  IF NEW.org_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- No auth context (cron / service_role background jobs): leave NULL
  -- Application layer must pass org_id explicitly for system writes
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT ARRAY(
    SELECT org_id FROM public.org_members WHERE user_id = auth.uid()
  ) INTO v_org_ids;

  IF array_length(v_org_ids, 1) = 1 THEN
    NEW.org_id := v_org_ids[1];
  ELSIF array_length(v_org_ids, 1) > 1 THEN
    RAISE EXCEPTION
      'Ambiguous org context: user belongs to % orgs. Pass org_id explicitly.',
      array_length(v_org_ids, 1);
  ELSE
    RAISE EXCEPTION 'No org membership found for current user.';
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.set_default_org_id() SET search_path = public, pg_temp;


-- ═══════════════════════════════════════════════════════════════════════════
-- GROUP A: User-facing tables with open/no RLS — add org_id + strict isolation
-- Tables: outreach_queue, email_templates, messaging_channels, agent_logs
--
-- Strategy:
--   1. Add org_id column (nullable)
--   2. Backfill via user_id → org_members (or single-org fallback)
--   3. Delete unresolvable orphaned rows
--   4. Enforce NOT NULL
--   5. Drop old open policies
--   6. Add strict org-scoped + service_role policies
--   7. Add auto-set trigger
-- ═══════════════════════════════════════════════════════════════════════════

-- ── A1. outreach_queue ───────────────────────────────────────────────────────
-- Note: table has no user_id; use single-org backfill (pre-launch, 1 org only)

ALTER TABLE public.outreach_queue
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

UPDATE public.outreach_queue
  SET org_id = (SELECT id FROM public.organizations ORDER BY created_at LIMIT 1)
  WHERE org_id IS NULL
    AND (SELECT COUNT(*) FROM public.organizations) > 0;

DELETE FROM public.outreach_queue WHERE org_id IS NULL;

ALTER TABLE public.outreach_queue ALTER COLUMN org_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_outreach_queue_org_id ON public.outreach_queue(org_id);

ALTER TABLE public.outreach_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all outreach_queue"    ON public.outreach_queue;
DROP POLICY IF EXISTS "anon_agent_outreach_queue"   ON public.outreach_queue;
DROP POLICY IF EXISTS "org_select_outreach_queue"   ON public.outreach_queue;
DROP POLICY IF EXISTS "org_insert_outreach_queue"   ON public.outreach_queue;
DROP POLICY IF EXISTS "org_update_outreach_queue"   ON public.outreach_queue;
DROP POLICY IF EXISTS "org_delete_outreach_queue"   ON public.outreach_queue;
DROP POLICY IF EXISTS "service_all_outreach_queue"  ON public.outreach_queue;

CREATE POLICY "org_select_outreach_queue" ON public.outreach_queue
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.user_org_ids()));

CREATE POLICY "org_insert_outreach_queue" ON public.outreach_queue
  FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT public.user_org_ids()));

CREATE POLICY "org_update_outreach_queue" ON public.outreach_queue
  FOR UPDATE TO authenticated
  USING  (org_id IN (SELECT public.user_org_ids()))
  WITH CHECK (org_id IN (SELECT public.user_org_ids()));

CREATE POLICY "org_delete_outreach_queue" ON public.outreach_queue
  FOR DELETE TO authenticated
  USING (org_id IN (SELECT public.user_org_ids()));

CREATE POLICY "service_all_outreach_queue" ON public.outreach_queue
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS auto_set_org_id ON public.outreach_queue;
CREATE TRIGGER auto_set_org_id
  BEFORE INSERT ON public.outreach_queue
  FOR EACH ROW EXECUTE FUNCTION public.set_default_org_id();


-- ── A2. email_templates ──────────────────────────────────────────────────────

ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

UPDATE public.email_templates
  SET org_id = (SELECT id FROM public.organizations ORDER BY created_at LIMIT 1)
  WHERE org_id IS NULL
    AND (SELECT COUNT(*) FROM public.organizations) > 0;

DELETE FROM public.email_templates WHERE org_id IS NULL;

ALTER TABLE public.email_templates ALTER COLUMN org_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_templates_org_id ON public.email_templates(org_id);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all email_templates"   ON public.email_templates;
DROP POLICY IF EXISTS "anon_agent_email_templates"  ON public.email_templates;
DROP POLICY IF EXISTS "org_select_email_templates"  ON public.email_templates;
DROP POLICY IF EXISTS "org_insert_email_templates"  ON public.email_templates;
DROP POLICY IF EXISTS "org_update_email_templates"  ON public.email_templates;
DROP POLICY IF EXISTS "org_delete_email_templates"  ON public.email_templates;
DROP POLICY IF EXISTS "service_all_email_templates" ON public.email_templates;

CREATE POLICY "org_select_email_templates" ON public.email_templates
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.user_org_ids()));

CREATE POLICY "org_insert_email_templates" ON public.email_templates
  FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT public.user_org_ids()));

CREATE POLICY "org_update_email_templates" ON public.email_templates
  FOR UPDATE TO authenticated
  USING  (org_id IN (SELECT public.user_org_ids()))
  WITH CHECK (org_id IN (SELECT public.user_org_ids()));

CREATE POLICY "org_delete_email_templates" ON public.email_templates
  FOR DELETE TO authenticated
  USING (org_id IN (SELECT public.user_org_ids()));

CREATE POLICY "service_all_email_templates" ON public.email_templates
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS auto_set_org_id ON public.email_templates;
CREATE TRIGGER auto_set_org_id
  BEFORE INSERT ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_default_org_id();


-- ── A3. messaging_channels ───────────────────────────────────────────────────
-- Has user_id → backfill via org_members

ALTER TABLE public.messaging_channels
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

UPDATE public.messaging_channels mc
  SET org_id = (
    SELECT om.org_id FROM public.org_members om
    WHERE om.user_id = mc.user_id
    LIMIT 1
  )
  WHERE mc.org_id IS NULL AND mc.user_id IS NOT NULL;

-- Rows with no resolvable user → single-org fallback, then delete orphans
UPDATE public.messaging_channels
  SET org_id = (SELECT id FROM public.organizations ORDER BY created_at LIMIT 1)
  WHERE org_id IS NULL
    AND (SELECT COUNT(*) FROM public.organizations) > 0;

DELETE FROM public.messaging_channels WHERE org_id IS NULL;

ALTER TABLE public.messaging_channels ALTER COLUMN org_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messaging_channels_org_id ON public.messaging_channels(org_id);

ALTER TABLE public.messaging_channels ENABLE ROW LEVEL SECURITY;

-- Drop all existing open / anon policies (pattern from original migration used 'anon_all_*')
DROP POLICY IF EXISTS "anon_all_messaging_channels"   ON public.messaging_channels;
DROP POLICY IF EXISTS "anon_agent_messaging_channels" ON public.messaging_channels;
DROP POLICY IF EXISTS "org_select_messaging_channels" ON public.messaging_channels;
DROP POLICY IF EXISTS "org_insert_messaging_channels" ON public.messaging_channels;
DROP POLICY IF EXISTS "org_update_messaging_channels" ON public.messaging_channels;
DROP POLICY IF EXISTS "org_delete_messaging_channels" ON public.messaging_channels;
DROP POLICY IF EXISTS "service_all_messaging_channels" ON public.messaging_channels;

CREATE POLICY "org_select_messaging_channels" ON public.messaging_channels
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.user_org_ids()));

CREATE POLICY "org_insert_messaging_channels" ON public.messaging_channels
  FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT public.user_org_ids()));

CREATE POLICY "org_update_messaging_channels" ON public.messaging_channels
  FOR UPDATE TO authenticated
  USING  (org_id IN (SELECT public.user_org_ids()))
  WITH CHECK (org_id IN (SELECT public.user_org_ids()));

CREATE POLICY "org_delete_messaging_channels" ON public.messaging_channels
  FOR DELETE TO authenticated
  USING (org_id IN (SELECT public.user_org_ids()));

CREATE POLICY "service_all_messaging_channels" ON public.messaging_channels
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS auto_set_org_id ON public.messaging_channels;
CREATE TRIGGER auto_set_org_id
  BEFORE INSERT ON public.messaging_channels
  FOR EACH ROW EXECUTE FUNCTION public.set_default_org_id();


-- ── A4. agent_logs ───────────────────────────────────────────────────────────
-- No user_id; written by edge functions (service_role). Single-org backfill.
-- org_id stays nullable (cron-triggered agent runs have no auth context).

ALTER TABLE public.agent_logs
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

UPDATE public.agent_logs
  SET org_id = (SELECT id FROM public.organizations ORDER BY created_at LIMIT 1)
  WHERE org_id IS NULL
    AND (SELECT COUNT(*) FROM public.organizations) > 0;

CREATE INDEX IF NOT EXISTS idx_agent_logs_org_id ON public.agent_logs(org_id);

ALTER TABLE public.agent_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all_agent_logs"    ON public.agent_logs;
DROP POLICY IF EXISTS "org_select_agent_logs"  ON public.agent_logs;
DROP POLICY IF EXISTS "service_all_agent_logs" ON public.agent_logs;

-- Authenticated: read only their org's logs (nullable rows visible to service_role only)
CREATE POLICY "org_select_agent_logs" ON public.agent_logs
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.user_org_ids()));

CREATE POLICY "service_all_agent_logs" ON public.agent_logs
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- No auto-set trigger: agent_logs written exclusively by service_role edge functions
-- which must pass org_id explicitly from request context


-- ═══════════════════════════════════════════════════════════════════════════
-- GROUP B: user_id-scoped tables → migrate to org-scoped
-- Tables: copilot_conversations, outreach_sequences, outreach_sequence_steps
--
-- CRITICAL ORDER: add new org-scoped policies FIRST, then drop old user_id
-- policies. Never leave a gap where RLS is enabled but no policy matches
-- (PostgreSQL deny-by-default → all queries return empty → outage).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── B1. copilot_conversations ─────────────────────────────────────────────────

ALTER TABLE public.copilot_conversations
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

UPDATE public.copilot_conversations cc
  SET org_id = (
    SELECT om.org_id FROM public.org_members om
    WHERE om.user_id = cc.user_id
    LIMIT 1
  )
  WHERE cc.org_id IS NULL AND cc.user_id IS NOT NULL;

UPDATE public.copilot_conversations
  SET org_id = (SELECT id FROM public.organizations ORDER BY created_at LIMIT 1)
  WHERE org_id IS NULL
    AND (SELECT COUNT(*) FROM public.organizations) > 0;

DELETE FROM public.copilot_conversations WHERE org_id IS NULL;

ALTER TABLE public.copilot_conversations ALTER COLUMN org_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_copilot_conversations_org_id
  ON public.copilot_conversations(org_id);

-- ① Add new policies BEFORE dropping old ones
DROP POLICY IF EXISTS "org_select_copilot_conversations" ON public.copilot_conversations;
DROP POLICY IF EXISTS "org_insert_copilot_conversations" ON public.copilot_conversations;
DROP POLICY IF EXISTS "org_update_copilot_conversations" ON public.copilot_conversations;
DROP POLICY IF EXISTS "org_delete_copilot_conversations" ON public.copilot_conversations;
DROP POLICY IF EXISTS "service_all_copilot_conversations" ON public.copilot_conversations;

CREATE POLICY "org_select_copilot_conversations" ON public.copilot_conversations
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.user_org_ids()));

CREATE POLICY "org_insert_copilot_conversations" ON public.copilot_conversations
  FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT public.user_org_ids()));

CREATE POLICY "org_update_copilot_conversations" ON public.copilot_conversations
  FOR UPDATE TO authenticated
  USING  (org_id IN (SELECT public.user_org_ids()))
  WITH CHECK (org_id IN (SELECT public.user_org_ids()));

CREATE POLICY "org_delete_copilot_conversations" ON public.copilot_conversations
  FOR DELETE TO authenticated
  USING (org_id IN (SELECT public.user_org_ids()));

CREATE POLICY "service_all_copilot_conversations" ON public.copilot_conversations
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ② Now drop the old user_id-based policies (safe: new policies are already live)
DROP POLICY IF EXISTS "copilot_conversations_user"    ON public.copilot_conversations;
DROP POLICY IF EXISTS "copilot_conversations_service" ON public.copilot_conversations;

DROP TRIGGER IF EXISTS auto_set_org_id ON public.copilot_conversations;
CREATE TRIGGER auto_set_org_id
  BEFORE INSERT ON public.copilot_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_default_org_id();


-- ── B2. outreach_sequences ────────────────────────────────────────────────────

ALTER TABLE public.outreach_sequences
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

UPDATE public.outreach_sequences os
  SET org_id = (
    SELECT om.org_id FROM public.org_members om
    WHERE om.user_id = os.user_id
    LIMIT 1
  )
  WHERE os.org_id IS NULL AND os.user_id IS NOT NULL;

UPDATE public.outreach_sequences
  SET org_id = (SELECT id FROM public.organizations ORDER BY created_at LIMIT 1)
  WHERE org_id IS NULL
    AND (SELECT COUNT(*) FROM public.organizations) > 0;

DELETE FROM public.outreach_sequences WHERE org_id IS NULL;

ALTER TABLE public.outreach_sequences ALTER COLUMN org_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_outreach_sequences_org_id
  ON public.outreach_sequences(org_id);

-- ① New org-scoped policies first
DROP POLICY IF EXISTS "org_select_outreach_sequences" ON public.outreach_sequences;
DROP POLICY IF EXISTS "org_insert_outreach_sequences" ON public.outreach_sequences;
DROP POLICY IF EXISTS "org_update_outreach_sequences" ON public.outreach_sequences;
DROP POLICY IF EXISTS "org_delete_outreach_sequences" ON public.outreach_sequences;
DROP POLICY IF EXISTS "service_all_outreach_sequences" ON public.outreach_sequences;

CREATE POLICY "org_select_outreach_sequences" ON public.outreach_sequences
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.user_org_ids()));

CREATE POLICY "org_insert_outreach_sequences" ON public.outreach_sequences
  FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT public.user_org_ids()));

CREATE POLICY "org_update_outreach_sequences" ON public.outreach_sequences
  FOR UPDATE TO authenticated
  USING  (org_id IN (SELECT public.user_org_ids()))
  WITH CHECK (org_id IN (SELECT public.user_org_ids()));

CREATE POLICY "org_delete_outreach_sequences" ON public.outreach_sequences
  FOR DELETE TO authenticated
  USING (org_id IN (SELECT public.user_org_ids()));

CREATE POLICY "service_all_outreach_sequences" ON public.outreach_sequences
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ② Drop old user_id policy
DROP POLICY IF EXISTS "Users manage own sequences" ON public.outreach_sequences;

DROP TRIGGER IF EXISTS auto_set_org_id ON public.outreach_sequences;
CREATE TRIGGER auto_set_org_id
  BEFORE INSERT ON public.outreach_sequences
  FOR EACH ROW EXECUTE FUNCTION public.set_default_org_id();


-- ── B3. outreach_sequence_steps ───────────────────────────────────────────────
-- No direct user_id; backfill via parent sequence → org_id

ALTER TABLE public.outreach_sequence_steps
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

UPDATE public.outreach_sequence_steps oss
  SET org_id = (
    SELECT os.org_id FROM public.outreach_sequences os
    WHERE os.id = oss.sequence_id
  )
  WHERE oss.org_id IS NULL;

-- Any orphaned steps (parent deleted) use single-org fallback then delete
UPDATE public.outreach_sequence_steps
  SET org_id = (SELECT id FROM public.organizations ORDER BY created_at LIMIT 1)
  WHERE org_id IS NULL
    AND (SELECT COUNT(*) FROM public.organizations) > 0;

DELETE FROM public.outreach_sequence_steps WHERE org_id IS NULL;

ALTER TABLE public.outreach_sequence_steps ALTER COLUMN org_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_outreach_sequence_steps_org_id
  ON public.outreach_sequence_steps(org_id);

-- ① New org-scoped policies first
DROP POLICY IF EXISTS "org_select_outreach_sequence_steps" ON public.outreach_sequence_steps;
DROP POLICY IF EXISTS "org_insert_outreach_sequence_steps" ON public.outreach_sequence_steps;
DROP POLICY IF EXISTS "org_update_outreach_sequence_steps" ON public.outreach_sequence_steps;
DROP POLICY IF EXISTS "org_delete_outreach_sequence_steps" ON public.outreach_sequence_steps;
DROP POLICY IF EXISTS "service_all_outreach_sequence_steps" ON public.outreach_sequence_steps;

CREATE POLICY "org_select_outreach_sequence_steps" ON public.outreach_sequence_steps
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.user_org_ids()));

CREATE POLICY "org_insert_outreach_sequence_steps" ON public.outreach_sequence_steps
  FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT public.user_org_ids()));

CREATE POLICY "org_update_outreach_sequence_steps" ON public.outreach_sequence_steps
  FOR UPDATE TO authenticated
  USING  (org_id IN (SELECT public.user_org_ids()))
  WITH CHECK (org_id IN (SELECT public.user_org_ids()));

CREATE POLICY "org_delete_outreach_sequence_steps" ON public.outreach_sequence_steps
  FOR DELETE TO authenticated
  USING (org_id IN (SELECT public.user_org_ids()));

CREATE POLICY "service_all_outreach_sequence_steps" ON public.outreach_sequence_steps
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ② Drop old join-based policy
DROP POLICY IF EXISTS "Users manage own sequence steps" ON public.outreach_sequence_steps;

DROP TRIGGER IF EXISTS auto_set_org_id ON public.outreach_sequence_steps;
CREATE TRIGGER auto_set_org_id
  BEFORE INSERT ON public.outreach_sequence_steps
  FOR EACH ROW EXECUTE FUNCTION public.set_default_org_id();


-- ═══════════════════════════════════════════════════════════════════════════
-- GROUP C: System / audit tables written by agents via service_role
-- Tables: agent_memory_v2, reasoning_traces, audit_logs, incidents,
--         approval_requests
--
-- Strategy:
--   - org_id stays NULLABLE (cron/background agents have no auth.uid())
--   - Application layer (agent-brain-v2.ts) MUST pass org_id from request ctx
--   - Authenticated: SELECT only, strict org-scoped (no NULL escape hatch)
--   - service_role: full access via explicit policy
--   - Old USING(true) authenticated policies dropped
-- ═══════════════════════════════════════════════════════════════════════════

-- ── C1. agent_memory_v2 ───────────────────────────────────────────────────────

ALTER TABLE public.agent_memory_v2
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

UPDATE public.agent_memory_v2
  SET org_id = (SELECT id FROM public.organizations ORDER BY created_at LIMIT 1)
  WHERE org_id IS NULL
    AND (SELECT COUNT(*) FROM public.organizations) > 0;

CREATE INDEX IF NOT EXISTS idx_agent_memory_v2_org_id ON public.agent_memory_v2(org_id);

-- Drop old open policy
DROP POLICY IF EXISTS "memory_v2_service_all"      ON public.agent_memory_v2;
DROP POLICY IF EXISTS "org_read_agent_memory_v2"   ON public.agent_memory_v2;
DROP POLICY IF EXISTS "service_all_agent_memory_v2" ON public.agent_memory_v2;

-- Authenticated can only read their org's memory entries
CREATE POLICY "org_read_agent_memory_v2" ON public.agent_memory_v2
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.user_org_ids()));

-- service_role: full access (edge functions write memory with explicit org_id)
CREATE POLICY "service_all_agent_memory_v2" ON public.agent_memory_v2
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);


-- ── C2. reasoning_traces ──────────────────────────────────────────────────────

ALTER TABLE public.reasoning_traces
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

UPDATE public.reasoning_traces
  SET org_id = (SELECT id FROM public.organizations ORDER BY created_at LIMIT 1)
  WHERE org_id IS NULL
    AND (SELECT COUNT(*) FROM public.organizations) > 0;

CREATE INDEX IF NOT EXISTS idx_reasoning_traces_org_id ON public.reasoning_traces(org_id);

DROP POLICY IF EXISTS "traces_service_all"          ON public.reasoning_traces;
DROP POLICY IF EXISTS "org_read_reasoning_traces"   ON public.reasoning_traces;
DROP POLICY IF EXISTS "service_all_reasoning_traces" ON public.reasoning_traces;

CREATE POLICY "org_read_reasoning_traces" ON public.reasoning_traces
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.user_org_ids()));

CREATE POLICY "service_all_reasoning_traces" ON public.reasoning_traces
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);


-- ── C3. audit_logs ────────────────────────────────────────────────────────────

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

UPDATE public.audit_logs
  SET org_id = (SELECT id FROM public.organizations ORDER BY created_at LIMIT 1)
  WHERE org_id IS NULL
    AND (SELECT COUNT(*) FROM public.organizations) > 0;

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_id ON public.audit_logs(org_id);

DROP POLICY IF EXISTS "audit_service_all"       ON public.audit_logs;
DROP POLICY IF EXISTS "org_read_audit_logs"     ON public.audit_logs;
DROP POLICY IF EXISTS "service_all_audit_logs"  ON public.audit_logs;

CREATE POLICY "org_read_audit_logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.user_org_ids()));

CREATE POLICY "service_all_audit_logs" ON public.audit_logs
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);


-- ── C4. incidents ─────────────────────────────────────────────────────────────

ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

UPDATE public.incidents
  SET org_id = (SELECT id FROM public.organizations ORDER BY created_at LIMIT 1)
  WHERE org_id IS NULL
    AND (SELECT COUNT(*) FROM public.organizations) > 0;

CREATE INDEX IF NOT EXISTS idx_incidents_org_id ON public.incidents(org_id);

DROP POLICY IF EXISTS "incidents_service_all"   ON public.incidents;
DROP POLICY IF EXISTS "org_read_incidents"      ON public.incidents;
DROP POLICY IF EXISTS "service_all_incidents"   ON public.incidents;

CREATE POLICY "org_read_incidents" ON public.incidents
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.user_org_ids()));

CREATE POLICY "service_all_incidents" ON public.incidents
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);


-- ── C5. approval_requests ─────────────────────────────────────────────────────
-- Users need UPDATE to approve/reject their own org's requests

ALTER TABLE public.approval_requests
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

UPDATE public.approval_requests
  SET org_id = (SELECT id FROM public.organizations ORDER BY created_at LIMIT 1)
  WHERE org_id IS NULL
    AND (SELECT COUNT(*) FROM public.organizations) > 0;

CREATE INDEX IF NOT EXISTS idx_approval_requests_org_id ON public.approval_requests(org_id);

DROP POLICY IF EXISTS "approvals_service_all"          ON public.approval_requests;
DROP POLICY IF EXISTS "org_read_approval_requests"     ON public.approval_requests;
DROP POLICY IF EXISTS "org_update_approval_requests"   ON public.approval_requests;
DROP POLICY IF EXISTS "service_all_approval_requests"  ON public.approval_requests;

CREATE POLICY "org_read_approval_requests" ON public.approval_requests
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.user_org_ids()));

-- Users can update (approve/reject) their org's pending requests
CREATE POLICY "org_update_approval_requests" ON public.approval_requests
  FOR UPDATE TO authenticated
  USING  (org_id IN (SELECT public.user_org_ids()))
  WITH CHECK (org_id IN (SELECT public.user_org_ids()));

CREATE POLICY "service_all_approval_requests" ON public.approval_requests
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);


-- ═══════════════════════════════════════════════════════════════════════════
-- APPLICATION LAYER NOTE (non-SQL — must be applied in agent-brain-v2.ts)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- All writes to Group C tables from edge functions must include org_id:
--
--   // WRONG — org_id missing:
--   await supabase.from('agent_memory_v2').insert({ agent, namespace, key, value })
--
--   // CORRECT — org_id from request context:
--   if (!ctx.org_id) throw new Error('Missing org_id in agent context')
--   await supabase.from('agent_memory_v2').insert({ agent, namespace, key, value, org_id: ctx.org_id })
--
-- Edge functions invoked by authenticated users should extract org_id from
-- the request body or JWT claims and pass it through the entire call chain.
-- Cron-triggered agent runs should source org_id from a config/env variable
-- or the target org's record in agent_definitions.


COMMIT;


-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK (run manually if needed — do NOT run in production without review)
-- ═══════════════════════════════════════════════════════════════════════════
/*
BEGIN;

-- Restore set_default_org_id to original (simple LIMIT 1 version)
CREATE OR REPLACE FUNCTION public.set_default_org_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.org_id IS NULL THEN
    NEW.org_id := (SELECT org_id FROM public.org_members WHERE user_id = auth.uid() LIMIT 1);
  END IF;
  RETURN NEW;
END;
$$;

-- Group A: remove org_id columns (data loss if column has data — verify first)
ALTER TABLE public.outreach_queue       DROP COLUMN IF EXISTS org_id;
ALTER TABLE public.email_templates      DROP COLUMN IF EXISTS org_id;
ALTER TABLE public.messaging_channels   DROP COLUMN IF EXISTS org_id;
ALTER TABLE public.agent_logs           DROP COLUMN IF EXISTS org_id;

-- Group B: remove org_id columns
ALTER TABLE public.copilot_conversations    DROP COLUMN IF EXISTS org_id;
ALTER TABLE public.outreach_sequences       DROP COLUMN IF EXISTS org_id;
ALTER TABLE public.outreach_sequence_steps  DROP COLUMN IF EXISTS org_id;

-- Group C: remove org_id columns
ALTER TABLE public.agent_memory_v2    DROP COLUMN IF EXISTS org_id;
ALTER TABLE public.reasoning_traces   DROP COLUMN IF EXISTS org_id;
ALTER TABLE public.audit_logs         DROP COLUMN IF EXISTS org_id;
ALTER TABLE public.incidents          DROP COLUMN IF EXISTS org_id;
ALTER TABLE public.approval_requests  DROP COLUMN IF EXISTS org_id;

-- Restore original open policies for Group A
CREATE POLICY "Allow all outreach_queue"  ON public.outreach_queue  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all email_templates" ON public.email_templates FOR ALL USING (true) WITH CHECK (true);

-- Restore Group B user_id-based policies
CREATE POLICY copilot_conversations_user ON public.copilot_conversations
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own sequences" ON public.outreach_sequences
  FOR ALL USING (auth.uid() = user_id);

-- Restore Group C open policies
CREATE POLICY "memory_v2_service_all"  ON public.agent_memory_v2  USING (true);
CREATE POLICY "traces_service_all"     ON public.reasoning_traces  USING (true);
CREATE POLICY "audit_service_all"      ON public.audit_logs        USING (true);
CREATE POLICY "incidents_service_all"  ON public.incidents         USING (true);
CREATE POLICY "approvals_service_all"  ON public.approval_requests USING (true);

COMMIT;
*/
