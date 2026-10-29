"use client";

import { ExternalLink, Search, Sparkles } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { amEditor } from "@/app/curate/actions";
import { EditorTools } from "@/app/curate/editor-tools";
import { Beam, LiquidSwitch, Orb } from "@/components/effects";
import { CATEGORIES } from "@/lib/categories";
import type { CategoryCounts, ShowcaseEntry, ShowcaseView as Curation } from "@/lib/db/showcase";
import { KIND_RANK, MEDIUM_GROUPS, SUGGESTIONS, sourceAction, type DirectorySource } from "@/lib/directory";
import { cn } from "@/lib/utils";

type View = "showcase" | "galleries";

const PLATFORM_LABEL: Record<string, string> = { web: "Web", "3d": "3D", ios: "iOS", android: "Android", mobile: "App" };

function hostOf(url: string | null) {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Keep the view and search term in the URL so a link reproduces what you see. */
function useUrlState(view: View, q: string) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (view === "galleries") params.set("view", "galleries");
    else params.delete("view");
    if (q.trim()) params.set("q", q.trim());
    else params.delete("q");
    const search = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${search ? `?${search}` : ""}`);
  }, [view, q]);
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
        className="h-12 min-w-0 flex-1 bg-transparent text-lg font-medium outline-none placeholder:text-muted-foreground"
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

function showcaseUrl(view: Curation, q: string, medium: string, category: string, gallery: string, offset: number) {
  const params = new URLSearchParams();
  if (view !== "top") params.set("view", view);
  if (q.trim()) params.set("q", q.trim());
  if (medium !== "all") params.set("medium", medium);
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

function ShowcaseCard({ entry: e, editor, onHidden }: { entry: ShowcaseEntry; editor: boolean; onHidden: () => void }) {
  const href = e.url ?? e.featured[0]?.sourceUrl;
  const picture = (
    // The picture opens the site's detail page; the name below goes straight to the live site.
    <a
      href={`/site/${e.id}`}
      aria-label={`${e.name}: full page and inner pages`}
      className="group block aspect-[16/10] overflow-hidden rounded-2xl border bg-muted"
    >
      {e.thumbUrl ? (
        <Image
          src={e.thumbUrl}
          alt=""
          width={640}
          height={400}
          unoptimized
          loading="lazy"
          className="size-full object-cover object-top transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none"
        />
      ) : (
        <span className="dot-grid flex size-full items-center justify-center p-6 text-center text-xl font-semibold tracking-tight text-balance break-words text-muted-foreground">
          {e.name}
        </span>
      )}
    </a>
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
        <div className="flex items-baseline justify-between gap-3">
          <a href={href} target="_blank" rel="noopener" className="font-semibold tracking-tight break-words hover:underline focus-visible:underline">
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
              <a href={f.sourceUrl} target="_blank" rel="noopener" className="py-1 font-medium text-primary hover:underline">
                {f.gallery}
                <span className="sr-only"> (opens {e.name} on {f.gallery} in a new tab)</span>
              </a>
            </span>
          ))}
        </p>
        {editor && <EditorTools item={e} onHidden={onHidden} />}
      </div>
    </li>
  );
}

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
}: {
  initial: ShowcaseEntry[];
  counts: Record<Curation, number>;
  categoryCounts: CategoryCounts;
  galleries: [string, number][];
}) {
  // Filtering and paging run in the database; the page ships the first 60 top picks.
  const [curation, setCuration] = useState<Curation>("top");
  const total = counts[curation];
  const [entries, setEntries] = useState(initial);
  const [matchTotal, setMatchTotal] = useState(total);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [medium, setMedium] = useState<"all" | "web" | "3d" | "mobile">("all");
  const [category, setCategory] = useState("");
  const [gallery, setGallery] = useState("");
  const firstRender = useRef(true);
  const request = useRef(0);
  // Editors get curation tools on each card; everyone else sees the plain page.
  const [editor, setEditor] = useState(false);
  useEffect(() => {
    amEditor().then(setEditor, () => {});
  }, []);

  async function load(offset: number) {
    const id = ++request.current;
    setLoading(true);
    try {
      const res = await fetch(showcaseUrl(curation, q, medium, category, gallery, offset));
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
  }, [curation, q, medium, category, gallery]);

  const list = entries;

  return (
    <div className="flex flex-col gap-5" aria-busy={loading}>
      <SearchField id="showcase-q" label="Search showcase" value={q} onChange={setQ} placeholder="Search by name, domain, tag or gallery" busy={loading} />
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <LiquidSwitch
          label="Medium"
          value={medium}
          onChange={setMedium}
          options={[
            { value: "all", label: "All" },
            { value: "web", label: "Web" },
            { value: "3d", label: "3D & WebGL" },
            { value: "mobile", label: "Mobile apps" },
          ]}
        />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Featured on
          <select
            value={gallery}
            onChange={(e) => setGallery(e.target.value)}
            className="min-h-11 rounded-full border bg-card px-3 text-sm text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:min-h-9"
          >
            <option value="">All galleries</option>
            {galleries.map(([g, n]) => (
              <option key={g} value={g}>
                {g} ({n})
              </option>
            ))}
          </select>
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
          {list.map((e) => (
            <ShowcaseCard
              key={e.id}
              entry={e}
              editor={editor}
              onHidden={() => {
                setEntries((prev) => prev.filter((x) => x.id !== e.id));
                setMatchTotal((n) => n - 1);
              }}
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

function GalleriesView({ sources, q, setQ }: { sources: DirectorySource[]; q: string; setQ: (v: string) => void }) {
  const [medium, setMedium] = useState<"all" | "web" | "mobile" | "motion">("all");
  const [onlySearch, setOnlySearch] = useState(false);
  const term = q.trim();

  const groups = MEDIUM_GROUPS.map((group) => {
    const items = sources.filter(
      (s) =>
        (s.mediums[0] ?? "web") === group.id &&
        (medium === "all" || s.mediums.includes(medium)) &&
        !(onlySearch && s.kind === "none"),
    );
    if (term) items.sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind]);
    return { ...group, items };
  }).filter((g) => g.items.length > 0);

  const shown = groups.flatMap((g) => g.items);
  const count = (kind: DirectorySource["kind"]) => shown.filter((s) => s.kind === kind).length;

  return (
    <div className="flex flex-col gap-5">
      <div role="search" className="flex flex-col gap-3">
        <SearchField id="galleries-q" label="Pattern or screen" value={q} onChange={setQ} placeholder="e.g. onboarding, pricing, empty state" />
        <div className="flex flex-wrap items-center gap-2" aria-label="Common patterns" role="group">
          <span className="text-xs tracking-widest text-muted-foreground uppercase">Try</span>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={term.toLowerCase() === s}
              onClick={() => setQ(s)}
              className="min-h-11 rounded-full border bg-card px-3 text-sm font-medium hover:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground sm:min-h-8"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <LiquidSwitch
          label="Medium"
          value={medium}
          onChange={setMedium}
          options={[
            { value: "all", label: "All" },
            { value: "web", label: "Web" },
            { value: "mobile", label: "Mobile apps" },
            { value: "motion", label: "3D & motion" },
          ]}
        />
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={onlySearch} onChange={(e) => setOnlySearch(e.target.checked)} className="size-4 accent-primary" />
          Only sites that take a search term
        </label>
      </div>

      <p aria-live="polite" className="text-sm text-muted-foreground tabular-nums">
        {term ? (
          <>
            <b className="font-semibold text-foreground">{shown.length} sites</b> for “{term}”: {count("query")} search directly,{" "}
            {count("tag")} by tag page, {count("none")} browse only.
          </>
        ) : (
          <>
            <b className="font-semibold text-foreground">{shown.length} sites.</b> Type a pattern to get direct links.
          </>
        )}
      </p>

      {groups.length === 0 ? (
        <p className="rounded-2xl border border-dashed bg-card p-8 text-center text-muted-foreground">
          No sites match these filters. Turn off &quot;Only sites that take a search term&quot; or pick another medium.
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.id} aria-labelledby={`group-${group.id}`} className="flex flex-col gap-2">
            <h2 id={`group-${group.id}`} className="flex items-baseline gap-2 font-mono text-xs font-medium tracking-widest text-muted-foreground uppercase">
              {group.title} <span className="font-mono font-normal tracking-normal">{group.items.length}</span>
            </h2>
            <ul className="divide-y rounded-2xl border bg-card">
              {group.items.map((source) => {
                const action = sourceAction(source, term);
                const path = action.url.replace(/^https?:\/\/(www\.)?/, "");
                return (
                  <li key={source.id} className="grid gap-3 p-4 md:grid-cols-[9rem_minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1.2fr)] md:gap-5">
                    <a href={source.homeUrl} target="_blank" rel="noopener" tabIndex={-1} aria-hidden="true" className="hidden md:block">
                      {source.thumbUrl ? (
                        <Image
                          src={source.thumbUrl}
                          alt=""
                          width={288}
                          height={180}
                          sizes="144px"
                          className="aspect-[16/10] w-36 rounded-lg border object-cover object-top"
                        />
                      ) : (
                        <span className="block aspect-[16/10] w-36 rounded-md border bg-muted" />
                      )}
                    </a>
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <a href={source.homeUrl} target="_blank" rel="noopener" className="font-semibold hover:underline">
                        {source.name}
                        <span className="sr-only"> (opens in new tab)</span>
                      </a>
                      <div className="flex flex-wrap gap-1">
                        {source.mediums.map((m) => (
                          <span key={m} className="rounded bg-muted px-1.5 py-1 text-[11px] leading-none font-medium text-muted-foreground">
                            {m === "motion" ? "3D & motion" : m === "mobile" ? "Mobile" : "Web"}
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className="min-w-0 text-sm">
                      {source.description}
                      {source.pricing && <span className="mt-0.5 block text-muted-foreground">{source.pricing}</span>}
                    </p>
                    <div className="flex min-w-0 flex-col items-start gap-1.5">
                      <a
                        href={action.url}
                        target="_blank"
                        rel="noopener"
                        className={cn(
                          "inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold hover:brightness-105 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none sm:min-h-9",
                          action.kind === "search" && "bg-primary text-primary-foreground",
                          action.kind === "tagpage" && "bg-accent text-accent-foreground",
                          action.kind === "browse" && "bg-muted text-foreground",
                        )}
                      >
                        <span className="truncate">
                          {action.label}
                          {term && action.kind !== "browse" && ` “${term}”`}
                        </span>
                        <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
                        <span className="sr-only"> on {source.name} (opens in new tab)</span>
                      </a>
                      <span className="font-mono text-xs break-all text-muted-foreground">{path}</span>
                      {term && action.kind !== "browse" && !source.confirmed && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                          Unconfirmed link
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      <footer className="flex max-w-[72ch] flex-col gap-2 border-t pt-4 text-sm text-muted-foreground">
        <p>
          <b className="font-medium text-foreground">Search</b> runs the site&apos;s own search.{" "}
          <b className="font-medium text-foreground">Tag page</b> opens a category page; unusual terms may 404.{" "}
          <b className="font-medium text-foreground">Browse</b> has no URL search and opens the gallery.
        </p>
        <p>
          &quot;Unconfirmed&quot; marks links whose pattern is widely used but couldn&apos;t be fetched to confirm, because the
          site blocks automated checks.
        </p>
      </footer>
    </div>
  );
}

export function Directory({
  sources,
  showcase,
  viewCounts,
  categoryCounts,
  galleryCounts,
  initialView,
  initialQuery,
}: {
  sources: DirectorySource[];
  showcase: ShowcaseEntry[];
  viewCounts: Record<Curation, number>;
  categoryCounts: CategoryCounts;
  galleryCounts: [string, number][];
  initialView: View;
  initialQuery: string;
}) {
  const [view, setView] = useState<View>(initialView);
  const [q, setQ] = useState(initialQuery);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  useUrlState(view, view === "galleries" ? q : "");

  const TABS: { id: View; label: string; count: number }[] = [
    { id: "showcase", label: "Showcase", count: viewCounts.all },
    { id: "galleries", label: "Search the galleries", count: sources.length },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div role="tablist" aria-label="Views" className="flex flex-wrap gap-1">
        {TABS.map((tab, i) => (
          <button
            key={tab.id}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-controls={`panel-${tab.id}`}
            aria-selected={view === tab.id}
            tabIndex={view === tab.id ? 0 : -1}
            onClick={() => setView(tab.id)}
            onKeyDown={(e) => {
              if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
              e.preventDefault();
              const next = (i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length;
              setView(TABS[next].id);
              tabs.current[next]?.focus();
            }}
            className={cn(
              "min-h-11 rounded-full border border-transparent px-4 text-[15px] font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
              view === tab.id && "border-border bg-card text-foreground shadow-sm",
            )}
          >
            {tab.label} <span className="ml-1 font-mono text-xs font-normal text-muted-foreground">{tab.count.toLocaleString("en-US")}</span>
          </button>
        ))}
      </div>
      <div role="tabpanel" id="panel-showcase" aria-labelledby="tab-showcase" hidden={view !== "showcase"}>
        <ShowcaseView initial={showcase} counts={viewCounts} categoryCounts={categoryCounts} galleries={galleryCounts} />
      </div>
      <div role="tabpanel" id="panel-galleries" aria-labelledby="tab-galleries" hidden={view !== "galleries"}>
        <GalleriesView sources={sources} q={q} setQ={setQ} />
      </div>
    </div>
  );
}
