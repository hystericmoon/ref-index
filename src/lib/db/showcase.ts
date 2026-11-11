import type { DbClient } from "./client";

export type ShowcaseEntry = {
  id: string;
  name: string;
  url: string | null;
  platform: string;
  tags: string[];
  /** Public URL of a 1280×800 WebP of the site's first screen, when one was captured. */
  thumbUrl: string | null;
  /** The same picture 720px wide, for cards (null when there is no picture). */
  thumbSmallUrl: string | null;
  /** The picture is the site's own share image (og:image), not a screenshot: the site blocks capture scripts. */
  thumbIsShareImage: boolean;
  /** Chosen by an editor. */
  staffPick: boolean;
  /** How many galleries featured it. */
  galleryCount: number;
  /** Ids from src/lib/categories.ts. */
  categories: string[];
  /**
   * The first gallery page about it, linked only when the site has no live address. Gallery names
   * stay out of the public data: the site doesn't credit galleries (showcase_features is internal).
   */
  sourceUrl: string | null;
};

// Images live only on Cloudflare Pages (scripts/cdn-sync.ts uploads them; free traffic). The
// addresses come from .env.production and .env.local.
export const THUMBS = process.env.NEXT_PUBLIC_THUMBS_URL || "https://openrefs-thumbs.pages.dev";
export const DETAILS = process.env.NEXT_PUBLIC_DETAILS_URL || "https://openrefs-details.pages.dev";
export const THUMBS_SMALL = process.env.NEXT_PUBLIC_THUMBS_SM_URL || "https://openrefs-thumbs-sm.pages.dev";
const imageUrl = (path: string) => `${path.startsWith("img/details/") ? DETAILS : THUMBS}/${path}`;

// Cards are ~290-420 CSS px wide, so most screens need less than the 1280px thumbnail. Every thumbnail
// has a 720px copy at the same path on a third Pages project: scripts/cdn-sync.ts makes it before a
// capture is recorded.
const smallThumbUrl = (path: string | null) => (path ? `${THUMBS_SMALL}/${path}` : null);

/** top: staff picks only (the curated best-of) · all: every live entry. Dead sites are hidden, not shown. */
export type ShowcaseView = "top" | "all";
export const SHOWCASE_VIEWS: ShowcaseView[] = ["top", "all"];

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
        thumbUrl: row.thumb_path ? imageUrl(row.thumb_path) : null,
        thumbSmallUrl: smallThumbUrl(row.thumb_path),
        thumbIsShareImage: row.thumb_is_share_image,
        staffPick: row.staff_pick,
        galleryCount: row.gallery_count,
        categories: row.categories,
        sourceUrl: row.url ? null : ((row.featured as { sourceUrl: string }[])[0]?.sourceUrl ?? null),
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
    data.map((row) => [row.category, { top: Number(row.top), all: Number(row.everything) }]),
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
  return { top: Number(row?.top ?? 0), all: Number(row?.everything ?? 0) };
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
    thumbUrl: row.thumb_path ? imageUrl(row.thumb_path) : null,
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

/** Detail captures from scripts/capture-details.ts, as public URLs. */
export type ShowcaseDetails = {
  full: string;
  /** Height of the full-page capture in CSS pixels at 1280 wide. */
  fullHeight: number;
  pages: { url: string; title: string; imageUrl: string }[];
};

export type ShowcaseItem = ShowcaseEntry & { status: string; details: ShowcaseDetails | null };

/** One showcase item for its detail page (/site/[id]), or null when it doesn't exist or is hidden. */
export async function getShowcaseItem(db: DbClient, id: string): Promise<ShowcaseItem | null> {
  const [{ data: row, error }, { data: features, error: featuresError }] = await Promise.all([
    db
      .from("showcase_items")
      .select("id, name, url, platform, tags, thumb_path, thumb_is_share_image, staff_pick, gallery_count, categories, status, details")
      .eq("id", id)
      .maybeSingle(),
    db.from("showcase_features").select("source_url").eq("item_id", id).order("first_seen").limit(1),
  ]);
  if (error) throw error;
  if (featuresError) throw featuresError;
  if (!row || row.status === "hidden") return null;
  const d = row.details as { full: string; fullHeight: number; pages: { path: string; url: string; title: string }[] } | null;
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    platform: row.platform,
    tags: row.tags,
    thumbUrl: row.thumb_path ? imageUrl(row.thumb_path) : null,
    thumbSmallUrl: smallThumbUrl(row.thumb_path),
    thumbIsShareImage: row.thumb_is_share_image,
    staffPick: row.staff_pick,
    galleryCount: row.gallery_count,
    categories: row.categories,
    sourceUrl: row.url ? null : (features?.[0]?.source_url ?? null),
    status: row.status,
    details: d
      ? { full: imageUrl(d.full), fullHeight: d.fullHeight, pages: d.pages.map((p) => ({ url: p.url, title: p.title, imageUrl: imageUrl(p.path) })) }
      : null,
  };
}
