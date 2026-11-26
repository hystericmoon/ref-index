import { unstable_cache } from "next/cache";
import type { ReactNode } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import { SHOWCASE_TAG } from "@/lib/db/showcase-cache";
import { CopyPromptButton } from "./copy-prompt-button";

const loadNote = unstable_cache(
  async (id: string) => {
    const { data, error } = await createPublicClient().from("showcase_designs").select("design_md").eq("item_id", id).maybeSingle();
    if (error) throw error;
    return data?.design_md ?? null;
  },
  ["design-note"],
  { revalidate: 600, tags: [SHOWCASE_TAG] },
);

const HEX = /#[0-9a-f]{6}\b/i;

/** A list line; a colour line gets a swatch in front of it. */
function Line({ text }: { text: string }): ReactNode {
  const hex = text.match(HEX)?.[0];
  return (
    <li className="flex items-start gap-2">
      {hex && <span aria-hidden="true" className="mt-1 size-4 shrink-0 rounded border" style={{ backgroundColor: hex }} />}
      <span>{text}</span>
    </li>
  );
}

/** The site's design note (see /designs.zip): palette, type, layout, motion, what makes it good. */
export async function DesignNote({ id }: { id: string }) {
  const md = await loadNote(id);
  if (!md) return null;
  // The note is Markdown in a fixed template: "## Heading", "- list item", paragraphs. The "# Title" and
  // "Facts" parts repeat what the page already shows.
  const sections: { title: string; lines: string[] }[] = [];
  for (const raw of md.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("# ")) continue;
    if (line.startsWith("## ")) sections.push({ title: line.slice(3), lines: [] });
    else if (sections.length) sections[sections.length - 1].lines.push(line);
  }
  const shown = sections.filter((s) => s.title !== "Facts");
  if (!shown.length) return null;
  return (
    <section aria-labelledby="design-note" className="flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="design-note" className="text-lg font-semibold tracking-tight">
          Design notes
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <CopyPromptButton id={id} />
          <a href={`/site/${id}.md`} className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
            Markdown version
          </a>
        </div>
      </div>
      <div className="flex flex-col gap-4 text-sm leading-6">
        {shown.map((s) => (
          <div key={s.title} className="flex flex-col gap-1">
            <h3 className="font-medium">{s.title}</h3>
            {s.lines.every((l) => l.startsWith("- ")) ? (
              <ul className="flex flex-col gap-1 text-muted-foreground">
                {s.lines.map((l) => (
                  <Line key={l} text={l.slice(2)} />
                ))}
              </ul>
            ) : (
              s.lines.map((l) => (
                <p key={l} className="text-muted-foreground">
                  {l.startsWith("- ") ? l.slice(2) : l}
                </p>
              ))
            )}
          </div>
        ))}
        <p className="text-xs text-muted-foreground">First-pass note written from screenshots and measured facts; some details may be off.</p>
      </div>
    </section>
  );
}
