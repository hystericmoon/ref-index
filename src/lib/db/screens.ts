import { must, mustOne, type DbClient, type Insert, type Row, type Update } from "./client";

export type Screen = Row<"screens">;

export type ListScreensOptions = {
  appId?: string;
  /** Screens carrying any of these tags. */
  tagIds?: string[];
  /** Full-text search over app name, tag labels and synonyms, and notes. */
  query?: string;
  /** Cursor: only screens captured before this ISO timestamp. */
  before?: string;
  limit?: number;
};

/** The signed-in user's screens, newest first, with their app. */
export async function listScreens(db: DbClient, options: ListScreensOptions = {}) {
  const { appId, tagIds, query, before, limit = 50 } = options;
  let q = db.from("screens").select("*, app:apps(id, name, platform)");
  if (tagIds?.length) {
    const tagged = must(await db.from("screen_tags").select("screen_id").in("tag_id", tagIds));
    q = q.in("id", [...new Set(tagged.map((row) => row.screen_id))]);
  }
  if (appId) q = q.eq("app_id", appId);
  if (query?.trim()) q = q.textSearch("search_vector", query, { config: "english", type: "websearch" });
  if (before) q = q.lt("captured_at", before);
  return must(await q.order("captured_at", { ascending: false }).limit(limit));
}

export async function searchScreens(db: DbClient, query: string, limit = 50) {
  return listScreens(db, { query, limit });
}

/** One screen with its app and tags, or null when missing or not the user's. */
export async function getScreen(db: DbClient, id: string) {
  return must(
    await db.from("screens").select("*, app:apps(*), screen_tags(tag:tags(*))").eq("id", id).maybeSingle(),
  );
}

type ScreenInput = Omit<Insert<"screens">, "owner_id" | "search_vector">;

/** owner_id defaults to the signed-in user; search_vector is maintained by triggers. */
export async function createScreens(db: DbClient, screens: ScreenInput[]): Promise<Screen[]> {
  return must(await db.from("screens").insert(screens).select());
}

export async function updateScreen(
  db: DbClient,
  id: string,
  patch: Omit<Update<"screens">, "id" | "owner_id" | "search_vector">,
): Promise<Screen> {
  return mustOne(await db.from("screens").update(patch).eq("id", id).select().single());
}

export async function deleteScreens(db: DbClient, ids: string[]): Promise<void> {
  must(await db.from("screens").delete().in("id", ids));
}
