-- ═══════════════════════════════════════════════════
-- OCULOPS V2 — Variable registry uniqueness hardening
-- Allow per-scope/per-owner variable definitions for each variable_key
-- ═══════════════════════════════════════════════════

DROP INDEX IF EXISTS public.uq_cp_variables_org_key;
DROP INDEX IF EXISTS public.uq_cp_variables_global_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cp_variables_org_key_scope_owner
  ON public.control_plane_variables(org_id, variable_key, scope, owner_ref)
  WHERE org_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cp_variables_global_key_scope_owner
  ON public.control_plane_variables(variable_key, scope, owner_ref)
  WHERE org_id IS NULL;
