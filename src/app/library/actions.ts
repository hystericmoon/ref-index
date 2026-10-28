"use server";

import { getCurrentUser } from "@/lib/auth";
import { loadScreenPage, type ScreenPage } from "./data";

export async function loadMoreScreens(cursor: string): Promise<ScreenPage> {
  if (!(await getCurrentUser())) return { screens: [], nextCursor: null };
  return loadScreenPage(cursor);
}
