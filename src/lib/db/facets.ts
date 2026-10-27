import { must, type DbClient, type Row } from "./client";

export type Facet = Row<"facets">;
export type FacetKey = "screen_type" | "ui_element" | "pattern" | "platform" | "industry";

export async function listFacets(db: DbClient): Promise<Facet[]> {
  return must(await db.from("facets").select("*").order("sort_order"));
}

/** Facets in display order, each with its tags A–Z. Feeds the filter sidebar. */
export async function listFacetsWithTags(db: DbClient) {
  return must(
    await db.from("facets").select("*, tags(*)").order("sort_order").order("label", { referencedTable: "tags" }),
  );
}
