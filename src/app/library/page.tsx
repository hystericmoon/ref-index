import { ImagePlus, SearchX, Workflow } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { countScreensByTag } from "@/lib/db/screen-tags";
import { filtersToSearch, hasFilters, parseFilters } from "@/lib/library-filters";
import { createClient } from "@/lib/supabase/server";
import { loadTagOptions } from "@/lib/tags";
import { loadScreenPage } from "./data";
import { ActiveFilters, FilterSheet, FilterSidebar, SearchBox } from "./library-filters";
import { ScreenGrid } from "./screen-grid";

export const metadata: Metadata = { title: "Library" };

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const db = await createClient();
  const [params, facets, counts] = await Promise.all([searchParams, loadTagOptions(db), countScreensByTag(db)]);
  const filters = parseFilters(params, facets);
  const filtered = hasFilters(filters);
  const page = await loadScreenPage(filters);
  const libraryEmpty = !filtered && page.screens.length === 0;
  const viewKey = filtersToSearch(filters, facets) || "all";
  const tagCounts = Object.fromEntries(counts);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 pb-24 sm:px-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-bold tracking-tight">Library</h1>
        {!libraryEmpty && (
          <div className="flex gap-2">
            <Button asChild variant="outline" className="h-11 px-4">
              <Link href="/library/flows">
                <Workflow aria-hidden="true" />
                Flows
              </Link>
            </Button>
            <Button asChild className="h-11 px-5">
              <Link href="/library/upload">
                <ImagePlus aria-hidden="true" />
                Upload
              </Link>
            </Button>
          </div>
        )}
      </div>

      {libraryEmpty ? (
        <section
          aria-labelledby="empty-title"
          className="flex flex-col items-center gap-4 rounded-xl border border-dashed px-6 py-16 text-center"
        >
          <ImagePlus className="size-10 text-muted-foreground" aria-hidden="true" />
          <div className="space-y-1">
            <h2 id="empty-title" className="text-lg font-semibold">
              No screens yet
            </h2>
            <p className="max-w-[45ch] text-muted-foreground">
              Upload screenshots of apps and sites you want to remember, then tag them so you can find them
              later.
            </p>
          </div>
          <Button asChild className="h-11 px-5">
            <Link href="/library/upload">Upload screens</Link>
          </Button>
        </section>
      ) : (
        <div className="flex gap-8">
          <FilterSidebar facets={facets} counts={tagCounts} filters={filters} />
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <div className="flex gap-2">
              <SearchBox key={filters.q} facets={facets} filters={filters} />
              <FilterSheet facets={facets} counts={tagCounts} filters={filters} />
            </div>
            <ActiveFilters facets={facets} filters={filters} />
            {page.screens.length === 0 ? (
              <section
                aria-labelledby="no-match-title"
                className="flex flex-col items-center gap-4 rounded-xl border border-dashed px-6 py-16 text-center"
              >
                <SearchX className="size-10 text-muted-foreground" aria-hidden="true" />
                <div className="space-y-1">
                  <h2 id="no-match-title" className="text-lg font-semibold">
                    No screens match
                  </h2>
                  <p className="max-w-[45ch] text-muted-foreground">
                    Try fewer filters or different words. Tags in the same group widen the search; tags in
                    different groups narrow it.
                  </p>
                </div>
                <Button asChild variant="outline" className="h-11 px-5">
                  <Link href="/library">Clear filters</Link>
                </Button>
              </section>
            ) : (
              <ScreenGrid key={viewKey} initial={page} facets={facets} filters={filters} />
            )}
          </div>
        </div>
      )}
    </main>
  );
}
