-- Phase 2 + Phase 3: Core Engine + Intelligence Loop schema additions
-- Adds: message classification, deal AI scoring, contact booking URLs,
--        outreach sequences, and deal stage change triggers.

-- ── 1. Messages: AI classification column ────────────────────────────
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS classification JSONB DEFAULT NULL;

COMMENT ON COLUMN public.messages.classification IS
  'AI classification: { intent, confidence, summary, suggested_action }';

-- ── 2. Deals: AI scoring columns ─────────────────────────────────────
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS ai_score INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_reasoning TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS scored_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.deals.ai_score IS 'AI-generated deal score 0-100';
COMMENT ON COLUMN public.deals.ai_reasoning IS 'AI reasoning for the score';

-- ── 3. Contacts: booking URL ─────────────────────────────────────────
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS booking_url TEXT DEFAULT NULL;

COMMENT ON COLUMN public.contacts.booking_url IS 'Cal.com or Calendly booking link';

-- ── 4. Outreach sequences ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.outreach_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  template_set TEXT NOT NULL DEFAULT 'cold',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  current_step INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_step_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.outreach_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own sequences"
  ON public.outreach_sequences FOR ALL
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.outreach_sequence_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES public.outreach_sequences(id) ON DELETE CASCADE,
  step_number INT NOT NULL,
  delay_days INT NOT NULL DEFAULT 0,
  template_type TEXT NOT NULL DEFAULT 'intro'
    CHECK (template_type IN ('intro', 'followup', 'value_add', 'breakup')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'skipped')),
  sent_at TIMESTAMPTZ,
  response_received BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.outreach_sequence_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own sequence steps"
  ON public.outreach_sequence_steps FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.outreach_sequences s
      WHERE s.id = outreach_sequence_steps.sequence_id
        AND s.user_id = auth.uid()
    )
  );

-- ── 5. Deal stage change trigger ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_deal_stage_change()
RETURNS trigger AS $$
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    INSERT INTO public.event_log (event_type, payload, user_id)
    VALUES (
      CASE
        WHEN NEW.stage = 'closed_won' THEN 'deal.closed_won'
        WHEN NEW.stage = 'closed_lost' THEN 'deal.closed_lost'
        ELSE 'deal.stage_changed'
      END,
      jsonb_build_object(
        'deal_id', NEW.id,
        'old_stage', OLD.stage,
        'new_stage', NEW.stage,
        'title', NEW.title,
        'value', NEW.value
      ),
      NEW.user_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_deal_stage_change ON public.deals;
CREATE TRIGGER trg_deal_stage_change
  AFTER UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_deal_stage_change();

-- ── 6. Lead promoted trigger ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_lead_promoted()
RETURNS trigger AS $$
BEGIN
  IF NEW.source = 'prospector' THEN
    INSERT INTO public.event_log (event_type, payload, user_id)
    VALUES (
      'lead.captured',
      jsonb_build_object(
        'contact_id', NEW.id,
        'name', NEW.name,
        'email', NEW.email,
        'source', NEW.source
      ),
      NEW.user_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lead_promoted ON public.contacts;
CREATE TRIGGER trg_lead_promoted
  AFTER INSERT ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_lead_promoted();
