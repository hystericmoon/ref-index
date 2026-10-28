"use server";

import { getCurrentUser } from "@/lib/auth";
import type { LibraryFilters } from "@/lib/library-filters";
import { loadScreenPage, type ScreenPage } from "./data";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function loadMoreScreens(filters: LibraryFilters, cursor: string): Promise<ScreenPage> {
  if (!(await getCurrentUser())) return { screens: [], nextCursor: null };
  const clean: LibraryFilters = {
    q: String(filters?.q ?? "").slice(0, 200),
    tagIds: (filters?.tagIds ?? []).filter((id) => UUID.test(id)).slice(0, 50),
  };
  return loadScreenPage(clean, cursor);
}
