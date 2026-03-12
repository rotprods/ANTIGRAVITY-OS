-- ============================================================
-- Feature Flags — kill-switch system for agents, modules, APIs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text        NOT NULL UNIQUE,
  enabled     boolean     NOT NULL DEFAULT true,
  description text,
  org_id      uuid        REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_key    ON public.feature_flags(key);
CREATE INDEX IF NOT EXISTS idx_feature_flags_org_id ON public.feature_flags(org_id);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_all_feature_flags" ON public.feature_flags
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "org_read_feature_flags" ON public.feature_flags
  FOR SELECT TO authenticated
  USING (org_id IS NULL OR org_id IN (SELECT user_org_ids()));

CREATE POLICY "org_write_feature_flags" ON public.feature_flags
  FOR ALL TO authenticated
  USING (org_id IN (SELECT user_org_ids()))
  WITH CHECK (org_id IN (SELECT user_org_ids()));

-- Seed global default flags
INSERT INTO public.feature_flags (key, enabled, description) VALUES
  ('agents.atlas',         true,  'ATLAS prospecting agent'),
  ('agents.hunter',        true,  'HUNTER lead qualification agent'),
  ('agents.oracle',        true,  'ORACLE analytics agent'),
  ('agents.sentinel',      true,  'SENTINEL competitor monitoring'),
  ('agents.forge',         true,  'FORGE content generation'),
  ('agents.herald',        true,  'HERALD daily briefing'),
  ('agents.nexus',         true,  'NEXUS inter-agent orchestration'),
  ('modules.pixel_office', true,  'Pixel Office game world'),
  ('modules.billing',      false, 'Billing module (Stripe pending)'),
  ('modules.marketplace',  true,  'Agent Marketplace'),
  ('integrations.whatsapp',false, 'WhatsApp messaging channel'),
  ('integrations.meta',    false, 'Meta Business Discovery'),
  ('integrations.tiktok',  false, 'TikTok Business API')
ON CONFLICT (key) DO NOTHING;
