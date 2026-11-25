import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME } from "@/lib/brand";
import { cachedPageTypeCounts, cachedShowcasePages } from "@/lib/db/showcase-cache";
import { PAGE_PATTERNS, PAGE_PATTERN_IDS, PAGE_TYPES, PAGE_TYPE_IDS, pageTypeLabel } from "@/lib/page-types";

export const metadata: Metadata = {
  title: "Browse by page type",
  description: `Pricing pages, about pages, case studies and more from well-designed sites, on ${SITE_NAME}.`,
};

const LIMIT = 48;

const chip = (active: boolean) =>
  `inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none ${
    active ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
  }`;

/** Every tagged page screenshot, filtered by page type and design pattern (filters live in the URL). */
export default async function PagesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const one = (k: string) => (typeof params[k] === "string" ? params[k] : "");
  const type = PAGE_TYPE_IDS.has(one("type")) ? one("type") : "";
  const pattern = PAGE_PATTERN_IDS.has(one("pattern")) ? one("pattern") : "";
  const offset = Math.min(Math.max(Number(one("offset")) || 0, 0), 5000);
  const [{ items, total }, counts] = await Promise.all([
    cachedShowcasePages({ type: type || undefined, pattern: pattern || undefined, offset, limit: LIMIT }),
    cachedPageTypeCounts(),
  ]);
  const href = (next: { type?: string; pattern?: string; offset?: number }) => {
    const q = new URLSearchParams();
    const t = next.type ?? type;
    const p = next.pattern ?? pattern;
    if (t) q.set("type", t);
    if (p) q.set("pattern", p);
    if (next.offset) q.set("offset", String(next.offset));
    const qs = q.toString();
    return qs ? `/pages?${qs}` : "/pages";
  };

  return (
    <main className="mx-auto flex w-full max-w-[100rem] flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12 lg:px-10">
      <header className="flex flex-col gap-2">
        <Link href="/" className="text-sm text-muted-foreground hover:underline">
          ← All sites
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Browse by page type</h1>
        <p className="max-w-[56ch] text-muted-foreground">
          {total.toLocaleString("en-US")} {pageTypeLabel(type)?.toLowerCase() ?? "page"} screenshots from curated sites. Tags were assigned by
          looking at the screenshots.
        </p>
      </header>

      <nav aria-label="Page type" className="flex flex-wrap gap-2">
        <Link href={href({ type: "" })} aria-current={!type ? "true" : undefined} className={chip(!type)}>
          All
        </Link>
        {PAGE_TYPES.filter((t) => counts[t.id]).map((t) => (
          <Link key={t.id} href={href({ type: t.id })} aria-current={type === t.id ? "true" : undefined} className={chip(type === t.id)}>
            {t.label} <span className="ml-1.5 opacity-70">{counts[t.id]}</span>
          </Link>
        ))}
      </nav>
      <nav aria-label="Pattern" className="flex flex-wrap gap-2">
        {PAGE_PATTERNS.map((p) => (
          <Link key={p} href={href({ pattern: pattern === p ? "" : p })} aria-current={pattern === p ? "true" : undefined} className={chip(pattern === p)}>
            {p}
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">No pages match these filters.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((p) => (
            <li key={p.imageUrl} className="flex min-w-0 flex-col gap-2">
              <Link href={`/site/${p.site.id}`} className="group flex flex-col gap-2">
                <span className="block aspect-[16/10] overflow-hidden rounded-2xl border bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.imageUrl} alt="" width={1280} height={800} loading="lazy" decoding="async" className="size-full object-cover object-top" />
                </span>
                <span className="truncate px-1 text-sm font-medium group-hover:underline">
                  {p.site.name}
                  <span className="font-normal text-muted-foreground"> · {pageTypeLabel(p.type) ?? "Page"}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {total > offset + LIMIT && (
        <Link href={href({ offset: offset + LIMIT })} className={`${chip(false)} self-center`}>
          Show more
        </Link>
      )}
    </main>
  );
}
