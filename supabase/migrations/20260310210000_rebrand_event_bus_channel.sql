-- Rebrand: update pg_notify channel from antigravity:events to oculops:events
CREATE OR REPLACE FUNCTION public.notify_event_bus()
RETURNS trigger AS $$
BEGIN
    PERFORM pg_notify('oculops:events', row_to_json(NEW)::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
