-- OCULOPS — Anomaly Detector Cron
-- Runs anomaly-detector edge function every 30 minutes

SELECT cron.unschedule('anomaly-detector-30min') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'anomaly-detector-30min'
);

SELECT cron.schedule(
  'anomaly-detector-30min',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://yxzdafptqtcvpsbqkmkm.supabase.co/functions/v1/anomaly-detector',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret', true)
    ),
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);
