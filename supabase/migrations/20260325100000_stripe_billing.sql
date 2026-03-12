-- ============================================================
-- Stripe Billing Infrastructure
-- Extends organizations with Stripe fields + billing events log
-- ============================================================

-- Add stripe_price_id to organizations if missing
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT,
  ADD COLUMN IF NOT EXISTS plan_status TEXT DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;

-- Billing events log (webhook receipts + manual changes)
CREATE TABLE IF NOT EXISTS public.billing_events (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid        REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type     text        NOT NULL,
  stripe_event_id text       UNIQUE,
  payload        jsonb       DEFAULT '{}',
  processed      boolean     DEFAULT false,
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_events_org_id    ON public.billing_events(org_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_type      ON public.billing_events(event_type);
CREATE INDEX IF NOT EXISTS idx_billing_events_stripe_id ON public.billing_events(stripe_event_id);

ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_all_billing_events" ON public.billing_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "org_read_billing_events" ON public.billing_events
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT user_org_ids()));

-- Checkout sessions tracking
CREATE TABLE IF NOT EXISTS public.checkout_sessions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid        REFERENCES public.organizations(id) ON DELETE CASCADE,
  stripe_session_id   text        UNIQUE,
  price_id            text,
  status              text        DEFAULT 'pending',
  created_at          timestamptz DEFAULT now(),
  completed_at        timestamptz
);

ALTER TABLE public.checkout_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_all_checkout_sessions" ON public.checkout_sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "org_read_checkout_sessions" ON public.checkout_sessions
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT user_org_ids()));
