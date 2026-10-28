import { screenCursor, searchLibrary } from "@/lib/db/screens";
import { signScreenUrls } from "@/lib/db/storage";
import type { LibraryFilters } from "@/lib/library-filters";
import { createClient } from "@/lib/supabase/server";

export const PAGE_SIZE = 40;

export type GridScreen = {
  id: string;
  appName: string;
  width: number | null;
  height: number | null;
  thumbUrl: string | null;
  tagIds: string[];
};

export type ScreenPage = { screens: GridScreen[]; nextCursor: string | null };

/** One page of the signed-in user's screens matching the filters, with signed thumbnail URLs. */
export async function loadScreenPage(filters: LibraryFilters, before?: string): Promise<ScreenPage> {
  const db = await createClient();
  const rows = await searchLibrary(db, { tagIds: filters.tagIds, query: filters.q, before, limit: PAGE_SIZE });
  const urls = await signScreenUrls(db, rows.flatMap((row) => (row.thumb_path ? [row.thumb_path] : [])));
  return {
    screens: rows.map((row) => ({
      id: row.id,
      appName: row.app_name,
      width: row.width,
      height: row.height,
      thumbUrl: row.thumb_path ? (urls.get(row.thumb_path) ?? null) : null,
      tagIds: row.tag_ids ?? [],
    })),
    nextCursor: rows.length === PAGE_SIZE ? screenCursor(rows[rows.length - 1]) : null,
  };
}
