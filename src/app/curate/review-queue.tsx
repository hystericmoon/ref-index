"use client";

import { EyeOff, Check, Sparkles, Undo2 } from "lucide-react";
import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Orb } from "@/components/effects";
import type { ReviewAction, ReviewItem } from "@/lib/db/showcase";
import { cn } from "@/lib/utils";
import { moreToReview, reviewAction } from "./actions";

const LABEL: Record<ReviewAction, string> = { feature: "Featured", keep: "Kept", hide: "Hidden" };

export function ReviewQueue({ initial }: { initial: ReviewItem[] }) {
  const [items, setItems] = useState(initial);
  const [done, setDone] = useState<{ item: ReviewItem; action: ReviewAction }[]>([]);
  const [loading, startLoading] = useTransition();

  function decide(item: ReviewItem, action: ReviewAction) {
    setItems((list) => list.filter((i) => i.id !== item.id));
    setDone((list) => [{ item, action }, ...list].slice(0, 20));
    void reviewAction(item.id, action).then((res) => {
      if (!res.ok) {
        toast.error(`Couldn't save ${item.name}. It's back in the queue.`);
        setItems((list) => [item, ...list]);
      }
    });
  }

  function undo() {
    const [last, ...rest] = done;
    if (!last) return;
    setDone(rest);
    setItems((list) => [last.item, ...list]);
    // Undo returns it to the queue as listed; the next decision overwrites it.
    void reviewAction(last.item.id, "keep");
  }

  // Top up the queue when it runs low.
  useEffect(() => {
    if (items.length > 6 || loading) return;
    startLoading(async () => {
      const more = await moreToReview([...items, ...done.map((d) => d.item)].map((i) => i.id));
      setItems((list) => [...list, ...more.filter((m) => !list.some((i) => i.id === m.id))]);
    });
  }, [items, done, loading]);

  // F / K / H act on the first card, Z undoes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement).closest("input, textarea, select")) return;
      const first = items[0];
      const key = e.key.toLowerCase();
      if (key === "z") undo();
      else if (first && key === "f") decide(first, "feature");
      else if (first && key === "k") decide(first, "keep");
      else if (first && key === "h") decide(first, "hide");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex min-h-11 flex-wrap items-center gap-3 text-sm text-muted-foreground" aria-live="polite">
        <span>
          <b className="text-foreground">{done.length}</b> reviewed this session
        </span>
        {done[0] && (
          <span>
            Last: {done[0].item.name} · {LABEL[done[0].action]}
          </span>
        )}
        <button
          type="button"
          onClick={undo}
          disabled={!done.length}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border bg-card px-4 font-medium text-foreground disabled:opacity-50 sm:min-h-9"
        >
          <Undo2 className="size-4" aria-hidden="true" /> Undo
        </button>
        {loading && (
          <span className="inline-flex items-center gap-1.5">
            <Orb label="Loading more to review" /> Loading more…
          </span>
        )}
      </div>

      {items.length === 0 && !loading ? (
        <p className="rounded-2xl border border-dashed bg-card p-8 text-center text-muted-foreground">
          Nothing left to review right now. New screenshots join the queue as they&apos;re captured.
        </p>
      ) : (
        <ul className="grid gap-x-4 gap-y-6 [grid-template-columns:repeat(auto-fill,minmax(17rem,1fr))]">
          {items.map((item, index) => (
            <li key={item.id} className={cn("flex min-w-0 flex-col gap-2.5", index === 0 && "rounded-3xl ring-2 ring-ring/60 ring-offset-4 ring-offset-background")}>
              <a href={item.url ?? undefined} target="_blank" rel="noopener" className="block aspect-[16/10] overflow-hidden rounded-2xl border bg-muted">
                {item.thumbUrl && (
                  <Image src={item.thumbUrl} alt={`Screenshot of ${item.name}`} width={640} height={400} unoptimized className="size-full object-cover object-top" />
                )}
              </a>
              <div className="flex flex-col gap-0.5 px-1">
                <span className="font-semibold tracking-tight">{item.name}</span>
                <span className="text-xs text-muted-foreground">
                  {item.galleryCount > 1 ? `${item.galleryCount} galleries: ` : ""}
                  {item.galleries.join(" · ")}
                </span>
              </div>
              <div className="flex gap-1.5 px-1" role="group" aria-label={`Review ${item.name}`}>
                <button
                  type="button"
                  onClick={() => decide(item, "feature")}
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-3 text-sm font-semibold text-primary-foreground sm:min-h-9"
                >
                  <Sparkles className="size-4" aria-hidden="true" /> Feature
                </button>
                <button
                  type="button"
                  onClick={() => decide(item, "keep")}
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full border bg-card px-3 text-sm font-semibold sm:min-h-9"
                >
                  <Check className="size-4" aria-hidden="true" /> Keep
                </button>
                <button
                  type="button"
                  onClick={() => decide(item, "hide")}
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full border bg-card px-3 text-sm font-semibold text-muted-foreground hover:text-destructive sm:min-h-9"
                >
                  <EyeOff className="size-4" aria-hidden="true" /> Hide
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
