import { condenseFacts } from "@/lib/db/designs";
import { THUMBS, DETAILS } from "@/lib/db/showcase";
import { SHOWCASE_TAG } from "@/lib/db/showcase-cache";
import { createPublicClient } from "@/lib/supabase/public";
import { unstable_cache } from "next/cache";

const SITE = "https://ref-index.vercel.app";
const PAGE = 1000;

/** Every live listed site as plain records, for AI agents and scripts (see /llms.txt). */
const loadAll = unstable_cache(
  async () => {
    const db = createPublicClient();
    const rows: Record<string, unknown>[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db
        .from("showcase_items")
        .select("id, name, url, platform, styles, categories, thumb_path, staff_pick")
        .eq("status", "listed")
        .not("url", "is", null)
        // same rule as the site's "all" view: hide dead sites (checked, no picture)
        .or("thumb_checked_at.is.null,thumb_path.not.is.null")
        .order("id")
        .range(from, from + PAGE - 1);
      if (error) throw error;
      for (const r of data) {
        const thumb = r.thumb_path ? `${r.thumb_path.startsWith("img/details/") ? DETAILS : THUMBS}/${r.thumb_path}` : null;
        rows.push({
          id: r.id,
          name: r.name,
          url: r.url,
          page: `${SITE}/site/${r.id}`,
          medium: r.platform,
          styles: r.styles,
          categories: r.categories,
          staff_pick: r.staff_pick,
          image: thumb,
        });
      }
      if (data.length < PAGE) break;
    }
    // Tagged page screenshots (home page first), grouped by site.
    const pages = new Map<string, unknown[]>();
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db
        .from("showcase_pages")
        .select("item_id, position, page_type, patterns, title, url, path")
        .order("item_id")
        .order("position")
        .range(from, from + PAGE - 1);
      if (error) throw error;
      for (const p of data) {
        const list = pages.get(p.item_id) ?? [];
        list.push({ type: p.page_type, patterns: p.patterns, title: p.title, url: p.url, image: `${DETAILS}/${p.path}` });
        pages.set(p.item_id, list);
      }
      if (data.length < PAGE) break;
    }
    for (const row of rows) row.pages = pages.get(row.id as string) ?? [];
    // Design notes: a link to each site's Markdown note plus the measured facts (fonts, palette, platform).
    const designs = new Map<string, unknown>();
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db
        .from("showcase_designs")
        .select("item_id, facts")
        .not("design_md", "is", null)
        .order("item_id")
        .range(from, from + PAGE - 1);
      if (error) throw error;
      for (const d of data) designs.set(d.item_id, condenseFacts(d.facts));
      if (data.length < PAGE) break;
    }
    for (const row of rows) {
      const facts = designs.get(row.id as string);
      row.design = facts ? `${SITE}/site/${row.id}.md` : null;
      row.facts = facts ?? null;
    }
    return rows;
  },
  ["references-dump-v3"],
  { revalidate: 86_400, tags: [SHOWCASE_TAG] },
);

export async function GET() {
  const items = await loadAll();
  return Response.json(
    { generated: new Date().toISOString(), count: items.length, items },
    { headers: { "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400", "access-control-allow-origin": "*" } },
  );
}
