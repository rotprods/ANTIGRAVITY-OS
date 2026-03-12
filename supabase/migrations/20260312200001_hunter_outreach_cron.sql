-- Hunter: qualify 3 leads every hour (safe limit to avoid timeout)
SELECT cron.unschedule('hunter-qualify-loop') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'hunter-qualify-loop'
);

SELECT cron.schedule(
  'hunter-qualify-loop',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://yxzdafptqtcvpsbqkmkm.supabase.co/functions/v1/agent-hunter',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret', true)
    ),
    body := '{"action":"cycle","limit":3}'::jsonb
  ) AS request_id;
  $$
);

-- Outreach: stage new emails every 2 hours from qualified leads
SELECT cron.unschedule('outreach-stage-cycle') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'outreach-stage-cycle'
);

SELECT cron.schedule(
  'outreach-stage-cycle',
  '30 */2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://yxzdafptqtcvpsbqkmkm.supabase.co/functions/v1/agent-outreach',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret', true)
    ),
    body := '{"action":"cycle","limit":10}'::jsonb
  ) AS request_id;
  $$
);
