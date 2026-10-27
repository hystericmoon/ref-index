import { must, type DbClient, type Row } from "./client";

export type Source = Row<"sources">;

/** Directory sources in their curated order. Inactive ones are hidden unless asked for. */
export async function listSources(db: DbClient, options: { includeInactive?: boolean } = {}): Promise<Source[]> {
  let q = db.from("sources").select("*");
  if (!options.includeInactive) q = q.eq("active", true);
  return must(await q.order("sort_order"));
}

export async function getSource(db: DbClient, id: string): Promise<Source | null> {
  return must(await db.from("sources").select("*").eq("id", id).maybeSingle());
}
