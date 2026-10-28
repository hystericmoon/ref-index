"use client";

import Link from "next/link";
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

function ScreenCard({ screen }: { screen: GridScreen }) {
  return (
    <Link
      href={`/library/screens/${screen.id}`}
      className="group relative block overflow-hidden rounded-lg border bg-muted outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      style={{ aspectRatio: `1 / ${ratio(screen)}` }}
    >
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
      <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/75 to-transparent px-3 pt-6 pb-2 text-sm font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        {screen.appName}
      </span>
    </Link>
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

export function ScreenGrid({ initial }: { initial: ScreenPage }) {
  const [screens, setScreens] = useState(initial.screens);
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
      const page = await loadMoreScreens(cursor);
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
  }, [cursor]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !cursor || failed) return;
    const observer = new IntersectionObserver((entries) => entries[0]?.isIntersecting && loadMore(), {
      rootMargin: "1200px 0px",
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [cursor, failed, loadMore]);

  return (
    <section aria-label="Your screens" className="flex flex-col gap-4">
      {LAYOUTS.map(({ columns, className }) => (
        <div key={columns} className={cn("gap-3 sm:gap-4", className)} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {placeInColumns(screens, columns).map((column, i) => (
            <div key={i} className="flex min-w-0 flex-col gap-3 sm:gap-4">
              {column.map((screen) => (
                <ScreenCard key={screen.id} screen={screen} />
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
        {loading ? "Loading more screens" : `${screens.length} screens shown`}
      </p>
    </section>
  );
}
