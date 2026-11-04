-- Turns on the daily showcase refresh: every day from 03:00 UTC, pg_cron calls the showcase-refresh
-- Edge Function once per slice of galleries (6 slices, 5 minutes apart; one call can't read them all),
-- which adds new gallery picks (never deletes).
-- Apply after deploying the function (supabase functions deploy showcase-refresh --no-verify-jwt):
--   .\node_modules\.bin\supabase db query --linked -f supabase/schedule_showcase_refresh.sql
-- Turn it off with: select cron.unschedule(jobname) from cron.job where jobname like 'showcase-refresh-%';

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- The single job from before slices.
select cron.unschedule('showcase-refresh-daily') where exists (select 1 from cron.job where jobname = 'showcase-refresh-daily');

select cron.schedule(
  'showcase-refresh-slice-' || s,
  (s * 5) || ' 3 * * *',
  format($job$
    select net.http_post(
      url := 'https://kolzsxfgqodulzteocnd.supabase.co/functions/v1/showcase-refresh?slice=%s',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    );
  $job$, s)
)
from generate_series(0, 5) as s;
