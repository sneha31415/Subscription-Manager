-- =====================================================================
-- OPTIONAL — only needed for cloud push reminders and server-side
-- exchange-rate refresh. Run AFTER deploying the Edge Functions and
-- setting the CRON_SECRET secret (see README, "Cloud push reminders").
--
-- 1. Replace <PROJECT_REF> with your Supabase project reference
--    (the xxxx in https://xxxx.supabase.co)
-- 2. Replace <CRON_SECRET> with the same secret you set for the functions
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Every hour at :05 — sends reminders for users whose local reminder hour matches
select cron.schedule(
  'subtrack-send-reminders',
  '5 * * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object('x-cron-secret', '<CRON_SECRET>', 'Content-Type', 'application/json'),
    body    := '{}'::jsonb
  );
  $$
);

-- Every 6 hours — refreshes the shared exchange-rate table
select cron.schedule(
  'subtrack-refresh-rates',
  '0 */6 * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/refresh-rates',
    headers := jsonb_build_object('x-cron-secret', '<CRON_SECRET>', 'Content-Type', 'application/json'),
    body    := '{}'::jsonb
  );
  $$
);
