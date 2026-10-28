"use client";

import { Check, Minus, Plus, Tags, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { createTagAction } from "@/app/library/tag-actions";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { FacetOption, TagOption } from "@/lib/tags";
import { cn } from "@/lib/utils";

/** How many of the screens being edited carry a tag. */
export type TagState = "all" | "some" | "none";

/** The facets and tags known on this page, plus any created while it's open. */
export function useTagCatalog(initial: FacetOption[]) {
  const [facets, setFacets] = useState(initial);
  const tagById = useMemo(
    () => new Map(facets.flatMap((facet) => facet.tags.map((tag) => [tag.id, tag] as const))),
    [facets],
  );
  const addTag = useCallback((tag: TagOption) => {
    setFacets((prev) =>
      prev.map((facet) =>
        facet.id !== tag.facetId || facet.tags.some((t) => t.id === tag.id)
          ? facet
          : { ...facet, tags: [...facet.tags, tag].sort((a, b) => a.label.localeCompare(b.label)) },
      ),
    );
  }, []);
  return { facets, tagById, addTag };
}

type TagPickerProps = {
  facets: FacetOption[];
  stateOf: (tagId: string) => TagState;
  /** "add" puts the tag on every screen being edited, "remove" takes it off all of them. */
  onChange: (tag: TagOption, change: "add" | "remove") => void;
  onCreated: (tag: TagOption) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
};

/** Combobox of tags grouped by facet, with type-to-filter and "Create" inside a facet. */
export function TagPicker({
  facets,
  stateOf,
  onChange,
  onCreated,
  label = "Add tags",
  disabled,
  className,
}: TagPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const term = query.trim().replace(/\s+/g, " ");
  const exists = (facet: FacetOption) => facet.tags.some((tag) => tag.label.toLowerCase() === term.toLowerCase());

  async function create(facet: FacetOption) {
    setCreating(true);
    setError(null);
    const result = await createTagAction(facet.id, term);
    setCreating(false);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    onCreated(result.data);
    onChange(result.data, "add");
    setQuery("");
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setQuery("");
          setError(null);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("h-11 px-4", className)} disabled={disabled}>
          <Tags aria-hidden="true" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(22rem,calc(100vw-2rem))] p-0" align="start">
        <Command loop>
          <CommandInput
            placeholder="Find or create a tag…"
            value={query}
            onValueChange={setQuery}
            aria-label="Find or create a tag"
          />
          <CommandList className="max-h-[min(22rem,50dvh)]">
            <CommandEmpty>{term ? "No matching tag. Create one below." : "No tags yet."}</CommandEmpty>
            {facets.map((facet) => (
              <CommandGroup key={facet.id} heading={facet.label}>
                {facet.tags.map((tag) => {
                  const state = stateOf(tag.id);
                  return (
                    <CommandItem
                      key={tag.id}
                      value={`${tag.label} ${facet.label} ${tag.id}`}
                      keywords={tag.synonyms}
                      onSelect={() => onChange(tag, state === "all" ? "remove" : "add")}
                      aria-checked={state === "all" ? true : state === "some" ? "mixed" : false}
                      role="option"
                      className="min-h-10"
                    >
                      <span
                        className={cn(
                          "flex size-4 items-center justify-center rounded-sm border",
                          state !== "none" && "border-primary bg-primary text-primary-foreground",
                        )}
                        aria-hidden="true"
                      >
                        {state === "all" && <Check className="size-3 text-current" />}
                        {state === "some" && <Minus className="size-3 text-current" />}
                      </span>
                      {tag.label}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
            {term && (
              <CommandGroup heading="Create tag" forceMount>
                {facets
                  .filter((facet) => !exists(facet))
                  .map((facet) => (
                    <CommandItem
                      key={facet.id}
                      value={`create ${facet.id}`}
                      forceMount
                      disabled={creating}
                      onSelect={() => create(facet)}
                      className="min-h-10"
                    >
                      <Plus aria-hidden="true" />
                      <span>
                        Create “{term}” in <span className="font-medium">{facet.label}</span>
                      </span>
                    </CommandItem>
                  ))}
              </CommandGroup>
            )}
          </CommandList>
          {error && (
            <p role="alert" className="border-t px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Removable chips for the tags being applied. Partially applied tags are marked. */
export function TagChips({
  tags,
  stateOf,
  onRemove,
  disabled,
}: {
  tags: TagOption[];
  stateOf?: (tagId: string) => TagState;
  onRemove: (tag: TagOption) => void;
  disabled?: boolean;
}) {
  if (!tags.length) return null;
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Tags">
      {tags.map((tag) => {
        const partial = stateOf?.(tag.id) === "some";
        return (
          <li
            key={tag.id}
            className={cn(
              "flex items-center gap-1 rounded-full border py-0.5 pr-0.5 pl-3 text-sm",
              partial ? "border-dashed text-muted-foreground" : "bg-secondary text-secondary-foreground",
            )}
          >
            {tag.label}
            {partial && <span className="sr-only"> (on some selected screens)</span>}
            <Button
              variant="ghost"
              size="icon"
              className="relative size-8 rounded-full after:absolute after:-inset-1.5"
              onClick={() => onRemove(tag)}
              disabled={disabled}
              aria-label={`Remove ${tag.label}`}
            >
              <X className="size-3.5" aria-hidden="true" />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
