import { must, type DbClient, type Row } from "./client";

export type FlowScreen = Row<"flow_screens">;

export async function listFlowScreens(db: DbClient, flowId: string): Promise<FlowScreen[]> {
  return must(await db.from("flow_screens").select("*").eq("flow_id", flowId).order("position"));
}

/**
 * Make the flow's steps exactly `screenIds`, in that order. Positions are rewritten in one
 * upsert; the unique (flow_id, position) check is deferred, so swapped steps don't collide.
 */
export async function setFlowScreens(db: DbClient, flowId: string, screenIds: string[]): Promise<void> {
  let remove = db.from("flow_screens").delete().eq("flow_id", flowId);
  if (screenIds.length) remove = remove.not("screen_id", "in", `(${screenIds.join(",")})`);
  must(await remove);
  if (!screenIds.length) return;
  must(
    await db
      .from("flow_screens")
      .upsert(
        screenIds.map((screen_id, position) => ({ flow_id: flowId, screen_id, position })),
        { onConflict: "flow_id,screen_id" },
      ),
  );
}

export async function removeScreenFromFlow(db: DbClient, flowId: string, screenId: string): Promise<void> {
  must(await db.from("flow_screens").delete().eq("flow_id", flowId).eq("screen_id", screenId));
}
