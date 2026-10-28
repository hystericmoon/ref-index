"use server";

import { getCurrentUser } from "@/lib/auth";
import { addScreenTags, removeScreenTags } from "@/lib/db/screen-tags";
import { createTag } from "@/lib/db/tags";
import { createClient } from "@/lib/supabase/server";
import type { TagOption } from "@/lib/tags";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SCREENS = 1000;

type Result<T> = { ok: true; data: T } | { ok: false; reason: string };

function validIds(ids: string[], max: number) {
  return Array.isArray(ids) && ids.length > 0 && ids.length <= max && ids.every((id) => UUID.test(id));
}

async function signedIn() {
  return (await getCurrentUser()) ? createClient() : null;
}

export async function createTagAction(facetId: string, label: string): Promise<Result<TagOption>> {
  const name = label.trim().replace(/\s+/g, " ");
  if (!UUID.test(facetId)) return { ok: false, reason: "Pick a facet for the new tag." };
  if (!name || name.length > 40) return { ok: false, reason: "Tag names are 1–40 characters." };
  const db = await signedIn();
  if (!db) return { ok: false, reason: "You're signed out. Sign in again and retry." };
  try {
    const tag = await createTag(db, facetId, name);
    return { ok: true, data: { id: tag.id, slug: tag.slug, label: tag.label, facetId: tag.facet_id, synonyms: tag.synonyms } };
  } catch (error) {
    console.error(error);
    return { ok: false, reason: error instanceof Error && error.message.startsWith("Tag") ? error.message : "We couldn't create the tag." };
  }
}

export async function changeScreenTagsAction(
  change: "add" | "remove",
  screenIds: string[],
  tagIds: string[],
): Promise<Result<null>> {
  if (!validIds(screenIds, MAX_SCREENS) || !validIds(tagIds, 50)) return { ok: false, reason: "Nothing to change." };
  const db = await signedIn();
  if (!db) return { ok: false, reason: "You're signed out. Sign in again and retry." };
  try {
    if (change === "add") await addScreenTags(db, screenIds, tagIds);
    else await removeScreenTags(db, screenIds, tagIds);
    return { ok: true, data: null };
  } catch (error) {
    console.error(error);
    return { ok: false, reason: change === "add" ? "We couldn't add the tags. Try again." : "We couldn't remove the tags. Try again." };
  }
}
