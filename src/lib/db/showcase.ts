import type { DbClient } from "./client";

export type ShowcaseEntry = {
  id: string;
  name: string;
  url: string | null;
  platform: string;
  tags: string[];
  featured: { gallery: string; sourceUrl: string }[];
};

export type ShowcaseQuery = { q?: string; medium?: string; gallery?: string; offset?: number; limit?: number };

/** One page of showcase items matching a search (the `search_showcase` RPC), newest first. */
export async function searchShowcase(db: DbClient, query: ShowcaseQuery = {}) {
  const { data, error } = await db.rpc("search_showcase", {
    p_query: query.q?.trim() || undefined,
    p_medium: query.medium || "all",
    p_gallery: query.gallery || undefined,
    p_offset: query.offset ?? 0,
    p_limit: query.limit ?? 60,
  });
  if (error) throw error;
  return {
    items: data.map(
      (row): ShowcaseEntry => ({
        id: row.id,
        name: row.name,
        url: row.url,
        platform: row.platform,
        tags: row.tags,
        featured: row.featured as ShowcaseEntry["featured"],
      }),
    ),
    total: Number(data[0]?.total ?? 0),
  };
}

/** How many items each gallery has featured, A–Z. */
export async function listGalleryCounts(db: DbClient): Promise<[string, number][]> {
  const { data, error } = await db.rpc("showcase_gallery_counts");
  if (error) throw error;
  return data.map((row) => [row.gallery, Number(row.items)]);
}

