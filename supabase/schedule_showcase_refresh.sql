-- Turns on the daily showcase refresh: every day at 03:00 UTC, pg_cron calls the
-- showcase-refresh Edge Function, which adds new gallery picks (never deletes).
-- Apply once, after approving a recurring job:
--   .\node_modules\.bin\supabase db query --linked -f supabase/schedule_showcase_refresh.sql
-- Turn it off with: select cron.unschedule('showcase-refresh-daily');

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'showcase-refresh-daily',
  '0 3 * * *',
  $job$
    select net.http_post(
      url := 'https://kolzsxfgqodulzteocnd.supabase.co/functions/v1/showcase-refresh',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    );
  $job$
);
