import type { FacetOption } from "@/lib/tags";

/**
 * Library filters live in the URL: one param per facet key holding comma-separated tag
 * slugs, plus `q` for the search text. e.g. /library?platform=ios&industry=fintech&q=paywall
 */
export type LibraryFilters = { q: string; tagIds: string[] };

type Params = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseFilters(params: Params, facets: FacetOption[]): LibraryFilters {
  const tagIds: string[] = [];
  for (const facet of facets) {
    const slugs = (first(params[facet.key]) ?? "").split(",").filter(Boolean);
    for (const slug of slugs) {
      const tag = facet.tags.find((t) => t.slug === slug);
      if (tag) tagIds.push(tag.id);
    }
  }
  return { q: (first(params.q) ?? "").trim().slice(0, 200), tagIds };
}

/** The query string for a set of filters, facets in display order. Empty when nothing is set. */
export function filtersToSearch(filters: LibraryFilters, facets: FacetOption[]): string {
  const params = new URLSearchParams();
  for (const facet of facets) {
    const slugs = facet.tags.filter((t) => filters.tagIds.includes(t.id)).map((t) => t.slug);
    if (slugs.length) params.set(facet.key, slugs.join(","));
  }
  if (filters.q) params.set("q", filters.q);
  const search = params.toString().replace(/%2C/g, ",");
  return search ? `?${search}` : "";
}

export function hasFilters(filters: LibraryFilters) {
  return filters.q !== "" || filters.tagIds.length > 0;
}
