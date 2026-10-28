"use client";

import { Check, SquareCheck } from "lucide-react";
import Link from "next/link";
import { TagChips, TagPicker, useTagCatalog, type TagState } from "@/components/tag-picker";
import type { LibraryFilters } from "@/lib/library-filters";
import { screenAlt } from "@/lib/screen-alt";
import { setScreenSequence } from "@/lib/screen-sequence";
import type { FacetOption, TagOption } from "@/lib/tags";
import { changeScreenTagsAction } from "./tag-actions";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { loadMoreScreens } from "./actions";
import type { GridScreen, ScreenPage } from "./data";

/** Phone screenshots are the common case, so unknown sizes get a phone shape. */
const FALLBACK_RATIO = 19.5 / 9;

/** Column counts per breakpoint; CSS shows the matching layout (no JS measuring, so no shift). */
const LAYOUTS = [
  { columns: 2, className: "grid sm:hidden" },
  { columns: 3, className: "hidden sm:grid lg:hidden" },
  { columns: 4, className: "hidden lg:grid" },
];

function ratio(screen: GridScreen) {
  return screen.width && screen.height ? screen.height / screen.width : FALLBACK_RATIO;
}

/**
 * Place each screen in the shortest column, in order. Appending a page never moves the
 * screens already placed, so infinite scroll doesn't reshuffle the grid.
 */
function placeInColumns(screens: GridScreen[], columns: number): GridScreen[][] {
  const result = Array.from({ length: columns }, () => [] as GridScreen[]);
  const heights = new Array(columns).fill(0);
  for (const screen of screens) {
    const shortest = heights.indexOf(Math.min(...heights));
    result[shortest].push(screen);
    heights[shortest] += ratio(screen);
  }
  return result;
}

type Selection = { selected: boolean; onToggle: (range: boolean) => void } | null;

function ScreenCard({ screen, selection, label }: { screen: GridScreen; selection: Selection; label: string }) {
  const className =
    "group relative block w-full overflow-hidden rounded-lg border bg-muted outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";
  const style = { aspectRatio: `1 / ${ratio(screen)}` };
  const content = (
    <>
      {screen.thumbUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- signed Storage URLs, already 480px WebP
        <img
          src={screen.thumbUrl}
          alt=""
          width={screen.width ?? undefined}
          height={screen.height ?? undefined}
          loading="lazy"
          decoding="async"
          className="size-full object-cover object-top"
        />
      )}
      <span
        className={cn(
          "absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/75 to-transparent px-3 pt-6 pb-2 text-left text-sm font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100",
          selection?.selected && "opacity-100",
        )}
      >
        {screen.appName}
      </span>
    </>
  );

  if (!selection) {
    return (
      <Link
        href={`/library/screens/${screen.id}`}
        className={className}
        style={style}
        data-screen-id={screen.id}
        scroll={false}
        aria-label={label}
      >
        {content}
      </Link>
    );
  }
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selection.selected}
      aria-label={label}
      onClick={(event) => selection.onToggle(event.shiftKey)}
      className={cn(className, selection.selected && "ring-[3px] ring-primary")}
      style={style}
    >
      {content}
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-2 left-2 flex size-6 items-center justify-center rounded-md border-2 border-white bg-black/30 shadow",
          selection.selected && "border-primary bg-primary text-primary-foreground",
        )}
      >
        {selection.selected && <Check className="size-4" />}
      </span>
    </button>
  );
}

export function GridSkeleton({ count = 8 }: { count?: number }) {
  const shapes = [2.1, 1.6, 2.2, 1.8, 2.0, 1.5, 2.2, 1.9];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="rounded-lg" style={{ aspectRatio: `1 / ${shapes[i % shapes.length]}` }} />
      ))}
    </div>
  );
}

