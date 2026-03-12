-- ═══════════════════════════════════════════════════════════════════════════
-- OCULOPS — EVOLVER Cron Schedule
--
-- Runs evolver-loop every night at 02:00 UTC.
-- Uses the same pg_cron + net.http_post pattern as other OCULOPS agents.
-- ═══════════════════════════════════════════════════════════════════════════

-- Remove any stale evolver job
SELECT cron.unschedule('evolver-nightly') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'evolver-nightly'
);

-- Schedule: every night at 02:00 UTC
SELECT cron.schedule(
  'evolver-nightly',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://yxzdafptqtcvpsbqkmkm.supabase.co/functions/v1/evolver-loop',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret', true)
    ),
    body    := '{}'::jsonb
  );
  $$
);
