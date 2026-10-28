import { listScreens, screenCursor } from "@/lib/db/screens";
import { signScreenUrls } from "@/lib/db/storage";
import { createClient } from "@/lib/supabase/server";

export const PAGE_SIZE = 40;

export type GridScreen = {
  id: string;
  appName: string;
  width: number | null;
  height: number | null;
  thumbUrl: string | null;
};

export type ScreenPage = { screens: GridScreen[]; nextCursor: string | null };

/** One page of the signed-in user's screens with signed thumbnail URLs. */
export async function loadScreenPage(before?: string): Promise<ScreenPage> {
  const db = await createClient();
  const rows = await listScreens(db, { before, limit: PAGE_SIZE });
  const urls = await signScreenUrls(db, rows.flatMap((row) => (row.thumb_path ? [row.thumb_path] : [])));
  return {
    screens: rows.map((row) => ({
      id: row.id,
      appName: row.app?.name ?? "Untitled app",
      width: row.width,
      height: row.height,
      thumbUrl: row.thumb_path ? (urls.get(row.thumb_path) ?? null) : null,
    })),
    nextCursor: rows.length === PAGE_SIZE ? screenCursor(rows[rows.length - 1]) : null,
  };
}
