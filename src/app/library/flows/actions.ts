"use server";

import { getCurrentUser } from "@/lib/auth";
import { setFlowScreens } from "@/lib/db/flow-screens";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Make the flow's steps exactly these screens, in this order. */
export async function saveFlowOrderAction(
  flowId: string,
  screenIds: string[],
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!UUID.test(flowId) || screenIds.length > 500 || !screenIds.every((id) => UUID.test(id))) {
    return { ok: false, reason: "Unknown flow." };
  }
  if (!(await getCurrentUser())) return { ok: false, reason: "You're signed out. Sign in again and retry." };
  try {
    await setFlowScreens(await createClient(), flowId, [...new Set(screenIds)]);
    return { ok: true };
  } catch (error) {
    console.error(error);
    return { ok: false, reason: "We couldn't save the flow. Try again." };
  }
}
