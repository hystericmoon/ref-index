"use server";

import sharp from "sharp";
import { getCurrentUser } from "@/lib/auth";
import { createApp, type App } from "@/lib/db/apps";
import { appendFlowScreens } from "@/lib/db/flow-screens";
import { createFlow, listFlows, type Flow } from "@/lib/db/flows";
import { createScreens } from "@/lib/db/screens";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "screens";
const THUMB_WIDTH = 480;
const PLATFORMS = ["ios", "android", "web"] as const;
const FORMATS = new Set(["png", "jpeg", "webp"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ActionResult<T> = { ok: true; data: T } | { ok: false; reason: string };

async function signedInClient() {
  const user = await getCurrentUser();
  if (!user) throw new Error("You're signed out. Sign in again and retry.");
  return { user, db: await createClient() };
}

function failure(error: unknown, fallback: string): { ok: false; reason: string } {
  console.error(error);
  return { ok: false, reason: error instanceof Error && error.message.startsWith("You're") ? error.message : fallback };
}

export async function createAppAction(input: { name: string; platform: string }): Promise<ActionResult<App>> {
  const name = input.name.trim();
  if (!name) return { ok: false, reason: "Give the app a name." };
  if (!PLATFORMS.includes(input.platform as (typeof PLATFORMS)[number])) return { ok: false, reason: "Pick a platform." };
  try {
    const { db } = await signedInClient();
    return { ok: true, data: await createApp(db, { name, platform: input.platform as App["platform"] }) };
  } catch (error) {
    return failure(error, "We couldn't create the app. Try again.");
  }
}

export async function listFlowsAction(appId: string): Promise<ActionResult<Flow[]>> {
  if (!UUID.test(appId)) return { ok: true, data: [] };
  try {
    const { db } = await signedInClient();
    return { ok: true, data: await listFlows(db, { appId }) };
  } catch (error) {
    return failure(error, "We couldn't load this app's flows.");
  }
}

export async function createFlowAction(input: { appId: string; name: string }): Promise<ActionResult<Flow>> {
  const name = input.name.trim();
  if (!name) return { ok: false, reason: "Give the flow a name." };
  if (!UUID.test(input.appId)) return { ok: false, reason: "Pick an app first." };
  try {
    const { db } = await signedInClient();
    return { ok: true, data: await createFlow(db, { app_id: input.appId, name }) };
  } catch (error) {
    return failure(error, "We couldn't create the flow. Try again.");
  }
}

export type ProcessResult = { ok: true } | { ok: false; reason: string; retry: boolean };

/**
 * Turn an uploaded original into a screen: read its size, write a 480px WebP thumbnail next
 * to it and insert the row. The browser uploads the original first (straight to Storage,
 * since Vercel limits request bodies to 4.5 MB).
 */
export async function processScreen(input: {
  screenId: string;
  path: string;
  appId: string;
  capturedAt?: string;
}): Promise<ProcessResult> {
  const { screenId, path, appId } = input;
  try {
    const { user, db } = await signedInClient();
    if (!UUID.test(screenId) || !UUID.test(appId)) return { ok: false, reason: "Invalid upload.", retry: false };
    const match = path.match(/^([^/]+)\/([^/.]+)\.(png|jpg|webp)$/);
    if (!match || match[1] !== user.id || match[2] !== screenId) {
      return { ok: false, reason: "Invalid upload.", retry: false };
    }

    const storage = db.storage.from(BUCKET);
    const { data: blob, error: downloadError } = await storage.download(path);
    if (downloadError || !blob) return { ok: false, reason: "The upload went missing. Remove it and add the file again.", retry: false };
    const original = Buffer.from(await blob.arrayBuffer());

    const meta = await sharp(original)
      .metadata()
      .catch(() => null);
    if (!meta?.format || !FORMATS.has(meta.format) || !meta.width || !meta.height) {
      await storage.remove([path]);
      return { ok: false, reason: "This isn't a PNG, JPG or WebP image.", retry: false };
    }
    // EXIF orientations 5–8 rotate by 90°, which swaps the displayed width and height.
    const rotated = (meta.orientation ?? 1) >= 5;
    const width = rotated ? meta.height : meta.width;
    const height = rotated ? meta.width : meta.height;

    const thumb = await sharp(original)
      .rotate()
      .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    const thumbPath = `${user.id}/${screenId}.thumb.webp`;
    const { error: thumbError } = await storage.upload(thumbPath, thumb, { contentType: "image/webp", upsert: true });
    if (thumbError) throw thumbError;

    const capturedAt = input.capturedAt && !Number.isNaN(Date.parse(input.capturedAt)) ? input.capturedAt : undefined;
    try {
      await createScreens(db, [
        { id: screenId, app_id: appId, image_path: path, thumb_path: thumbPath, width, height, captured_at: capturedAt },
      ]);
    } catch (error) {
      // A retry after the row was already saved.
      if ((error as { code?: string }).code !== "23505") throw error;
    }
    return { ok: true };
  } catch (error) {
    return { ...failure(error, "We couldn't save this screen. Try again."), retry: true };
  }
}

export async function addScreensToFlowAction(flowId: string, screenIds: string[]): Promise<ActionResult<null>> {
  if (!UUID.test(flowId) || !screenIds.every((id) => UUID.test(id))) return { ok: false, reason: "Invalid flow." };
  try {
    const { db } = await signedInClient();
    await appendFlowScreens(db, flowId, screenIds);
    return { ok: true, data: null };
  } catch (error) {
    return failure(error, "The screens uploaded, but we couldn't add them to the flow.");
  }
}
