-- ═══════════════════════════════════════════════════
-- OCULOPS Level-7 — Control Plane Event Envelope v2
-- Extends event_log with first-class L7 routing/telemetry fields
-- ═══════════════════════════════════════════════════

ALTER TABLE public.event_log
  ADD COLUMN IF NOT EXISTS tool_id text,
  ADD COLUMN IF NOT EXISTS trace_id uuid,
  ADD COLUMN IF NOT EXISTS latency_ms integer,
  ADD COLUMN IF NOT EXISTS cost_usd numeric(12, 6),
  ADD COLUMN IF NOT EXISTS risk_level text,
  ADD COLUMN IF NOT EXISTS result text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'event_log_risk_level_check'
      AND conrelid = 'public.event_log'::regclass
  ) THEN
    ALTER TABLE public.event_log
      ADD CONSTRAINT event_log_risk_level_check
      CHECK (
        risk_level IS NULL
        OR risk_level IN ('low', 'medium', 'high', 'critical')
      ) NOT VALID;
  END IF;
END $$;

ALTER TABLE public.event_log VALIDATE CONSTRAINT event_log_risk_level_check;

CREATE INDEX IF NOT EXISTS idx_event_log_trace_id ON public.event_log(trace_id);
CREATE INDEX IF NOT EXISTS idx_event_log_tool_id ON public.event_log(tool_id);
CREATE INDEX IF NOT EXISTS idx_event_log_risk_level ON public.event_log(risk_level);
CREATE INDEX IF NOT EXISTS idx_event_log_created_at_desc ON public.event_log(created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'event_log_latency_ms_nonnegative_check'
      AND conrelid = 'public.event_log'::regclass
  ) THEN
    ALTER TABLE public.event_log
      ADD CONSTRAINT event_log_latency_ms_nonnegative_check
      CHECK (latency_ms IS NULL OR latency_ms >= 0) NOT VALID;
  END IF;
END $$;

ALTER TABLE public.event_log VALIDATE CONSTRAINT event_log_latency_ms_nonnegative_check;
