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
  };
  // Galleries aren't credited on the public site, so their names and counts aren't shown here.
  const [showcase, { viewCounts, categoryCounts }] = await Promise.all([
    cachedShowcasePage({ ...filters, limit: FIRST_SCREEN }),
    cachedDirectoryCounts(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-[100rem] flex-1 flex-col gap-10 px-4 pb-24 sm:px-6 lg:px-10">
      {/* The first cards' pictures come from Cloudflare Pages: open that connection while the HTML streams (React moves it into <head>). */}
      <link rel="preconnect" href={THUMBS_SMALL} />
      <link rel="preconnect" href={THUMBS} />
      <header className="relative isolate flex flex-col items-center gap-5 pt-14 pb-2 text-center sm:py-20">
        <HeroDecor />
        <p className="rounded-full border bg-card/80 px-3 py-1 font-mono text-xs text-muted-foreground backdrop-blur">
          <b className="font-medium text-foreground">{viewCounts.all.toLocaleString("en-US")}</b> sites · free
        </p>
        <h1 className="max-w-[16ch] text-4xl font-semibold tracking-[-0.035em] text-balance sm:text-6xl">{SITE_TAGLINE}</h1>
        <p className="max-w-[56ch] text-balance text-muted-foreground sm:text-lg">
          {SITE_NAME} collects well-designed sites from around the web, keeps the ones worth your time, and lets
          you search all of them at once. No paywall, no sign-up to browse.
        </p>
      </header>
      <Directory
        showcase={showcase.items}
        viewCounts={viewCounts}
        categoryCounts={categoryCounts}
        initialFilters={filters}
        initialTotal={showcase.total}
      />
    </main>
  );
}
