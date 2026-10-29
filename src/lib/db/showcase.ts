import type { DbClient } from "./client";

export type ShowcaseEntry = {
  id: string;
  name: string;
  url: string | null;
  platform: string;
  tags: string[];
  /** Public URL of a 640×400 WebP of the site's first screen, when one was captured. */
  thumbUrl: string | null;
  /** Chosen by an editor. */
  staffPick: boolean;
  /** How many galleries featured it. */
  galleryCount: number;
  /** Ids from src/lib/categories.ts. */
  categories: string[];
  featured: { gallery: string; sourceUrl: string }[];
};

const THUMBS = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/showcase`;

/** top: staff picks and sites featured by 2+ galleries · all: every live entry · archive: sites that are gone. */
export type ShowcaseView = "top" | "all" | "archive";
export const SHOWCASE_VIEWS: ShowcaseView[] = ["top", "all", "archive"];

export type ShowcaseQuery = { q?: string; medium?: string; gallery?: string; view?: ShowcaseView; category?: string; offset?: number; limit?: number };

/** One page of showcase items matching a search (the `search_showcase` RPC), newest first. */
export async function searchShowcase(db: DbClient, query: ShowcaseQuery = {}) {
  const { data, error } = await db.rpc("search_showcase", {
    p_query: query.q?.trim() || undefined,
    p_medium: query.medium || "all",
    p_gallery: query.gallery || undefined,
    p_offset: query.offset ?? 0,
    p_limit: query.limit ?? 60,
    p_view: query.view ?? "top",
    p_category: query.category || undefined,
  });
  if (error) throw error;
  return {
    items: data.map(
      (row): ShowcaseEntry => ({
        id: row.id,
        name: row.name,
        url: row.url,
        platform: row.platform,
        tags: row.tags,
        thumbUrl: row.thumb_path ? `${THUMBS}/${row.thumb_path}` : null,
        staffPick: row.staff_pick,
        galleryCount: row.gallery_count,
        categories: row.categories,
        featured: row.featured as ShowcaseEntry["featured"],
      }),
    ),
    total: Number(data[0]?.total ?? 0),
  };
}

export type CategoryCounts = Record<string, Record<ShowcaseView, number>>;

/** How many items each category holds in each view, by category id. */
export async function getCategoryCounts(db: DbClient): Promise<CategoryCounts> {
  const { data, error } = await db.rpc("showcase_category_counts");
  if (error) throw error;
  return Object.fromEntries(
    data.map((row) => [row.category, { top: Number(row.top), all: Number(row.everything), archive: Number(row.archive) }]),
  );
}

/** How many items each gallery has featured, A–Z. */
export async function listGalleryCounts(db: DbClient): Promise<[string, number][]> {
  const { data, error } = await db.rpc("showcase_gallery_counts");
  if (error) throw error;
  return data.map((row) => [row.gallery, Number(row.items)]);
}


/** How many entries each view holds. */
export async function getViewCounts(db: DbClient): Promise<Record<ShowcaseView, number>> {
  const { data, error } = await db.rpc("showcase_view_counts");
  if (error) throw error;
  const row = data[0];
  return { top: Number(row?.top ?? 0), all: Number(row?.everything ?? 0), archive: Number(row?.archive ?? 0) };
}

export type ReviewItem = { id: string; name: string; url: string | null; platform: string; thumbUrl: string | null; galleryCount: number; galleries: string[]; categories: string[]; aiFlag: string | null };

/** new: unreviewed sites · flagged: unreviewed sites the AI thinks look broken or low quality. */
export type ReviewQueueName = "new" | "flagged";

/** The editor's queue: unreviewed entries with a screenshot, most-featured (or most broken) first. */
export async function getReviewQueue(db: DbClient, limit = 24, queue: ReviewQueueName = "new"): Promise<ReviewItem[]> {
  const { data, error } = await db.rpc("showcase_review_queue", { p_limit: limit, p_queue: queue });
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    url: row.url,
    platform: row.platform,
    thumbUrl: row.thumb_path ? `${THUMBS}/${row.thumb_path}` : null,
    galleryCount: row.gallery_count,
    galleries: row.galleries,
    categories: row.categories,
    aiFlag: row.ai_flag,
  }));
}

/** How many unreviewed sites wait in each queue. */
export async function getQueueCounts(db: DbClient): Promise<Record<ReviewQueueName, number>> {
  const { data, error } = await db.rpc("showcase_queue_counts");
  if (error) throw error;
  return { new: Number(data[0]?.new ?? 0), flagged: Number(data[0]?.flagged ?? 0) };
}

export type ReviewAction = "keep" | "feature" | "hide";

/** Records an editor's decision. The database refuses anyone who isn't an editor. */
export async function reviewItem(db: DbClient, id: string, action: ReviewAction) {
  const { error } = await db.rpc("review_showcase_item", { p_id: id, p_action: action });
  if (error) throw error;
}

/** Sets an item's categories by hand; the sorting scripts leave it alone afterwards. */
export async function setCategories(db: DbClient, id: string, categories: string[]) {
  const { error } = await db.rpc("set_showcase_categories", { p_id: id, p_categories: categories });
  if (error) throw error;
}

export async function isEditor(db: DbClient): Promise<boolean> {
  const { data, error } = await db.rpc("is_editor");
  if (error) return false;
  return data === true;
}
