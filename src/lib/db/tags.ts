import { containsPattern, must, mustOne, type DbClient, type Row } from "./client";
import type { FacetKey } from "./facets";

export type Tag = Row<"tags">;

const withFacet = "*, facet:facets!inner(key, label)";

/** All tags, or one facet's tags, A–Z. */
export async function listTags(db: DbClient, options: { facetKey?: FacetKey } = {}) {
  let q = db.from("tags").select(withFacet);
  if (options.facetKey) q = q.eq("facet.key", options.facetKey);
  return must(await q.order("label"));
}

export async function getTagBySlug(db: DbClient, facetKey: FacetKey, slug: string) {
  return must(await db.from("tags").select(withFacet).eq("facet.key", facetKey).eq("slug", slug).maybeSingle());
}

/** "Bottom sheet!" → "bottom-sheet"; null when nothing usable is left. */
export function tagSlug(label: string): string | null {
  const slug = label
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || null;
}

/** Add a tag to a facet, or return the facet's existing tag with the same slug. */
export async function createTag(db: DbClient, facetId: string, label: string): Promise<Tag> {
  const slug = tagSlug(label);
  if (!slug) throw new Error("Tag labels need at least one letter or number.");
  const inserted = await db.from("tags").insert({ facet_id: facetId, slug, label: label.trim() }).select().single();
  if (!inserted.error) return inserted.data;
  if (inserted.error.code !== "23505") throw inserted.error;
  return mustOne(await db.from("tags").select("*").eq("facet_id", facetId).eq("slug", slug).single());
}

/** Fuzzy label match for tag pickers (backed by the trigram index on tags.label). */
export async function searchTags(db: DbClient, term: string, limit = 20) {
  return must(
    await db.from("tags").select(withFacet).ilike("label", containsPattern(term)).order("label").limit(limit),
  );
}
