import { must, mustOne, type DbClient, type Insert, type Row, type Update } from "./client";

export type Screen = Row<"screens">;

export type ListScreensOptions = {
  appId?: string;
  /** Screens carrying any of these tags. */
  tagIds?: string[];
  /** Full-text search over app name, tag labels and synonyms, and notes. */
  query?: string;
  /** Cursor from `screenCursor`: only screens after this one in newest-first order. */
  before?: string;
  limit?: number;
};

/** Cursor for the screen after which the next page starts. */
export function screenCursor(screen: Pick<Screen, "captured_at" | "id">): string {
  return `${screen.captured_at}|${screen.id}`;
}

/** The signed-in user's screens, newest first, with their app and tag ids. */
export async function listScreens(db: DbClient, options: ListScreensOptions = {}) {
  const { appId, tagIds, query, before, limit = 50 } = options;
  let q = db.from("screens").select("*, app:apps(id, name, platform), screen_tags(tag_id)");
  if (tagIds?.length) {
    const tagged = must(await db.from("screen_tags").select("screen_id").in("tag_id", tagIds));
    q = q.in("id", [...new Set(tagged.map((row) => row.screen_id))]);
  }
  if (appId) q = q.eq("app_id", appId);
  if (query?.trim()) q = q.textSearch("search_vector", query, { config: "english", type: "websearch" });
  if (before) {
    // Screens can share a captured_at, so the id breaks ties.
    const [at, id] = before.split("|");
    q = id ? q.or(`captured_at.lt."${at}",and(captured_at.eq."${at}",id.lt.${id})`) : q.lt("captured_at", at);
  }
  return must(
    await q.order("captured_at", { ascending: false }).order("id", { ascending: false }).limit(limit),
  );
}

export type LibraryQuery = {
  /** ANDed across facets, ORed within a facet; platform tags also match the app's platform. */
  tagIds?: string[];
  /** Full-text search with typo-tolerant fallback on app names and tag labels. */
  query?: string;
  /** Cursor from `screenCursor`. */
  before?: string;
  limit?: number;
};

/** Filtered, searched, paginated screens in one round trip (the `search_screens` RPC). */
export async function searchLibrary(db: DbClient, options: LibraryQuery = {}) {
  const { tagIds = [], query, before, limit = 40 } = options;
  const [beforeAt, beforeId] = before ? before.split("|") : [];
  return must(
    await db.rpc("search_screens", {
      p_tag_ids: tagIds,
      p_query: query?.trim() || undefined,
      p_before_at: beforeAt && beforeId ? beforeAt : undefined,
      p_before_id: beforeAt && beforeId ? beforeId : undefined,
      p_limit: limit,
    }),
  );
}

/** The screens just newer (prev) and just older (next) than this one, across the whole library. */
export async function getScreenNeighbors(db: DbClient, screen: Pick<Screen, "captured_at" | "id">) {
  const at = `"${screen.captured_at}"`;
  const [prev, next] = await Promise.all([
    db
      .from("screens")
      .select("id")
      .or(`captured_at.gt.${at},and(captured_at.eq.${at},id.gt.${screen.id})`)
      .order("captured_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle(),
    db
      .from("screens")
      .select("id")
      .or(`captured_at.lt.${at},and(captured_at.eq.${at},id.lt.${screen.id})`)
      .order("captured_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  return { prev: must(prev)?.id ?? null, next: must(next)?.id ?? null };
}

export async function searchScreens(db: DbClient, query: string, limit = 50) {
  return listScreens(db, { query, limit });
}

/** One screen with its app and tag ids, or null when missing or not the user's. */
export async function getScreen(db: DbClient, id: string) {
  const { data, error } = await db
    .from("screens")
    .select("*, app:apps(id, name, platform), screen_tags(tag_id)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
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
