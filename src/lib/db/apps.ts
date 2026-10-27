import { containsPattern, must, mustOne, type DbClient, type Insert, type Row, type Update } from "./client";

export type App = Row<"apps">;

/** The signed-in user's apps, A–Z. */
export async function listApps(db: DbClient): Promise<App[]> {
  return must(await db.from("apps").select("*").order("name"));
}

export async function getApp(db: DbClient, id: string): Promise<App | null> {
  return must(await db.from("apps").select("*").eq("id", id).maybeSingle());
}

/** Fuzzy name match for the app picker (backed by the trigram index on apps.name). */
export async function searchApps(db: DbClient, term: string, limit = 10): Promise<App[]> {
  return must(await db.from("apps").select("*").ilike("name", containsPattern(term)).order("name").limit(limit));
}

/** owner_id defaults to the signed-in user. */
export async function createApp(db: DbClient, app: Omit<Insert<"apps">, "owner_id">): Promise<App> {
  return mustOne(await db.from("apps").insert(app).select().single());
}

export async function updateApp(db: DbClient, id: string, patch: Omit<Update<"apps">, "id" | "owner_id">): Promise<App> {
  return mustOne(await db.from("apps").update(patch).eq("id", id).select().single());
}

/** Also deletes the app's screens and flows. */
export async function deleteApp(db: DbClient, id: string): Promise<void> {
  must(await db.from("apps").delete().eq("id", id));
}
