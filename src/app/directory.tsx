"use client";

import { ChevronDown, Search, Sparkles } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { amEditor } from "@/app/curate/actions";
import { Beam, LiquidSwitch, Orb } from "@/components/effects";
import { CATEGORIES } from "@/lib/categories";
import type { CategoryCounts, ShowcaseEntry, ShowcaseView as Curation } from "@/lib/db/showcase";

// Curation controls only load for editors, so visitors don't download them.
const EditorTools = dynamic(() => import("@/app/curate/editor-tools").then((m) => m.EditorTools));

/** How wide a card's picture shows: one column fills the screen on phones; in the grid a card is at most ~420px. */
const CARD_SIZES = "(max-width: 600px) calc(100vw - 2rem), 420px";

const PLATFORM_LABEL: Record<string, string> = { web: "Web", "3d": "3D", ios: "iOS", android: "Android", mobile: "App" };

/** Supabase keeps the session in readable `sb-…-auth-token` cookies; without one nobody is signed in. */
const mightBeSignedIn = () => /(?:^|; )sb-[^=]*-auth-token/.test(document.cookie);

type Filters = { view: Curation; q: string; category: string; gallery: string };

function hostOf(url: string | null) {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Keep the filters in the URL so a link, a reload or the Back button reproduces what you see. */
function useUrlState({ view, q, category, gallery }: Filters) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const set = (k: string, v: string) => (v ? params.set(k, v) : params.delete(k));
    set("view", view === "top" ? "" : view);
    set("q", q.trim());
    set("category", category);
    set("gallery", gallery);
    const search = params.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${search ? `?${search}` : ""}`);
  }, [view, q, category, gallery]);
}

function SearchField({
  id,
  label,
  value,
  onChange,
  placeholder,
  busy = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  busy?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Beam size="line" colorVariant="ocean" active={focused || busy} strength={0.9}>
    <div className="flex items-center gap-2 rounded-full border bg-card px-4 shadow-sm transition-colors focus-within:border-ring/60">
      <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className="h-12 min-w-0 flex-1 bg-transparent text-base font-medium outline-none placeholder:text-muted-foreground sm:text-lg"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="min-h-11 rounded-full px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          Clear
        </button>
      )}
    </div>
    </Beam>
  );
}

type ShowcasePage = { items: ShowcaseEntry[]; total: number };

function showcaseUrl(view: Curation, q: string, category: string, gallery: string, offset: number) {
  const params = new URLSearchParams();
  if (view !== "top") params.set("view", view);
  if (q.trim()) params.set("q", q.trim());
  if (category) params.set("category", category);
  if (gallery) params.set("gallery", gallery);
  if (offset) params.set("offset", String(offset));
  return `/showcase.json${params.size ? `?${params}` : ""}`;
}

/** One row of category chips: what kind of site, then what field. Empty categories are left out. */
function CategoryChips({ value, onChange, counts }: { value: string; onChange: (id: string) => void; counts: Record<string, number> }) {
  const chip = (id: string, label: string, n?: number) => (
    <button
      key={id || "all"}
      type="button"
      aria-pressed={value === id}
      onClick={() => onChange(value === id ? "" : id)}
      className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border bg-card px-3.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground sm:min-h-9"
    >
      {label}
      {n !== undefined && <span className="font-mono text-[11px] opacity-70">{n.toLocaleString("en-US")}</span>}
    </button>
  );
  const shown = CATEGORIES.filter((c) => counts[c.id] || c.id === value);
  return (
    <div role="group" aria-label="Category" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
      {chip("", "All categories")}
      {shown.filter((c) => c.group === "type").map((c) => chip(c.id, c.label, counts[c.id] ?? 0))}
      <span aria-hidden="true" className="mx-1 w-px shrink-0 self-stretch bg-border" />
      {shown.filter((c) => c.group === "industry").map((c) => chip(c.id, c.label, counts[c.id] ?? 0))}
    </div>
  );
}

/** Memoized: typing in search or switching filters re-renders the controls, not 60 cards. */
const ShowcaseCard = memo(function ShowcaseCard({
  entry: e,
  editor,
  onHidden,
  first,
}: {
  entry: ShowcaseEntry;
  editor: boolean;
  onHidden: (id: string) => void;
  /** In the first row on a wide screen: loaded right away instead of when scrolled near. */
  first: boolean;
}) {
  const href = e.url ?? e.featured[0]?.sourceUrl;
  const router = useRouter();
  const site = `/site/${e.id}`;
  // Panels load on intent (hover, focus, touch) rather than for all 60 cards on screen at once.
  const prefetch = () => router.prefetch(site);
  const picture = (
    // The picture opens the site's detail panel over the list; the name below goes straight to the live site.
    <Link
      href={site}
      prefetch={false}
      onPointerEnter={prefetch}
      onTouchStart={prefetch}
      onFocus={prefetch}
      scroll={false}
      aria-label={`${e.name}: full page and inner pages`}
      className="group block aspect-[16/10] overflow-hidden rounded-2xl border bg-muted"
    >
      {e.thumbUrl ? (
        // A plain img: next/image doesn't take a hand-written srcSet. Cards are ~290-420 CSS px wide
        // (full width under 600px), so most screens get the 720px copy and only 2x+ screens the 1280px one.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={e.thumbUrl}
          srcSet={e.thumbSmallUrl ? `${e.thumbSmallUrl} 720w, ${e.thumbUrl} 1280w` : undefined}
          sizes={e.thumbSmallUrl ? CARD_SIZES : undefined}
          alt=""
          width={1280}
          height={800}
          loading={first ? "eager" : "lazy"}
          fetchPriority={first ? "high" : "auto"}
          decoding="async"
          className="size-full object-cover object-top transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none"
        />
      ) : (
        <span className="dot-grid flex size-full items-center justify-center p-6 text-center text-xl font-semibold tracking-tight text-balance break-words text-muted-foreground">
          {e.name}
        </span>
      )}
    </Link>
  );
  return (
    <li className="flex min-w-0 flex-col gap-2.5">
      {e.staffPick ? (
        <Beam size="pulse-inner" colorVariant="ocean" strength={0.8}>
          {picture}
        </Beam>
      ) : (
        picture
      )}
      <div className="flex flex-col gap-1 px-1">
        <div className="flex items-center justify-between gap-3">
          <a
            href={href}
            target="_blank"
            rel="noopener"
            className="flex min-h-11 items-center font-semibold tracking-tight break-words hover:underline focus-visible:underline sm:min-h-0"
          >
            {e.name}
            <span className="sr-only"> (opens in new tab)</span>
          </a>
          <span className="shrink-0 font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
            {PLATFORM_LABEL[e.platform] ?? e.platform}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {e.staffPick && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 font-medium text-accent-foreground">
              <Sparkles className="size-3" aria-hidden="true" /> Staff pick
            </span>
          )}
          <span className="font-mono">{e.url ? hostOf(e.url) : `Opens ${e.featured[0]?.gallery} page`}</span>
        </div>
        <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          {e.galleryCount > 1 ? `Featured on ${e.galleryCount} galleries:` : "Featured on"}
          {e.featured.map((f, i) => (
            <span key={f.gallery} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden="true">·</span>}
              {/* Out of the Tab order, so a page of cards isn't hundreds of stops: the detail panel lists the same links. */}
              <a
                href={f.sourceUrl}
                target="_blank"
                rel="noopener"
                tabIndex={-1}
                className="inline-flex min-h-11 items-center font-medium text-link hover:underline sm:min-h-0 sm:py-1"
              >
                {f.gallery}
                <span className="sr-only"> (opens {e.name} on {f.gallery} in a new tab)</span>
              </a>
            </span>
          ))}
        </p>
        {editor && <EditorTools item={e} onHidden={() => onHidden(e.id)} />}
      </div>
    </li>
  );
});

const CURATION_LABEL: Record<Curation, string> = { top: "Top picks", all: "Everything", archive: "Archive" };
const CURATION_NOTE: Record<Curation, string> = {
  top: "Staff picks and sites featured by two or more galleries.",
  all: "Every live site and app from the 13 galleries.",
  archive: "Sites that have gone offline, been parked or block visitors. Kept for the record.",
};

function ShowcaseView({
  initial,
  counts,
  categoryCounts,
  galleries,
  initialFilters,
  initialTotal,
}: {
  initial: ShowcaseEntry[];
  counts: Record<Curation, number>;
  categoryCounts: CategoryCounts;
  galleries: [string, number][];
  initialFilters: Filters;
  initialTotal: number;
}) {
  // Filtering and paging run in the database; the page ships the first 60 matches for the URL's filters.
  const [curation, setCuration] = useState<Curation>(initialFilters.view);
  const total = counts[curation];
  const [entries, setEntries] = useState(initial);
  const [matchTotal, setMatchTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState(initialFilters.q);
  const [category, setCategory] = useState(initialFilters.category);
  const [gallery, setGallery] = useState(initialFilters.gallery);
  useUrlState({ view: curation, q, category, gallery });
  const firstRender = useRef(true);
  const request = useRef(0);
  // Editors get curation tools on each card; everyone else sees the plain page.
  const [editor, setEditor] = useState(false);
  useEffect(() => {
    // Signed-out visitors (most of them) skip the round trip to the server.
    if (mightBeSignedIn()) amEditor().then(setEditor, () => {});
  }, []);
  const onHidden = useCallback((id: string) => {
    setEntries((prev) => prev.filter((x) => x.id !== id));
    setMatchTotal((n) => n - 1);
  }, []);

  async function load(offset: number) {
    const id = ++request.current;
    setLoading(true);
    try {
      const res = await fetch(showcaseUrl(curation, q, category, gallery, offset));
      if (!res.ok) throw new Error(String(res.status));
      const page = (await res.json()) as ShowcasePage;
      if (id !== request.current) return;
      setEntries((prev) => (offset ? [...prev, ...page.items] : page.items));
      setMatchTotal(page.total);
    } catch {
      // Keep what's shown; the next change retries.
    } finally {
      if (id === request.current) setLoading(false);
    }
  }

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timer = window.setTimeout(() => load(0), 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the filters change
  }, [curation, q, category, gallery]);

  const list = entries;

  return (
    <div className="flex flex-col gap-5" aria-busy={loading}>
      <SearchField id="showcase-q" label="Search showcase" value={q} onChange={setQ} placeholder="Search sites, tags or galleries" busy={loading} />
      <div className="flex flex-col gap-5 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-6 lg:gap-y-3">
        <LiquidSwitch
          label="Collection"
          value={curation}
          onChange={setCuration}
          options={(["top", "all", "archive"] as const).map((c) => ({
            value: c,
            label: (
              <>
                {CURATION_LABEL[c]} <span className="ml-1 hidden font-mono text-xs text-muted-foreground sm:inline">{counts[c].toLocaleString("en-US")}</span>
              </>
            ),
          }))}
        />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Featured on
          <span className="relative flex items-center">
            <select
              value={gallery}
              onChange={(e) => setGallery(e.target.value)}
              className="min-h-11 cursor-pointer appearance-none rounded-full border bg-card pr-9 pl-4 text-sm text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:min-h-9"
            >
              <option value="">All galleries</option>
              {galleries.map(([g, n]) => (
                <option key={g} value={g}>
                  {g} ({n})
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3.5 size-4 text-muted-foreground" aria-hidden="true" />
          </span>
        </label>
      </div>
      <CategoryChips
        value={category}
        onChange={setCategory}
        counts={Object.fromEntries(Object.entries(categoryCounts).map(([id, n]) => [id, n[curation]]))}
      />
      <p aria-live="polite" className="flex min-h-6 flex-wrap items-center gap-x-2 text-sm text-muted-foreground tabular-nums">
        {matchTotal === total ? (
          <span>
            <b className="font-semibold text-foreground">{total.toLocaleString("en-US")}</b> sites and apps.
          </span>
        ) : (
          <span>
            <b className="font-semibold text-foreground">{matchTotal.toLocaleString("en-US")}</b> of {total.toLocaleString("en-US")} sites and apps.
          </span>
        )}
        <span>{CURATION_NOTE[curation]}</span>
        {loading && (
          <span className="inline-flex items-center gap-1.5">
            <Orb label="Updating results" /> Updating…
          </span>
        )}
      </p>
      {list.length === 0 && !loading ? (
        <p className="rounded-2xl border border-dashed bg-card p-8 text-center text-muted-foreground">
          Nothing matches. Try a broader word or clear the filters.
        </p>
      ) : (
        <ul className="grid gap-x-4 gap-y-6 [grid-template-columns:repeat(auto-fill,minmax(17rem,1fr))]">
          {list.map((e, i) => (
            <ShowcaseCard
              key={e.id}
              entry={e}
              first={i < 5}
              editor={editor}
              onHidden={onHidden}
            />
          ))}
        </ul>
      )}
      {list.length < matchTotal && (
        <button
          type="button"
          disabled={loading}
          onClick={() => load(list.length)}
          className="mx-auto inline-flex min-h-11 items-center gap-2 rounded-full border bg-card px-5 text-sm font-semibold hover:border-ring/60 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-70"
        >
          {loading ? (
            <>
              <Orb label="Loading more" state="working" /> Loading…
            </>
          ) : (
            `Show more (${(matchTotal - list.length).toLocaleString("en-US")} left)`
          )}
        </button>
      )}
      <p className="max-w-[72ch] border-t pt-4 text-sm text-muted-foreground">
        Collected from 13 design galleries&apos; listings, refreshed daily, then curated: top picks are sites
        that several galleries agree on plus our own staff picks, and dead or parked sites move to the archive.
        Screenshots are our own captures of each live site. Sponsored placements are left out.
      </p>
    </div>
  );
}

export function Directory({
  showcase,
  viewCounts,
  categoryCounts,
  galleryCounts,
  initialFilters,
  initialTotal,
}: {
  showcase: ShowcaseEntry[];
  viewCounts: Record<Curation, number>;
  categoryCounts: CategoryCounts;
  galleryCounts: [string, number][];
  initialFilters: Filters;
  initialTotal: number;
}) {
  return (
    <ShowcaseView
      initial={showcase}
      counts={viewCounts}
      categoryCounts={categoryCounts}
      galleries={galleryCounts}
      initialFilters={initialFilters}
      initialTotal={initialTotal}
    />
  );
}
