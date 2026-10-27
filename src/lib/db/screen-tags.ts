import { must, type DbClient, type Row } from "./client";

export type ScreenTag = Row<"screen_tags">;

/** Tags on one screen, with their facet. */
export async function listScreenTags(db: DbClient, screenId: string) {
  const rows = must(
    await db.from("screen_tags").select("tag:tags(*, facet:facets(key, label))").eq("screen_id", screenId),
  );
  return rows.map((row) => row.tag);
}

/** Bulk tagging: every screen gets every tag. Pairs that already exist are left alone. */
export async function addScreenTags(db: DbClient, screenIds: string[], tagIds: string[]): Promise<void> {
  const rows = screenIds.flatMap((screen_id) => tagIds.map((tag_id) => ({ screen_id, tag_id })));
  if (!rows.length) return;
  must(await db.from("screen_tags").upsert(rows, { onConflict: "screen_id,tag_id", ignoreDuplicates: true }));
}

export async function removeScreenTags(db: DbClient, screenIds: string[], tagIds: string[]): Promise<void> {
  if (!screenIds.length || !tagIds.length) return;
  must(await db.from("screen_tags").delete().in("screen_id", screenIds).in("tag_id", tagIds));
}

/** Make one screen's tags exactly `tagIds`. */
export async function setScreenTags(db: DbClient, screenId: string, tagIds: string[]): Promise<void> {
  let remove = db.from("screen_tags").delete().eq("screen_id", screenId);
  if (tagIds.length) remove = remove.not("tag_id", "in", `(${tagIds.join(",")})`);
  must(await remove);
  await addScreenTags(db, [screenId], tagIds);
}
