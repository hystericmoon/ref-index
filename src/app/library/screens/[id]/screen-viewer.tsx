"use client";

import { ChevronLeft, ChevronRight, Workflow, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { changeScreenTagsAction } from "@/app/library/tag-actions";
import { TagChips, TagPicker, useTagCatalog } from "@/components/tag-picker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { neighborsInSequence } from "@/lib/screen-sequence";
import type { FacetOption, TagOption } from "@/lib/tags";
import { addToFlowAction, removeFromFlowAction, saveNotesAction } from "./actions";
import type { ScreenDetail } from "./data";

const PLATFORMS: Record<string, string> = { ios: "iOS", android: "Android", web: "Web" };

/** Alt text: app name plus the screen types it's tagged with, e.g. "Revolut, paywall screen". */
export function screenAlt(appName: string, screenTypes: string[]) {
  return screenTypes.length ? `${appName}, ${screenTypes.join(" and ").toLowerCase()} screen` : `${appName} screen`;
}

function isEditable(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el?.closest("input, textarea, select, [contenteditable=true], [cmdk-root]");
}

/**
 * Neighbours in the grid's current order when opened from the grid, else library order.
 * Read during render: on a full page load the sequence is empty on server and client alike.
 */
function neighborsOf(screen: ScreenDetail) {
  return neighborsInSequence(screen.id) ?? { prev: screen.prev, next: screen.next, position: null, total: null };
}

function ScreenBody({ screen, facets, titleId }: { screen: ScreenDetail; facets: FacetOption[]; titleId?: string }) {
  const router = useRouter();
  const catalog = useTagCatalog(facets);
  const [tagIds, setTagIds] = useState(screen.tagIds);
  const [notes, setNotes] = useState(screen.notes);
  const [savedNotes, setSavedNotes] = useState(screen.notes);
  const [flows, setFlows] = useState(screen.flows);
  const [flowChoice, setFlowChoice] = useState("");
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const neighbors = neighborsOf(screen);

  const screenTypeFacet = catalog.facets.find((f) => f.key === "screen_type");
  const screenTypes = tagIds.flatMap((id) => {
    const tag = catalog.tagById.get(id);
    return tag && tag.facetId === screenTypeFacet?.id ? [tag.label] : [];
  });
  const go = (id: string | null) => id && router.replace(`/library/screens/${id}`, { scroll: false });

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || isEditable(event.target)) return;
      if (event.key === "ArrowLeft" && neighbors.prev) {
        event.preventDefault();
        go(neighbors.prev);
      } else if (event.key === "ArrowRight" && neighbors.next) {
        event.preventDefault();
        go(neighbors.next);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function changeTag(tag: TagOption, change: "add" | "remove") {
    const before = tagIds;
    setTagIds(change === "add" ? [...new Set([...tagIds, tag.id])] : tagIds.filter((id) => id !== tag.id));
    const result = await changeScreenTagsAction(change, [screen.id], [tag.id]);
    if (result.ok) setMessage({ text: change === "add" ? `Added ${tag.label}` : `Removed ${tag.label}` });
    else {
      setTagIds(before);
      setMessage({ text: result.reason, error: true });
    }
  }

  async function saveNotes() {
    if (notes.trim() === savedNotes.trim()) return;
    const result = await saveNotesAction(screen.id, notes);
    if (result.ok) {
      setSavedNotes(notes);
      setMessage({ text: "Notes saved" });
    } else setMessage({ text: result.reason, error: true });
  }

  async function addToFlow() {
    const flow = screen.appFlows.find((f) => f.id === flowChoice);
    if (!flow) return;
    const result = await addToFlowAction(flow.id, screen.id);
    if (result.ok) {
      setFlows((prev) => [...prev, flow]);
      setFlowChoice("");
      setMessage({ text: `Added to ${flow.name}` });
    } else setMessage({ text: result.reason, error: true });
  }

  async function removeFromFlow(flow: { id: string; name: string }) {
    const result = await removeFromFlowAction(flow.id, screen.id);
    if (result.ok) {
      setFlows((prev) => prev.filter((f) => f.id !== flow.id));
      setMessage({ text: `Removed from ${flow.name}` });
    } else setMessage({ text: result.reason, error: true });
  }

  const addable = screen.appFlows.filter((f) => !flows.some((own) => own.id === f.id));
  const captured = new Date(screen.capturedAt).toLocaleDateString(undefined, { dateStyle: "medium" });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
      <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg bg-muted p-2">
        {screen.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL of the original
          <img
            src={screen.imageUrl}
            alt={screenAlt(screen.appName, screenTypes)}
            width={screen.width ?? undefined}
            height={screen.height ?? undefined}
            className="max-h-[70dvh] w-auto max-w-full rounded-md object-contain md:max-h-[calc(100dvh-10rem)]"
          />
        ) : (
          <p className="text-muted-foreground">The image is missing.</p>
        )}
      </div>

      <div className="flex w-full shrink-0 flex-col gap-5 md:w-80 md:overflow-y-auto">
        <div className="space-y-1">
          <h2 id={titleId} className="font-display text-2xl font-bold tracking-tight">
            {screen.appName}
          </h2>
          <p className="text-sm text-muted-foreground">
            {PLATFORMS[screen.platform] ?? screen.platform} · captured {captured}
          </p>
        </div>

        <nav aria-label="Browse screens" className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="size-11" disabled={!neighbors.prev} onClick={() => go(neighbors.prev)} aria-label="Previous screen">
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button variant="outline" size="icon" className="size-11" disabled={!neighbors.next} onClick={() => go(neighbors.next)} aria-label="Next screen">
            <ChevronRight aria-hidden="true" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {neighbors.position ? `${neighbors.position} of ${neighbors.total}` : "Use ← and → to move"}
          </span>
        </nav>

        <section aria-labelledby={`${screen.id}-tags`} className="flex flex-col gap-2">
          <h3 id={`${screen.id}-tags`} className="text-sm font-semibold">
            Tags
          </h3>
          <TagChips tags={tagIds.flatMap((id) => catalog.tagById.get(id) ?? [])} onRemove={(tag) => changeTag(tag, "remove")} />
          <TagPicker
            facets={catalog.facets}
            stateOf={(id) => (tagIds.includes(id) ? "all" : "none")}
            onChange={changeTag}
            onCreated={catalog.addTag}
            className="self-start"
          />
        </section>

        <section className="flex flex-col gap-2">
          <Label htmlFor={`${screen.id}-notes`}>Notes</Label>
          <textarea
            id={`${screen.id}-notes`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNotes}
            rows={4}
            maxLength={2000}
            placeholder="What's worth remembering about this screen?"
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
          />
          <p className="text-xs text-muted-foreground">Saved when you leave the field.</p>
        </section>

        <section aria-labelledby={`${screen.id}-flows`} className="flex flex-col gap-2">
          <h3 id={`${screen.id}-flows`} className="text-sm font-semibold">
            Flows
          </h3>
          {flows.length === 0 && <p className="text-sm text-muted-foreground">Not in any flow yet.</p>}
          <ul className="flex flex-col gap-1">
            {flows.map((flow) => (
              <li key={flow.id} className="flex items-center gap-1">
                <Link
                  href={`/library/flows/${flow.id}`}
                  className="flex min-h-11 flex-1 items-center gap-2 rounded-md px-2 text-sm hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <Workflow className="size-4 text-muted-foreground" aria-hidden="true" />
                  {flow.name}
                </Link>
                <Button variant="ghost" size="icon" className="size-11" onClick={() => removeFromFlow(flow)} aria-label={`Remove from ${flow.name}`}>
                  <X className="size-4" aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
          {addable.length > 0 && (
            <div className="flex gap-2">
              <label htmlFor={`${screen.id}-add-flow`} className="sr-only">
                Add to flow
              </label>
              <select
                id={`${screen.id}-add-flow`}
                value={flowChoice}
                onChange={(e) => setFlowChoice(e.target.value)}
                className="h-11 min-w-0 flex-1 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
              >
                <option value="">Add to a flow…</option>
                {addable.map((flow) => (
                  <option key={flow.id} value={flow.id}>
                    {flow.name}
                  </option>
                ))}
              </select>
              <Button variant="outline" className="h-11 px-4" disabled={!flowChoice} onClick={addToFlow}>
                Add
              </Button>
            </div>
          )}
        </section>

        <p aria-live="polite" className={message?.error ? "text-sm text-destructive" : "sr-only"}>
          {message?.text}
        </p>
      </div>
    </div>
  );
}

/** Full page, for direct visits and reloads. */
export function ScreenPageView({ screen, facets }: { screen: ScreenDetail; facets: FacetOption[] }) {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 pb-16 sm:px-6">
      <Link
        href="/library"
        className="-ml-2 inline-flex min-h-11 items-center gap-1 self-start rounded-md px-2 text-sm text-muted-foreground hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        Library
      </Link>
      <h1 className="sr-only">Screen from {screen.appName}</h1>
      <ScreenBody key={screen.id} screen={screen} facets={facets} />
    </main>
  );
}

/** Modal over the grid, when opened from a card. Closing returns focus to that card. */
export function ScreenModalView({ screen, facets }: { screen: ScreenDetail; facets: FacetOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  function close() {
    setOpen(false);
    router.back();
    const id = screen.id;
    window.setTimeout(() => {
      const cards = Array.from(document.querySelectorAll<HTMLElement>(`[data-screen-id="${id}"]`));
      cards.find((card) => card.offsetParent !== null)?.focus();
    }, 150);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent
        className="flex h-[100dvh] max-h-[100dvh] w-full max-w-[100vw] flex-col gap-4 overflow-y-auto rounded-none p-4 sm:h-[calc(100dvh-2rem)] sm:max-w-[min(80rem,calc(100vw-2rem))] sm:rounded-xl md:overflow-hidden"
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <DialogTitle className="sr-only">Screen from {screen.appName}</DialogTitle>
        <DialogDescription className="sr-only">
          Use the left and right arrow keys to move between screens. Press Escape to close.
        </DialogDescription>
        <ScreenBody key={screen.id} screen={screen} facets={facets} />
      </DialogContent>
    </Dialog>
  );
}
