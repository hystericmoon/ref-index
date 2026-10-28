import type { DbClient } from "@/lib/db/client";
import { listFacetsWithTags } from "@/lib/db/facets";

/** Plain shapes the tag picker needs; safe to pass from server to client components. */
export type TagOption = { id: string; label: string; facetId: string; synonyms: string[] };
export type FacetOption = { id: string; key: string; label: string; tags: TagOption[] };

export async function loadTagOptions(db: DbClient): Promise<FacetOption[]> {
  const facets = await listFacetsWithTags(db);
  return facets.map((facet) => ({
    id: facet.id,
    key: facet.key,
    label: facet.label,
    tags: facet.tags.map((tag) => ({ id: tag.id, label: tag.label, facetId: facet.id, synonyms: tag.synonyms })),
  }));
}
