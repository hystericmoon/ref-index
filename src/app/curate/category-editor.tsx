"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { CATEGORIES } from "@/lib/categories";
import { categoriesAction } from "./actions";

const LABELS = new Map(CATEGORIES.map((c) => [c.id, c.label]));

/** An item's categories, with a toggle list to change them. Each change saves right away. */
export function CategoryEditor({ item }: { item: { id: string; name: string; categories: string[] } }) {
  const [value, setValue] = useState(item.categories);
  const [open, setOpen] = useState(false);

  function toggle(id: string) {
    const before = value;
    const next = value.includes(id) ? value.filter((c) => c !== id) : [...value, id].slice(-6);
    setValue(next);
    void categoriesAction(item.id, next).then((res) => {
      if (!res.ok) {
        toast.error(`Couldn't save categories for ${item.name}.`);
        setValue(before);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1.5 px-1">
      <div className="flex flex-wrap items-center gap-1 text-xs">
        {value.length ? (
          value.map((c) => (
            <span key={c} className="rounded-full bg-muted px-2 py-0.5 font-medium">
              {LABELS.get(c) ?? c}
            </span>
          ))
        ) : (
          <span className="text-muted-foreground">No category</span>
        )}
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="inline-flex min-h-11 items-center gap-1 rounded-full px-2 font-medium text-link hover:underline sm:min-h-7"
        >
          <Pencil className="size-3" aria-hidden="true" /> {open ? "Done" : "Edit"}
          <span className="sr-only"> categories for {item.name}</span>
        </button>
      </div>
      {open && (
        <div role="group" aria-label={`Categories for ${item.name}`} className="flex flex-wrap gap-1">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={value.includes(c.id)}
              onClick={() => toggle(c.id)}
              className="min-h-11 rounded-full border bg-card px-2.5 text-xs font-medium text-muted-foreground aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground sm:min-h-7"
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
