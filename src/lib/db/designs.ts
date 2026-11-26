import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { DETAILS } from "./showcase";
import { SHOWCASE_TAG } from "./showcase-cache";

export const SITE_URL = "https://ref-index.vercel.app";
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type Font = { family?: string } | null;
type Facts = {
  description?: string | null;
  lang?: string | null;
  fonts?: { body?: Font; h1?: Font; h2?: Font; loaded?: string[] };
  palette?: { hex: string; share: number }[];
  hints?: string[];
};

/** The measured facts worth showing agents: fonts, dominant colours, platform hints (see scripts/extract-facts.ts). */
export function condenseFacts(facts: unknown) {
  const f = (facts ?? {}) as Facts;
  return {
    description: f.description ?? null,
    lang: f.lang ?? null,
    fonts: { heading: f.fonts?.h1?.family ?? f.fonts?.h2?.family ?? null, body: f.fonts?.body?.family ?? null, loaded: f.fonts?.loaded ?? [] },
    palette: (f.palette ?? []).map((c) => c.hex),
    built_with: f.hints ?? [],
  };
}

const slug = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "site";
export const designFileName = (id: string, name: string) => `${slug(name)}-${id.slice(0, 8)}.md`;

type SiteRow = { id: string; name: string; url: string | null; styles: string[] | null; categories: string[] | null };
type PageRow = { position: number; page_type: string | null; patterns: string[]; title: string | null; url: string | null; path: string };

/** One site's design note as Markdown: front matter, the note, then its tagged pages with image links. */
export function renderSiteMarkdown(site: SiteRow, designMd: string, pages: PageRow[]): string {
  const list = (v: string[] | null) => `[${(v ?? []).join(", ")}]`;
  const lines = [
    "---",
    `id: ${site.id}`,
    `name: ${JSON.stringify(site.name)}`,
    `url: ${site.url ?? ""}`,
    `page: ${SITE_URL}/site/${site.id}`,
    `styles: ${list(site.styles)}`,
    `categories: ${list(site.categories)}`,
    "status: first-pass note, written from screenshots and measured facts; some details may be off",
    "---",
    "",
    designMd.trim(),
  ];
  if (pages.length) {
    lines.push("", "## Pages", "");
    for (const p of pages) {
      const kind = p.position === 0 ? "home (full page)" : (p.page_type ?? "page");
      const patterns = p.patterns.length ? ` [${p.patterns.join(", ")}]` : "";
      const title = p.title ? ` ${p.title}` : "";
      lines.push(`- ${kind}${patterns}:${title}${p.url ? ` ${p.url}` : ""} - image ${DETAILS}/${p.path}`);
    }
  }
  return lines.join("\n") + "\n";
}

/** The Markdown for one listed site, or null if it isn't listed or has no note yet. */
export async function getSiteMarkdown(id: string): Promise<string | null> {
  if (!UUID.test(id)) return null;
  const db = createPublicClient();
  const [site, design, pages] = await Promise.all([
    db.from("showcase_items").select("id, name, url, styles, categories").eq("id", id).eq("status", "listed").maybeSingle(),
    db.from("showcase_designs").select("design_md").eq("item_id", id).maybeSingle(),
    db.from("showcase_pages").select("position, page_type, patterns, title, url, path").eq("item_id", id).order("position"),
  ]);
  if (site.error) throw site.error;
  if (design.error) throw design.error;
  if (pages.error) throw pages.error;
  if (!site.data || !design.data?.design_md) return null;
  return renderSiteMarkdown(site.data, design.data.design_md, pages.data ?? []);
}

export type DesignEntry = { id: string; name: string; url: string; design_md: string };

/** Every listed site's note (for /designs.md and /designs.zip), cached with the rest of the showcase data. */
export const loadDesignEntries = unstable_cache(
  async (): Promise<DesignEntry[]> => {
    const db = createPublicClient();
    const out: DesignEntry[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db
        .from("showcase_designs")
        .select("item_id, design_md, item:showcase_items!inner(id, name, url, status)")
        .eq("item.status", "listed")
        .not("design_md", "is", null)
        .order("item_id")
        .range(from, from + 999);
      if (error) throw error;
      for (const r of data as unknown as { design_md: string; item: { id: string; name: string; url: string } }[]) {
        out.push({ id: r.item.id, name: r.item.name, url: r.item.url, design_md: r.design_md });
      }
      if (data.length < 1000) break;
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  },
  ["design-entries-v1"],
  { revalidate: 86_400, tags: [SHOWCASE_TAG] },
);
