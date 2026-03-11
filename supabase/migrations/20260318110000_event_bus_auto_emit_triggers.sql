-- ═══════════════════════════════════════════════════════════════════════════════
-- OCULOPS — Event Bus Auto-Emit Triggers
--
-- Bridges the gap between table writes and the event bus.
-- When agents write to agent_logs, contacts, deals, signals, etc.,
-- these triggers automatically emit events to event_log,
-- which fires the pg_net dispatcher → n8n webhooks.
--
-- This means agents DON'T need to know about the event bus.
-- The database handles event emission automatically.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Agent lifecycle events (agent_logs → event_log) ─────────────────────
-- Emits: agent.completed, agent.error

CREATE OR REPLACE FUNCTION public.emit_agent_lifecycle_event()
RETURNS trigger AS $$
DECLARE
  event_type text;
  agent_status text;
BEGIN
  -- Determine event type from the output
  agent_status := COALESCE(
    NEW.output->>'status',
    CASE WHEN NEW.output->>'success' = 'false' THEN 'error' ELSE 'completed' END
  );

  IF agent_status = 'error' THEN
    event_type := 'agent.error';
  ELSE
    event_type := 'agent.completed';
  END IF;

  INSERT INTO public.event_log (event_type, payload, source_agent, metadata)
  VALUES (
    event_type,
    jsonb_build_object(
      'agent_code_name', NEW.agent_code_name,
      'action', NEW.action,
      'duration_ms', NEW.duration_ms,
      'task_id', NEW.task_id
    ),
    NEW.agent_code_name,
    jsonb_build_object('agent_log_id', NEW.id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS agent_logs_emit_event ON public.agent_logs;
CREATE TRIGGER agent_logs_emit_event
  AFTER INSERT ON public.agent_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.emit_agent_lifecycle_event();


-- ─── 2. Lead captured (contacts INSERT → event_log) ────────────────────────
-- Emits: lead.captured

CREATE OR REPLACE FUNCTION public.emit_lead_captured_event()
RETURNS trigger AS $$
BEGIN
  -- Only emit for agent-created contacts (source is an agent code_name)
  IF NEW.source IS NOT NULL AND NEW.source != 'manual' AND NEW.source != 'import' THEN
    INSERT INTO public.event_log (event_type, payload, source_agent, metadata)
    VALUES (
      'lead.captured',
      jsonb_build_object(
        'contact_id', NEW.id,
        'name', NEW.name,
        'company', NEW.company,
        'status', NEW.status,
        'score', NEW.score,
        'source', NEW.source
      ),
      NEW.source,
      jsonb_build_object('table', 'contacts')
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS contacts_emit_lead_captured ON public.contacts;
CREATE TRIGGER contacts_emit_lead_captured
  AFTER INSERT ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.emit_lead_captured_event();


-- ─── 3. Lead qualified (prospector_leads UPDATE → event_log) ────────────────
-- Emits: lead.qualified (when status changes to 'qualified' or 'pursuing')

CREATE OR REPLACE FUNCTION public.emit_lead_qualified_event()
RETURNS trigger AS $$
BEGIN
  IF (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.status IN ('qualified', 'pursuing')
     AND OLD.status NOT IN ('qualified', 'pursuing') THEN
    INSERT INTO public.event_log (event_type, payload, metadata)
    VALUES (
      'lead.qualified',
      jsonb_build_object(
        'lead_id', NEW.id,
        'name', NEW.name,
        'score', NEW.ai_score,
        'estimated_deal_value', NEW.estimated_deal_value,
        'category', NEW.category,
        'previous_status', OLD.status,
        'new_status', NEW.status
      ),
      jsonb_build_object('table', 'prospector_leads')
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS prospector_leads_emit_qualified ON public.prospector_leads;
CREATE TRIGGER prospector_leads_emit_qualified
  AFTER UPDATE ON public.prospector_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.emit_lead_qualified_event();


-- ─── 4. Deal stage changed (deals UPDATE → event_log) ──────────────────────
-- Emits: deal.stage_changed, deal.closed_won, deal.closed_lost

CREATE OR REPLACE FUNCTION public.emit_deal_stage_event()
RETURNS trigger AS $$
DECLARE
  event_type text;
BEGIN
  -- Only fire when stage actually changes
  IF OLD.stage IS NOT DISTINCT FROM NEW.stage THEN
    RETURN NEW;
  END IF;

  -- Determine specific event type
  IF NEW.stage = 'won' THEN
    event_type := 'deal.closed_won';
  ELSIF NEW.stage = 'lost' THEN
    event_type := 'deal.closed_lost';
  ELSE
    event_type := 'deal.stage_changed';
  END IF;

  INSERT INTO public.event_log (event_type, payload, metadata)
  VALUES (
    event_type,
    jsonb_build_object(
      'deal_id', NEW.id,
      'title', NEW.title,
      'value', NEW.value,
      'probability', NEW.probability,
      'previous_stage', OLD.stage,
      'new_stage', NEW.stage,
      'contact_id', NEW.contact_id
    ),
    jsonb_build_object('table', 'deals')
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS deals_emit_stage_event ON public.deals;
CREATE TRIGGER deals_emit_stage_event
  AFTER UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.emit_deal_stage_event();


-- ─── 5. Signal detected (signals INSERT → event_log) ───────────────────────
-- Emits: signal.detected

CREATE OR REPLACE FUNCTION public.emit_signal_detected_event()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.event_log (event_type, payload, source_agent, metadata)
  VALUES (
    'signal.detected',
    jsonb_build_object(
      'signal_id', NEW.id,
      'title', NEW.title,
      'category', NEW.category,
      'impact', NEW.impact,
      'confidence', NEW.confidence,
      'source', NEW.source
    ),
    NEW.created_by,
    jsonb_build_object('table', 'signals')
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS signals_emit_detected ON public.signals;
CREATE TRIGGER signals_emit_detected
  AFTER INSERT ON public.signals
  FOR EACH ROW
  EXECUTE FUNCTION public.emit_signal_detected_event();


-- ─── 6. Incident created (incidents INSERT → event_log) ────────────────────
-- Emits: incident.created

CREATE OR REPLACE FUNCTION public.emit_incident_event()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.event_log (event_type, payload, source_agent, metadata)
  VALUES (
    'incident.created',
    jsonb_build_object(
      'incident_id', NEW.id,
      'severity', NEW.severity,
      'agent', NEW.agent,
      'description', NEW.description
    ),
    NEW.agent,
    jsonb_build_object('table', 'incidents', 'trace_id', NEW.trace_id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS incidents_emit_event ON public.incidents;
CREATE TRIGGER incidents_emit_event
  AFTER INSERT ON public.incidents
  FOR EACH ROW
  EXECUTE FUNCTION public.emit_incident_event();


-- ─── 7. Approval requested (approval_requests INSERT → event_log) ──────────
-- Emits: approval.requested

CREATE OR REPLACE FUNCTION public.emit_approval_requested_event()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.event_log (event_type, payload, source_agent, metadata)
  VALUES (
    'approval.requested',
    jsonb_build_object(
      'approval_id', NEW.id,
      'agent', NEW.agent,
      'skill', NEW.skill,
      'urgency', NEW.urgency,
      'expires_at', NEW.expires_at
    ),
    NEW.agent,
    jsonb_build_object('table', 'approval_requests', 'trace_id', NEW.trace_id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS approvals_emit_event ON public.approval_requests;
CREATE TRIGGER approvals_emit_event
  AFTER INSERT ON public.approval_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.emit_approval_requested_event();
