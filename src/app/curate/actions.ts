"use server";

import { CATEGORY_IDS } from "@/lib/categories";
import { getReviewQueue, isEditor, reviewItem, setCategories, type ReviewAction, type ReviewItem, type ReviewQueueName } from "@/lib/db/showcase";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIONS: ReviewAction[] = ["keep", "feature", "hide"];

/** Saves one decision. The database checks the caller is an editor. */
export async function reviewAction(id: string, action: ReviewAction): Promise<{ ok: boolean }> {
  if (!UUID.test(id) || !ACTIONS.includes(action)) return { ok: false };
  try {
    await reviewItem(await createClient(), id, action);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** Replaces an item's categories. The database checks the caller is an editor. */
export async function categoriesAction(id: string, categories: string[]): Promise<{ ok: boolean }> {
  if (!UUID.test(id) || categories.length > 6 || !categories.every((c) => CATEGORY_IDS.has(c))) return { ok: false };
  try {
    await setCategories(await createClient(), id, categories);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** The next unreviewed entries, skipping ones already on screen. */
export async function moreToReview(exclude: string[], queue: ReviewQueueName = "new"): Promise<ReviewItem[]> {
  const skip = new Set(exclude.filter((id) => UUID.test(id)).slice(0, 200));
  const items = await getReviewQueue(await createClient(), 60, queue === "flagged" ? "flagged" : "new");
  return items.filter((item) => !skip.has(item.id)).slice(0, 24);
}

/** Whether the signed-in visitor can curate, for showing editor tools on public pages. */
export async function amEditor(): Promise<boolean> {
  return isEditor(await createClient());
}
