import { HeroDecor } from "@/components/hero-decor";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/brand";
import { CATEGORY_IDS } from "@/lib/categories";
import { SHOWCASE_VIEWS, THUMBS, THUMBS_SMALL, type ShowcaseView } from "@/lib/db/showcase";
import { cachedDirectoryCounts, cachedShowcasePage } from "@/lib/db/showcase-cache";
import { Directory } from "./directory";

/** The HTML carries one screenful of top picks; search and paging go through /showcase.json. */
const FIRST_SCREEN = 60;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Filters live in the URL, so a shared link or the Back button shows the same results.
  const params = await searchParams;
  const one = (k: string) => (typeof params[k] === "string" ? params[k] : "");
  const filters = {
    q: one("q").slice(0, 100),
    view: SHOWCASE_VIEWS.includes(one("view") as ShowcaseView) ? (one("view") as ShowcaseView) : "top",
    category: CATEGORY_IDS.has(one("category")) ? one("category") : "",
    gallery: one("gallery").slice(0, 60),
  };
  const [showcase, { sources, galleryCounts, viewCounts, categoryCounts }] = await Promise.all([
    cachedShowcasePage({ ...filters, limit: FIRST_SCREEN }),
    cachedDirectoryCounts(),
  ]);
  // The galleries the showcase is collected from, credited and linked at the foot of the page.
  const featured = new Set(galleryCounts.map(([g]) => g));
  const galleries = sources.filter((s) => featured.has(s.name)).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <main className="mx-auto flex w-full max-w-[100rem] flex-1 flex-col gap-10 px-4 pb-24 sm:px-6 lg:px-10">
      {/* The first cards' pictures come from Cloudflare Pages: open that connection while the HTML streams (React moves it into <head>). */}
      <link rel="preconnect" href={THUMBS_SMALL} />
      <link rel="preconnect" href={THUMBS} />
      <header className="relative isolate flex flex-col items-center gap-5 pt-14 pb-2 text-center sm:py-20">
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
        showcase={showcase.items}
        viewCounts={viewCounts}
        categoryCounts={categoryCounts}
        galleryCounts={galleryCounts}
        initialFilters={filters}
        initialTotal={showcase.total}
      />
      <footer className="flex flex-col gap-2 border-t pt-4 text-sm text-muted-foreground">
        <h2 className="font-medium text-foreground">The galleries</h2>
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {galleries.map((g) => (
            <li key={g.id}>
              <a href={g.home_url} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center hover:text-foreground hover:underline sm:min-h-0">
                {g.name}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
      </footer>
    </main>
  );
}
