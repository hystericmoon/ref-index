import { HeroDecor } from "@/components/hero-decor";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/brand";
import { getViewCounts, listGalleryCounts, searchShowcase } from "@/lib/db/showcase";
import { listSources } from "@/lib/db/sources";
import type { DirectorySource } from "@/lib/directory";
import { createPublicClient } from "@/lib/supabase/public";
import { Directory } from "./directory";

/** The HTML carries one screenful of top picks; search and paging go through /showcase.json. */
const FIRST_SCREEN = 60;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const db = createPublicClient();
  const [params, sources, showcase, galleryCounts, viewCounts] = await Promise.all([
    searchParams,
    listSources(db),
    searchShowcase(db, { limit: FIRST_SCREEN, view: "top" }),
    listGalleryCounts(db),
    getViewCounts(db),
  ]);
  const view = params.view === "galleries" ? "galleries" : "showcase";
  const q = typeof params.q === "string" ? params.q.slice(0, 100) : "";

  const directory: DirectorySource[] = sources.map((s) => ({
    id: s.id,
    name: s.name,
    homeUrl: s.home_url,
    mediums: s.mediums,
    kind: s.kind as DirectorySource["kind"],
    urlTemplate: s.url_template,
    confirmed: s.confirmed,
    pricing: s.pricing,
    description: s.description,
    thumbUrl: s.thumb_path,
  }));

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 pb-24 sm:px-6">
      <header className="relative isolate flex flex-col items-center gap-5 py-14 text-center sm:py-20">
        <HeroDecor />
        <p className="rounded-full border bg-card/80 px-3 py-1 font-mono text-xs text-muted-foreground backdrop-blur">
          <b className="font-medium text-foreground">{viewCounts.all.toLocaleString("en-US")}</b> sites ·{" "}
          {galleryCounts.length} galleries · free
        </p>
        <h1 className="max-w-[16ch] text-4xl font-semibold tracking-[-0.035em] text-balance sm:text-6xl">{SITE_TAGLINE}</h1>
        <p className="max-w-[56ch] text-balance text-muted-foreground sm:text-lg">
          {SITE_NAME} collects the sites that design galleries pick, keeps the ones worth your time, and lets you
          search all of them at once. No paywall, no sign-up to browse.
        </p>
      </header>
      <Directory
        sources={directory}
        showcase={showcase.items}
        viewCounts={viewCounts}
        galleryCounts={galleryCounts}
        initialView={view}
        initialQuery={q}
      />
    </main>
  );
}
