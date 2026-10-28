"use client";

import { ArrowLeft, ArrowRight, GripVertical, Plus, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { setScreenSequence } from "@/lib/screen-sequence";
import { cn } from "@/lib/utils";
import { saveFlowOrderAction } from "../actions";

export type FlowItem = { id: string; thumbUrl: string | null; width: number | null; height: number | null };

function Thumb({ item, className }: { item: FlowItem; className?: string }) {
  const ratio = item.width && item.height ? `${item.width} / ${item.height}` : "9 / 19.5";
  return (
    <span className={cn("block overflow-hidden rounded-md border bg-muted", className)} style={{ aspectRatio: ratio }}>
      {item.thumbUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL, 480px WebP
        <img src={item.thumbUrl} alt="" loading="lazy" decoding="async" className="size-full object-cover object-top" />
      )}
    </span>
  );
}

export function FlowEditor({
  flowId,
  appName,
  initial,
  candidates,
}: {
  flowId: string;
  appName: string;
  initial: FlowItem[];
  candidates: FlowItem[];
}) {
  const [items, setItems] = useState(initial);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  // The viewer's arrow keys follow the flow's order when a step is opened from here.
  useEffect(() => setScreenSequence(items.map((item) => item.id)), [items]);

  /** Optimistic: show the new order now, put the old one back if saving fails. */
  async function save(next: FlowItem[], message: string) {
    const before = items;
    setItems(next);
    setError(null);
    const result = await saveFlowOrderAction(
      flowId,
      next.map((item) => item.id),
    ).catch(() => ({ ok: false as const, reason: "Network error. Check your connection and try again." }));
    if (result.ok) setStatus(message);
    else {
      setItems(before);
      setError(result.reason);
    }
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    save(next, `Moved to step ${to + 1} of ${next.length}`);
  }

  const inFlow = new Set(items.map((item) => item.id));
  const addable = candidates.filter((item) => !inFlow.has(item.id));

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="steps-title" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="steps-title" className="text-lg font-semibold">
            Steps
          </h2>
          <p className="text-sm text-muted-foreground">Drag to reorder, or use the arrow buttons.</p>
        </div>
        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed px-6 py-10 text-center text-muted-foreground">
            This flow has no screens yet. Add some from {appName} below.
          </p>
        ) : (
          <ol className="flex snap-x gap-4 overflow-x-auto pb-4">
            {items.map((item, index) => (
              <li
                key={item.id}
                draggable
                onDragStart={(event) => {
                  setDragIndex(index);
                  event.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(event) => {
                  if (dragIndex !== null) event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (dragIndex !== null) move(dragIndex, index);
                  setDragIndex(null);
                }}
                onDragEnd={() => setDragIndex(null)}
                className={cn(
                  "flex w-40 shrink-0 snap-start flex-col gap-2 sm:w-48",
                  dragIndex === index && "opacity-50",
                )}
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 font-medium">
                    <GripVertical className="size-4 cursor-grab text-muted-foreground" aria-hidden="true" />
                    Step {index + 1}
                  </span>
                </div>
                <Link
                  href={`/library/screens/${item.id}`}
                  scroll={false}
                  data-screen-id={item.id}
                  aria-label={`Open step ${index + 1}`}
                  className="rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <Thumb item={item} />
                </Link>
                <div className="flex justify-between">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    disabled={index === 0}
                    onClick={() => move(index, index - 1)}
                    aria-label={`Move step ${index + 1} earlier`}
                  >
                    <ArrowLeft aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    onClick={() => save(items.filter((i) => i.id !== item.id), `Removed step ${index + 1}`)}
                    aria-label={`Remove step ${index + 1} from the flow`}
                  >
                    <X aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    disabled={index === items.length - 1}
                    onClick={() => move(index, index + 1)}
                    aria-label={`Move step ${index + 1} later`}
                  >
                    <ArrowRight aria-hidden="true" />
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        )}
        <p aria-live="polite" className="sr-only">
          {status}
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </section>

      <section aria-labelledby="add-title" className="flex flex-col gap-3">
        <h2 id="add-title" className="text-lg font-semibold">
          Add screens from {appName}
        </h2>
        {addable.length === 0 ? (
          <p className="text-sm text-muted-foreground">Every screen from {appName} is already in this flow.</p>
        ) : (
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8">
            {addable.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => save([...items, item], `Added as step ${items.length + 1}`)}
                  className="group relative block w-full rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  aria-label={`Add screen to the end of the flow`}
                >
                  <Thumb item={item} />
                  <span className="absolute inset-0 flex items-center justify-center rounded-md bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                    <Plus className="size-6 text-white" aria-hidden="true" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
