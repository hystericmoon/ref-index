// Daily showcase refresh, called by pg_cron (see migration 20261029000100). Reads each
// gallery's newest picks and adds new names and gallery links; never deletes or edits.
// Deployed without JWT verification so cron needs no stored key; a run log limits it to
// one run per 12 hours, so calling it can't be used to hammer the galleries.

import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { GALLERIES, readAllGalleries, resolveLive } from "./galleries.ts";

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

  const { found: all, report } = await readAllGalleries();
  // Entries already credited need nothing new, so their entry pages aren't read again. Only for
  // galleries read entry by entry: others credit several items to one listing page.
  const perEntry = new Set(GALLERIES.filter((g) => g.entryLive).map((g) => g.name));
  const srcs = all.filter((f) => perEntry.has(f.gallery)).map((f) => f.src);
  const known = new Set<string>();
  for (let i = 0; i < srcs.length; i += 100) {
    const { data } = await db.from("showcase_features").select("source_url").in("source_url", srcs.slice(i, i + 100));
    for (const row of data ?? []) known.add(row.source_url);
  }
  const found = all.filter((f) => !perEntry.has(f.gallery) || !known.has(f.src));
  await resolveLive(found);
  const { data: added, error } = await db.rpc("add_showcase_entries", { entries: found });
  const result = { report, read: all.length, added: added ?? null, error: error?.message ?? null };
  await db.from("showcase_refresh_runs").update({ report: result }).eq("id", run.id);
  return Response.json(result, { status: error ? 500 : 200 });
});
