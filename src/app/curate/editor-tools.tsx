"use client";

import { EyeOff, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { reviewAction } from "./actions";
import { CategoryEditor } from "./category-editor";

/**
 * Curation controls under a showcase card, shown only to editors: feature or unfeature,
 * hide, and fix categories, without going through the /curate queue.
 */
export function EditorTools({
  item,
  onHidden,
}: {
  item: { id: string; name: string; categories: string[]; staffPick: boolean };
  onHidden: () => void;
}) {
  const [pick, setPick] = useState(item.staffPick);

  function feature() {
    const next = !pick;
    setPick(next);
    void reviewAction(item.id, next ? "feature" : "keep").then((res) => {
      if (!res.ok) {
        setPick(!next);
        toast.error(`Couldn't update ${item.name}.`);
      } else toast.success(next ? `${item.name} is a staff pick.` : `${item.name} is no longer a staff pick.`);
    });
  }

  function hide() {
    onHidden();
    void reviewAction(item.id, "hide").then((res) => {
      if (!res.ok) toast.error(`Couldn't hide ${item.name}. Reload to see it again.`);
      else toast.success(`${item.name} is hidden from every public view.`);
    });
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-dashed p-2" aria-label={`Editor tools for ${item.name}`} role="group">
      <div className="flex gap-1.5">
        <button
          type="button"
          aria-pressed={pick}
          onClick={feature}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full border bg-card px-3 text-xs font-semibold aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground sm:min-h-8"
        >
          <Sparkles className="size-3.5" aria-hidden="true" /> {pick ? "Staff pick" : "Feature"}
        </button>
        <button
          type="button"
          onClick={hide}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full border bg-card px-3 text-xs font-semibold text-muted-foreground hover:text-destructive sm:min-h-8"
        >
          <EyeOff className="size-3.5" aria-hidden="true" /> Hide
        </button>
      </div>
      <CategoryEditor item={item} />
    </div>
  );
}
