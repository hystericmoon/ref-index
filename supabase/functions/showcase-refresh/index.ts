// Weekly showcase refresh, called by pg_cron (see migration 20261029000100). Reads each
// gallery's newest picks and adds new names and gallery links; never deletes or edits.
// Deployed without JWT verification so cron needs no stored key; a run log limits it to
// one run per 12 hours, so calling it can't be used to hammer the galleries.

import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { readAllGalleries } from "./galleries.ts";

const MIN_HOURS_BETWEEN_RUNS = 12;

Deno.serve(async () => {
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const { data: last } = await db
    .from("showcase_refresh_runs")
    .select("ran_at")
    .order("ran_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (last && Date.now() - Date.parse(last.ran_at) < MIN_HOURS_BETWEEN_RUNS * 3600_000) {
    return Response.json({ skipped: `last run ${last.ran_at}` }, { status: 429 });
  }
  const { data: run, error: runError } = await db.from("showcase_refresh_runs").insert({}).select("id").single();
  if (runError) return Response.json({ error: runError.message }, { status: 500 });

  const { found, report } = await readAllGalleries();
  const { data: added, error } = await db.rpc("add_showcase_entries", { entries: found });
  const result = { report, read: found.length, added: added ?? null, error: error?.message ?? null };
  await db.from("showcase_refresh_runs").update({ report: result }).eq("id", run.id);
  return Response.json(result, { status: error ? 500 : 200 });
});
