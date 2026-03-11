-- ═══════════════════════════════════════════════════
-- OCULOPS v2 — Core Tenancy & RBAC
-- Implements Organizations, Roles, and Members for SaaS architecture.
-- ═══════════════════════════════════════════════════

-- 1. Create core tenancy tables
-----------------------------------------------------

-- Organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);
COMMENT ON TABLE public.organizations IS 'Represents a tenant in the SaaS platform.';

-- Roles table (static definitions)
CREATE TABLE IF NOT EXISTS public.roles (
  id bigserial PRIMARY KEY,
  name text UNIQUE NOT NULL,
  description text
);
COMMENT ON TABLE public.roles IS 'Defines user roles within an organization (e.g., admin, member).';

-- Seed initial roles
INSERT INTO public.roles (name, description) VALUES
  ('admin', 'Full access to manage the organization, members, and billing.'),
  ('member', 'Standard access to create and manage resources within the organization.')
ON CONFLICT (name) DO NOTHING;

-- Members table (join table for users, orgs, and roles)
CREATE TABLE IF NOT EXISTS public.organization_members (
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role_id bigint REFERENCES public.roles(id) ON DELETE RESTRICT NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (org_id, user_id)
);
COMMENT ON TABLE public.organization_members IS 'Links users to organizations with a specific role.';
CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON public.organization_members(user_id);


-- 2. Create helper function for RLS policies
-----------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_user_role(org_id uuid)
RETURNS text AS $$
DECLARE
  user_role text;
BEGIN
  SELECT r.name INTO user_role
  FROM public.organization_members om
  JOIN public.roles r ON om.role_id = r.id
  WHERE om.user_id = auth.uid() AND om.org_id = $1;
  RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Update existing tables to be organization-specific
-----------------------------------------------------

ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.knowledge_entries ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_contacts_org_id ON public.contacts(org_id);
CREATE INDEX IF NOT EXISTS idx_deals_org_id ON public.deals(org_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_org_id ON public.knowledge_entries(org_id);
CREATE INDEX IF NOT EXISTS idx_companies_org_id ON public.companies(org_id);
CREATE INDEX IF NOT EXISTS idx_signals_org_id ON public.signals(org_id);


-- 4. Enable Row Level Security (RLS)
-----------------------------------------------------

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;


-- 5. Define RLS Policies
-----------------------------------------------------

-- Policy: Users can see and manage organizations they are a member of.
DROP POLICY IF EXISTS "Allow access to own organization" ON public.organizations;
CREATE POLICY "Allow access to own organization" ON public.organizations
  FOR ALL USING (
    id IN (SELECT om.org_id FROM public.organization_members om WHERE om.user_id = auth.uid())
  );

-- Policy: Users can see other members of organizations they belong to.
DROP POLICY IF EXISTS "Allow access to own org members" ON public.organization_members;
CREATE POLICY "Allow access to own org members" ON public.organization_members
  FOR ALL USING (
    org_id IN (SELECT om.org_id FROM public.organization_members om WHERE om.user_id = auth.uid())
  );

-- Generic Policy: Users can access resources that belong to their organization.
-- This pattern will be applied to all org-specific tables.
CREATE OR REPLACE FUNCTION create_org_rls_policy(table_name text)
RETURNS void AS $$
BEGIN
  EXECUTE format('DROP POLICY IF EXISTS "Org members can access %s" ON public.%I;', table_name, table_name);
  EXECUTE format('CREATE POLICY "Org members can access %s" ON public.%I FOR ALL USING (org_id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid()));', table_name, table_name);
END;
$$ LANGUAGE plpgsql;

-- Apply the generic policy to all relevant tables
SELECT create_org_rls_policy('contacts');
SELECT create_org_rls_policy('deals');
SELECT create_org_rls_policy('knowledge_entries');
SELECT create_org_rls_policy('companies');
SELECT create_org_rls_policy('signals');


-- 6. RPC Functions for Organization Management
-----------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_new_organization(org_name text)
RETURNS json AS $$
DECLARE
  new_org public.organizations;
  admin_role_id bigint;
BEGIN
  -- Get the 'admin' role ID
  SELECT id INTO admin_role_id FROM public.roles WHERE name = 'admin';

  -- Create the new organization
  INSERT INTO public.organizations (name, owner_id)
  VALUES (org_name, auth.uid())
  RETURNING * INTO new_org;

  -- Make the creator an admin of the new organization
  INSERT INTO public.organization_members (org_id, user_id, role_id)
  VALUES (new_org.id, auth.uid(), admin_role_id);

  -- Return the newly created organization object
  RETURN row_to_json(new_org);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;