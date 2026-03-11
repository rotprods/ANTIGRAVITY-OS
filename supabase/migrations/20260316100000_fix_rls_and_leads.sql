-- ═══════════════════════════════════════════════════
-- OCULOPS — Fix RLS Infinite Recursion + Lead Capture
-- Applied: 2026-03-11
-- ═══════════════════════════════════════════════════

-- ─── Part 1: Fix organization_members RLS ───────────────────────

DROP POLICY IF EXISTS "Allow access to own org members" ON public.organization_members;

CREATE POLICY "members_select_own" ON public.organization_members
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "members_insert_self" ON public.organization_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "members_delete_own" ON public.organization_members
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "members_select_same_org" ON public.organization_members
  FOR SELECT USING (
    org_id IN (
      SELECT om2.org_id FROM public.organization_members om2
      WHERE om2.user_id = auth.uid()
    )
  );

-- ─── Fix user_org_ids() function ────────────────────────────────

CREATE OR REPLACE FUNCTION public.user_org_ids()
RETURNS SETOF uuid AS $$
  SELECT org_id FROM public.organization_members WHERE user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── Drop duplicate organizations policy ────────────────────────

DROP POLICY IF EXISTS "Allow access to own organization" ON public.organizations;

-- ─── Part 2: Leads table ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text NOT NULL,
  full_name text,
  source text DEFAULT 'signup',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_leads_email ON public.leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at DESC);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.leads
  FOR ALL USING (auth.role() = 'service_role');

-- ─── Trigger: auto-capture lead on signup ──────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.leads (user_id, email, full_name, source)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'signup'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
