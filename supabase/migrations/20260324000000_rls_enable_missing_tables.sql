-- ============================================================
-- RLS: Enable Row Level Security on tables that had policies
-- defined but were missing the ENABLE RLS statement.
-- Audit date: 2026-03-12 | Phase 0 security fix
-- ============================================================

-- Brain-v2 intelligence tables (policies already exist from 20260312300000)
ALTER TABLE public.agent_memory_v2    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reasoning_traces   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_requests  ENABLE ROW LEVEL SECURITY;

-- Gap-closure tables (policies already exist from 20260322000000)
ALTER TABLE public.copilot_conversations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_sequences        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_sequence_steps   ENABLE ROW LEVEL SECURITY;

-- event_log: user_id scoped (no org_id column)
ALTER TABLE public.event_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'event_log' AND policyname = 'service_all_event_log'
  ) THEN
    EXECUTE 'CREATE POLICY "service_all_event_log" ON public.event_log FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'event_log' AND policyname = 'user_read_event_log'
  ) THEN
    EXECUTE 'CREATE POLICY "user_read_event_log" ON public.event_log FOR SELECT TO authenticated USING (user_id IS NULL OR user_id = auth.uid())';
  END IF;
END $$;

-- invitations: service_role manages, safe fallback
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invitations' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY';

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'invitations' AND policyname = 'service_all_invitations'
    ) THEN
      EXECUTE 'CREATE POLICY "service_all_invitations" ON public.invitations FOR ALL TO service_role USING (true) WITH CHECK (true)';
    END IF;
  END IF;
END $$;

-- organization_members: service_role manages, users read their own
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organization_members' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY';

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'organization_members' AND policyname = 'service_all_organization_members'
    ) THEN
      EXECUTE 'CREATE POLICY "service_all_organization_members" ON public.organization_members FOR ALL TO service_role USING (true) WITH CHECK (true)';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'organization_members' AND policyname = 'own_read_organization_members'
    ) THEN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organization_members' AND column_name = 'user_id' AND table_schema = 'public') THEN
        EXECUTE 'CREATE POLICY "own_read_organization_members" ON public.organization_members FOR SELECT TO authenticated USING (user_id = auth.uid())';
      END IF;
    END IF;
  END IF;
END $$;
