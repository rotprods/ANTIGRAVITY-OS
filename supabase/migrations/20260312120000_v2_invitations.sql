-- ═══════════════════════════════════════════════════
-- OCULOPS v2 — Team Invitations & Growth Layer
-- Implements secure member invitation workflow.
-- ═══════════════════════════════════════════════════

-- 1. Create Invitations Table
-----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  email text NOT NULL,
  role_id bigint REFERENCES public.roles(id) NOT NULL,
  token text DEFAULT encode(gen_random_bytes(32), 'hex') UNIQUE NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now() NOT NULL,
  expires_at timestamptz DEFAULT (now() + interval '7 days') NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired'))
);

COMMENT ON TABLE public.invitations IS 'Pending invitations for users to join an organization.';
CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.invitations(email);


-- 2. RLS Policies for Invitations
-----------------------------------------------------
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view/create invitations for their orgs
CREATE POLICY "Admins can manage invitations" ON public.invitations
  FOR ALL USING (
    exists (
      SELECT 1 FROM public.organization_members om
      JOIN public.roles r ON om.role_id = r.id
      WHERE om.org_id = invitations.org_id
      AND om.user_id = auth.uid()
      AND r.name = 'admin'
    )
  );

-- Policy: Users can view invitations sent to their email (for UI notification purposes)
CREATE POLICY "Users can see invites to their email" ON public.invitations
  FOR SELECT USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );


-- 3. Secure Function to Accept Invitation
-----------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_invitation(token_input text)
RETURNS json AS $$
DECLARE
  invite_record public.invitations;
  user_email text;
  new_member public.organization_members;
BEGIN
  -- Get current user email
  SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();

  -- Find valid invitation
  SELECT * INTO invite_record
  FROM public.invitations
  WHERE token = token_input
  AND status = 'pending'
  AND expires_at > now();

  IF invite_record IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invitation token.';
  END IF;

  -- Verify email matches (security check)
  IF invite_record.email <> user_email THEN
    RAISE EXCEPTION 'This invitation is for a different email address.';
  END IF;

  -- Insert into members
  INSERT INTO public.organization_members (org_id, user_id, role_id)
  VALUES (invite_record.org_id, auth.uid(), invite_record.role_id)
  RETURNING * INTO new_member;

  -- Update invitation status
  UPDATE public.invitations
  SET status = 'accepted'
  WHERE id = invite_record.id;

  RETURN row_to_json(new_member);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;