export function ScreenGrid({
  initial,
  facets,
  filters,
}: {
  initial: ScreenPage;
  facets: FacetOption[];
  filters: LibraryFilters;
}) {
  const [screens, setScreens] = useState(initial.screens);
  const catalog = useTagCatalog(facets);
  const screenTypeFacetId = catalog.facets.find((f) => f.key === "screen_type")?.id;
  /** Accessible name: app name plus screen types, e.g. "Revolut, paywall screen". */
  const labelFor = (screen: GridScreen) =>
    screenAlt(
      screen.appName,
      screen.tagIds.flatMap((id) => {
        const tag = catalog.tagById.get(id);
        return tag && tag.facetId === screenTypeFacetId ? [tag.label] : [];
      }),
    );
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [anchor, setAnchor] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [tagError, setTagError] = useState<string | null>(null);

  function toggle(index: number, range: boolean) {
    const id = screens[index].id;
    setSelected((prev) => {
      const next = new Set(prev);
      if (range && anchor !== null) {
        const [from, to] = anchor < index ? [anchor, index] : [index, anchor];
        const value = !prev.has(id) || prev.has(screens[anchor].id);
        screens.slice(from, to + 1).forEach((s) => (value ? next.add(s.id) : next.delete(s.id)));
      } else if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setAnchor(index);
  }

  function stopSelecting() {
    setSelecting(false);
    setSelected(new Set());
    setAnchor(null);
    setTagError(null);
  }

  const selectedScreens = screens.filter((s) => selected.has(s.id));
  const stateOf = (tagId: string): TagState => {
    const count = selectedScreens.filter((s) => s.tagIds.includes(tagId)).length;
    return count === 0 ? "none" : count === selectedScreens.length ? "all" : "some";
  };
  const selectionTags = [...new Set(selectedScreens.flatMap((s) => s.tagIds))]
    .flatMap((id) => catalog.tagById.get(id) ?? [])
    .sort((a, b) => a.label.localeCompare(b.label));

  /** Optimistic: update the grid now, put the old tags back if saving fails. */
  async function changeTag(tag: TagOption, change: "add" | "remove") {
    const ids = selectedScreens.map((s) => s.id);
    if (!ids.length) return;
    const before = new Map(selectedScreens.map((s) => [s.id, s.tagIds]));
    setTagError(null);
    setScreens((prev) =>
      prev.map((s) =>
        before.has(s.id)
          ? {
              ...s,
              tagIds: change === "add" ? [...new Set([...s.tagIds, tag.id])] : s.tagIds.filter((id) => id !== tag.id),
            }
          : s,
      ),
    );
    const noun = ids.length === 1 ? "screen" : "screens";
    const result = await changeScreenTagsAction(change, ids, [tag.id]).catch(() => ({
      ok: false as const,
      reason: "Network error. Check your connection and try again.",
    }));
    if (result.ok) {
      setStatus(change === "add" ? `Added ${tag.label} to ${ids.length} ${noun}` : `Removed ${tag.label} from ${ids.length} ${noun}`);
    } else {
      // Roll back only this tag, so a later change that did save isn't undone.
      setScreens((prev) =>
        prev.map((s) => {
          if (!before.has(s.id)) return s;
          const had = before.get(s.id)!.includes(tag.id);
          const without = s.tagIds.filter((id) => id !== tag.id);
          return { ...s, tagIds: had ? [...without, tag.id] : without };
        }),
      );
      setTagError(result.reason);
      setStatus("");
    }
  }
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const busy = useRef(false);

  const loadMore = useCallback(async () => {
    if (!cursor || busy.current) return;
    busy.current = true;
    setLoading(true);
    setFailed(false);
    try {
      const page = await loadMoreScreens(filters, cursor);
      setScreens((prev) => {
        const seen = new Set(prev.map((s) => s.id));
        return [...prev, ...page.screens.filter((s) => !seen.has(s.id))];
      });
      setCursor(page.nextCursor);
    } catch {
      setFailed(true);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [cursor, filters]);

  useEffect(() => setScreenSequence(screens.map((s) => s.id)), [screens]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !cursor || failed) return;
    const observer = new IntersectionObserver((entries) => entries[0]?.isIntersecting && loadMore(), {
      rootMargin: "1200px 0px",
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [cursor, failed, loadMore]);

  const indexOf = new Map(screens.map((s, i) => [s.id, i]));

  return (
    <section aria-label="Your screens" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {selecting
            ? "Click screens to select them. Shift-click selects a range."
            : `${screens.length}${cursor ? "+" : ""} ${screens.length === 1 ? "screen" : "screens"}`}
        </p>
        {selecting ? (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              className="h-11 px-4"
              onClick={() => setSelected(selected.size === screens.length ? new Set() : new Set(screens.map((s) => s.id)))}
            >
              {selected.size === screens.length ? "Select none" : "Select all"}
            </Button>
            <Button variant="outline" className="h-11 px-4" onClick={stopSelecting}>
              Done
            </Button>
          </div>
        ) : (
          <Button variant="outline" className="h-11 px-4" onClick={() => setSelecting(true)}>
            <SquareCheck aria-hidden="true" />
            Select
          </Button>
        )}
      </div>

      {LAYOUTS.map(({ columns, className }) => (
        <div key={columns} className={cn("gap-3 sm:gap-4", className)} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {placeInColumns(screens, columns).map((column, i) => (
            <div key={i} className="flex min-w-0 flex-col gap-3 sm:gap-4">
              {column.map((screen) => (
                <ScreenCard
                  key={screen.id}
                  screen={screen}
                  label={labelFor(screen)}
                  selection={
                    selecting
                      ? { selected: selected.has(screen.id), onToggle: (range) => toggle(indexOf.get(screen.id)!, range) }
                      : null
                  }
                />
              ))}
            </div>
          ))}
        </div>
      ))}

      {loading && <GridSkeleton count={4} />}
      {failed && (
        <div role="alert" className="flex flex-col items-center gap-3 py-6 text-center">
          <p className="text-muted-foreground">We couldn&apos;t load more screens.</p>
          <Button variant="outline" className="h-11 px-5" onClick={loadMore}>
            Try again
          </Button>
        </div>
      )}
      <div ref={sentinel} aria-hidden="true" />
      <p aria-live="polite" className="sr-only">
        {loading ? "Loading more screens" : status}
      </p>

      {selecting && (
        <div
          role="region"
          aria-label="Tag selected screens"
          className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-auto text-sm font-medium">
              {selected.size} {selected.size === 1 ? "screen" : "screens"} selected
            </span>
            <TagPicker
              facets={catalog.facets}
              stateOf={stateOf}
              onChange={changeTag}
              onCreated={catalog.addTag}
              disabled={selected.size === 0}
            />
          </div>
          <TagChips tags={selectionTags} stateOf={stateOf} onRemove={(tag) => changeTag(tag, "remove")} />
          {status && <p className="text-sm text-muted-foreground">{status}</p>}
          {tagError && (
            <p role="alert" className="text-sm text-destructive">
              {tagError}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
