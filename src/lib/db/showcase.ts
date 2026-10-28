import type { DbClient } from "./client";

export type ShowcaseEntry = {
  id: string;
  name: string;
  url: string | null;
  platform: string;
  tags: string[];
  featured: { gallery: string; sourceUrl: string }[];
};

/** Every showcase item with the galleries that featured it, newest first. */
export async function listShowcase(db: DbClient): Promise<ShowcaseEntry[]> {
  const { data, error } = await db
    .from("showcase_items")
    .select("id, name, url, platform, tags, showcase_features(gallery, source_url, first_seen)")
    .order("first_seen", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data.map((item) => ({
    id: item.id,
    name: item.name,
    url: item.url,
    platform: item.platform,
    tags: item.tags,
    featured: [...item.showcase_features]
      .sort((a, b) => a.first_seen.localeCompare(b.first_seen))
      .map((f) => ({ gallery: f.gallery, sourceUrl: f.source_url })),
  }));
}
