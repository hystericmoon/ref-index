import { must, mustOne, type DbClient, type Insert, type Row, type Update } from "./client";

export type Flow = Row<"flows">;

/** The signed-in user's flows, optionally for one app, A–Z. */
export async function listFlows(db: DbClient, options: { appId?: string } = {}): Promise<Flow[]> {
  let q = db.from("flows").select("*");
  if (options.appId) q = q.eq("app_id", options.appId);
  return must(await q.order("name"));
}

/** One flow with its app and its screens in order. */
export async function getFlow(db: DbClient, id: string) {
  return must(
    await db
      .from("flows")
      .select("*, app:apps(*), flow_screens(position, screen:screens(*))")
      .eq("id", id)
      .order("position", { referencedTable: "flow_screens" })
      .maybeSingle(),
  );
}

/** One flow with its app, or null. */
export async function getFlowSummary(db: DbClient, id: string) {
  const { data, error } = await db.from("flows").select("*, app:apps(id, name, platform)").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

/** All the user's flows with their app and how many screens they hold, A–Z. */
export async function listFlowsWithCounts(db: DbClient) {
  const { data, error } = await db
    .from("flows")
    .select("id, name, app:apps(id, name, platform), flow_screens(count)")
    .order("name");
  if (error) throw error;
  return data.map((flow) => ({ ...flow, screenCount: flow.flow_screens[0]?.count ?? 0 }));
}

/** One flow's steps in order, with the screen fields a strip needs. */
export async function listFlowSteps(db: DbClient, flowId: string) {
  const { data, error } = await db
    .from("flow_screens")
    .select("position, screen:screens(id, thumb_path, width, height)")
    .eq("flow_id", flowId)
    .order("position");
  if (error) throw error;
  return data.flatMap((row) => (row.screen ? [{ position: row.position, ...row.screen }] : []));
}

/** Flows that include a given screen. */
export async function listFlowsForScreen(db: DbClient, screenId: string) {
  return must(
    await db
      .from("flows")
      .select("*, flow_screens!inner(screen_id, position)")
      .eq("flow_screens.screen_id", screenId)
      .order("name"),
  );
}

/** owner_id defaults to the signed-in user. */
export async function createFlow(db: DbClient, flow: Omit<Insert<"flows">, "owner_id">): Promise<Flow> {
  return mustOne(await db.from("flows").insert(flow).select().single());
}

export async function updateFlow(db: DbClient, id: string, patch: Omit<Update<"flows">, "id" | "owner_id">): Promise<Flow> {
  return mustOne(await db.from("flows").update(patch).eq("id", id).select().single());
}

export async function deleteFlow(db: DbClient, id: string): Promise<void> {
  must(await db.from("flows").delete().eq("id", id));
}
