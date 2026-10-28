import { interleaveByGallery, listShowcase } from "@/lib/db/showcase";
import { listSources } from "@/lib/db/sources";
import type { DirectorySource } from "@/lib/directory";
import { createPublicClient } from "@/lib/supabase/public";
import { Directory } from "./directory";

/** The HTML carries one screenful of showcase entries; the rest loads from /showcase.json. */
const FIRST_SCREEN = 60;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const db = createPublicClient();
  const [params, sources, showcase] = await Promise.all([searchParams, listSources(db), listShowcase(db)]);
  const view = params.view === "galleries" ? "galleries" : "showcase";
  const q = typeof params.q === "string" ? params.q.slice(0, 100) : "";

  const galleryCounts = new Map<string, number>();
  for (const e of showcase) for (const f of e.featured) galleryCounts.set(f.gallery, (galleryCounts.get(f.gallery) ?? 0) + 1);

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
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-7 px-4 pb-24 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-4xl font-bold tracking-tight text-balance sm:text-5xl">Ref Index</h1>
        <p className="max-w-[62ch] text-muted-foreground">
          Websites and apps picked by {galleryCounts.size} design galleries, collected in one place, plus one search box
          for {sources.length} galleries&apos; own search and tag pages.
        </p>
      </header>
      <Directory
        sources={directory}
        showcase={interleaveByGallery(showcase).slice(0, FIRST_SCREEN)}
        showcaseTotal={showcase.length}
        galleryCounts={[...galleryCounts].sort(([a], [b]) => a.localeCompare(b))}
        initialView={view}
        initialQuery={q}
      />
    </main>
  );
}
