import { containsPattern, must, type DbClient, type Row } from "./client";
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

/** Fuzzy label match for tag pickers (backed by the trigram index on tags.label). */
export async function searchTags(db: DbClient, term: string, limit = 20) {
  return must(
    await db.from("tags").select(withFacet).ilike("label", containsPattern(term)).order("label").limit(limit),
  );
}
