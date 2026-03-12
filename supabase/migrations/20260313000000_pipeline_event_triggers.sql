-- OCULOPS — Pipeline Event Triggers
-- Auto-log crm_activities + emit event_log on deal stage changes

CREATE OR REPLACE FUNCTION public.handle_deal_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN

    -- Auto-log stage change as CRM activity
    INSERT INTO public.crm_activities (contact_id, company_id, type, subject, notes, org_id)
    VALUES (
      NEW.contact_id,
      NEW.company_id,
      'stage_change',
      'Stage: ' || COALESCE(OLD.stage, 'none') || ' → ' || NEW.stage,
      'Auto-logged by pipeline trigger',
      NEW.org_id
    );

    -- Emit stage change event
    INSERT INTO public.event_log (event_type, payload, source_agent, org_id)
    VALUES (
      'deal.stage_changed',
      jsonb_build_object(
        'deal_id', NEW.id,
        'from',    OLD.stage,
        'to',      NEW.stage,
        'value',   NEW.value,
        'title',   NEW.title
      ),
      'pipeline-trigger',
      NEW.org_id
    );

    -- Auto-request deal scoring when reaching proposal stage
    IF NEW.stage = 'proposal' THEN
      INSERT INTO public.event_log (event_type, payload, source_agent, org_id)
      VALUES (
        'deal.score_requested',
        jsonb_build_object('deal_id', NEW.id),
        'pipeline-trigger',
        NEW.org_id
      );
    END IF;

  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS deal_stage_change_trigger ON public.deals;

CREATE TRIGGER deal_stage_change_trigger
  AFTER UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.handle_deal_stage_change();
