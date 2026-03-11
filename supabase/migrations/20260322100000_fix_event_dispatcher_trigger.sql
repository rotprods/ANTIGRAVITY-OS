-- ═══════════════════════════════════════════════════════════════════════════
-- OCULOPS — Fix event_dispatcher trigger
--
-- Root cause: dispatch_event_to_n8n() reads app.settings.supabase_url via
-- current_setting() but that setting was never configured → always NULL →
-- trigger returned early on every event_log INSERT → n8n never received events.
--
-- Fix: hardcode the project URL directly in the trigger function.
-- service_role_key removed — event-dispatcher deployed with --no-verify-jwt.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.dispatch_event_to_n8n()
RETURNS trigger AS $$
BEGIN
  PERFORM net.http_post(
    url     := 'https://yxzdafptqtcvpsbqkmkm.supabase.co/functions/v1/event-dispatcher',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := jsonb_build_object(
      'event_type', NEW.event_type,
      'payload',    NEW.payload,
      'id',         NEW.id,
      'created_at', NEW.created_at,
      'user_id',    NEW.user_id
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS event_log_dispatch ON public.event_log;
CREATE TRIGGER event_log_dispatch
    AFTER INSERT ON public.event_log
    FOR EACH ROW
    EXECUTE FUNCTION public.dispatch_event_to_n8n();
