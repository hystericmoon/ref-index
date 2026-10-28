"use server";

import { getCurrentUser } from "@/lib/auth";
import { appendFlowScreens, removeScreenFromFlow } from "@/lib/db/flow-screens";
import { updateScreen } from "@/lib/db/screens";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Result = { ok: true } | { ok: false; reason: string };

async function run(work: (db: Awaited<ReturnType<typeof createClient>>) => Promise<void>, failure: string): Promise<Result> {
  if (!(await getCurrentUser())) return { ok: false, reason: "You're signed out. Sign in again and retry." };
  try {
    await work(await createClient());
    return { ok: true };
  } catch (error) {
    console.error(error);
    return { ok: false, reason: failure };
  }
}

export async function saveNotesAction(screenId: string, notes: string): Promise<Result> {
  if (!UUID.test(screenId)) return { ok: false, reason: "Unknown screen." };
  const text = notes.trim().slice(0, 2000);
  return run(async (db) => {
    await updateScreen(db, screenId, { notes: text || null });
  }, "We couldn't save the notes. Try again.");
}

export async function addToFlowAction(flowId: string, screenId: string): Promise<Result> {
  if (!UUID.test(flowId) || !UUID.test(screenId)) return { ok: false, reason: "Unknown flow." };
  return run((db) => appendFlowScreens(db, flowId, [screenId]), "We couldn't add it to the flow. Try again.");
}

export async function removeFromFlowAction(flowId: string, screenId: string): Promise<Result> {
  if (!UUID.test(flowId) || !UUID.test(screenId)) return { ok: false, reason: "Unknown flow." };
  return run((db) => removeScreenFromFlow(db, flowId, screenId), "We couldn't remove it from the flow. Try again.");
}
