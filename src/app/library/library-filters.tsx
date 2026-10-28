"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { filtersToSearch, hasFilters, type LibraryFilters } from "@/lib/library-filters";
import type { FacetOption } from "@/lib/tags";
import { cn } from "@/lib/utils";

type Props = {
  facets: FacetOption[];
  counts: Record<string, number>;
  filters: LibraryFilters;
};

function useFilterNavigation(facets: FacetOption[]) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const go = (next: LibraryFilters) =>
    startTransition(() => router.replace(`${pathname}${filtersToSearch(next, facets)}`, { scroll: false }));
  return { go, pending };
}

function toggleTag(filters: LibraryFilters, tagId: string): LibraryFilters {
  const tagIds = filters.tagIds.includes(tagId) ? filters.tagIds.filter((id) => id !== tagId) : [...filters.tagIds, tagId];
  return { ...filters, tagIds };
}

/** Facet checklists. Within a facet any ticked tag matches; across facets all must. */
function FacetList({ facets, counts, filters, onToggle, idPrefix }: Props & { onToggle: (tagId: string) => void; idPrefix: string }) {
  return (
    <div className="flex flex-col gap-6">
      {facets.map((facet) => {
        const tags = facet.tags.filter((tag) => (counts[tag.id] ?? 0) > 0 || filters.tagIds.includes(tag.id));
        return (
          <fieldset key={facet.id} className="flex flex-col gap-1">
            <legend className="mb-1 text-sm font-semibold">{facet.label}</legend>
            {tags.length === 0 && <p className="text-sm text-muted-foreground">No screens tagged yet.</p>}
            {tags.map((tag) => {
              const id = `${idPrefix}-${tag.id}`;
              const checked = filters.tagIds.includes(tag.id);
              return (
                <label
                  key={tag.id}
                  htmlFor={id}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 text-sm hover:bg-accent md:min-h-9"
                >
                  <input
                    id={id}
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(tag.id)}
                    className="size-4 accent-primary"
                  />
                  <span className={cn("flex-1", checked && "font-medium")}>{tag.label}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{counts[tag.id] ?? 0}</span>
                </label>
              );
            })}
          </fieldset>
        );
      })}
    </div>
  );
}

/** Facet filters as a sidebar, from md up. */
export function FilterSidebar(props: Props) {
  const { go, pending } = useFilterNavigation(props.facets);
  const onToggle = (tagId: string) => go(toggleTag(props.filters, tagId));

  return (
    <aside aria-label="Filters" aria-busy={pending} className="hidden w-56 shrink-0 md:block">
      <div className="sticky top-4 max-h-[calc(100dvh-2rem)] overflow-y-auto pr-2 pb-8">
        <FacetList {...props} onToggle={onToggle} idPrefix="side" />
      </div>
    </aside>
  );
}

/** The same filters in a sheet, below md. */
export function FilterSheet(props: Props) {
  const { go, pending } = useFilterNavigation(props.facets);
  const onToggle = (tagId: string) => go(toggleTag(props.filters, tagId));
  const active = props.filters.tagIds.length;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="h-11 px-4 md:hidden">
          <SlidersHorizontal aria-hidden="true" />
          Filters{active > 0 && ` (${active})`}
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[min(20rem,85vw)] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>Screens must match one tag from each facet you use.</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-8" aria-busy={pending}>
          <FacetList {...props} onToggle={onToggle} idPrefix="sheet" />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function SearchBox({ facets, filters }: Omit<Props, "counts">) {
  const { go, pending } = useFilterNavigation(facets);
  const [value, setValue] = useState(filters.q);

  return (
    <form
      role="search"
      className="relative flex-1"
      onSubmit={(event) => {
        event.preventDefault();
        go({ ...filters, q: value.trim() });
      }}
    >
      <label htmlFor="library-search" className="sr-only">
        Search your screens
      </label>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <Input
        id="library-search"
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search apps, tags and notes"
        className="h-11 pr-3 pl-9"
        aria-busy={pending}
        enterKeyHint="search"
      />
    </form>
  );
}

/** Removable chips for the active search and tags, plus Clear all. */
export function ActiveFilters({ facets, filters }: Omit<Props, "counts">) {
  const { go } = useFilterNavigation(facets);
  if (!hasFilters(filters)) return null;
  const tags = facets.flatMap((facet) => facet.tags.filter((tag) => filters.tagIds.includes(tag.id)));

  return (
    <ul className="flex flex-wrap items-center gap-2" aria-label="Active filters">
      {filters.q && (
        <li className="flex items-center gap-1 rounded-full bg-secondary py-0.5 pr-0.5 pl-3 text-sm text-secondary-foreground">
          “{filters.q}”
          <Button
            variant="ghost"
            size="icon"
            className="relative size-8 rounded-full after:absolute after:-inset-1.5"
            onClick={() => go({ ...filters, q: "" })}
            aria-label={`Remove search ${filters.q}`}
          >
            <X className="size-3.5" aria-hidden="true" />
          </Button>
        </li>
      )}
      {tags.map((tag) => (
        <li key={tag.id} className="flex items-center gap-1 rounded-full bg-secondary py-0.5 pr-0.5 pl-3 text-sm text-secondary-foreground">
          {tag.label}
          <Button
            variant="ghost"
            size="icon"
            className="relative size-8 rounded-full after:absolute after:-inset-1.5"
            onClick={() => go(toggleTag(filters, tag.id))}
            aria-label={`Remove filter ${tag.label}`}
          >
            <X className="size-3.5" aria-hidden="true" />
          </Button>
        </li>
      ))}
      <li>
        <Button variant="link" className="h-11 px-2" onClick={() => go({ q: "", tagIds: [] })}>
          Clear all
        </Button>
      </li>
    </ul>
  );
}
