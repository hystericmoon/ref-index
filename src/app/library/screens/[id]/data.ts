import { listFlows, listFlowsForScreen } from "@/lib/db/flows";
import { getScreen, getScreenNeighbors } from "@/lib/db/screens";
import { signScreenUrls } from "@/lib/db/storage";
import { createClient } from "@/lib/supabase/server";
import { loadTagOptions, type FacetOption } from "@/lib/tags";

export type ScreenDetail = {
  id: string;
  appId: string;
  appName: string;
  platform: string;
  imageUrl: string | null;
  width: number | null;
  height: number | null;
  capturedAt: string;
  notes: string;
  tagIds: string[];
  flows: { id: string; name: string }[];
  appFlows: { id: string; name: string }[];
  /** Library-order neighbours, used when the viewer wasn't opened from the grid. */
  prev: string | null;
  next: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function loadScreenDetail(id: string): Promise<{ screen: ScreenDetail; facets: FacetOption[] } | null> {
  if (!UUID.test(id)) return null;
  const db = await createClient();
  const screen = await getScreen(db, id);
  if (!screen || !screen.app) return null;
  const [urls, flows, appFlows, neighbors, facets] = await Promise.all([
    signScreenUrls(db, [screen.image_path]),
    listFlowsForScreen(db, id),
    listFlows(db, { appId: screen.app_id }),
    getScreenNeighbors(db, screen),
    loadTagOptions(db),
  ]);
  return {
    facets,
    screen: {
      id: screen.id,
      appId: screen.app_id,
      appName: screen.app.name,
      platform: screen.app.platform,
      imageUrl: urls.get(screen.image_path) ?? null,
      width: screen.width,
      height: screen.height,
      capturedAt: screen.captured_at,
      notes: screen.notes ?? "",
      tagIds: screen.screen_tags.map((st) => st.tag_id),
      flows: flows.map((flow) => ({ id: flow.id, name: flow.name })),
      appFlows: appFlows.map((flow) => ({ id: flow.id, name: flow.name })),
      prev: neighbors.prev,
      next: neighbors.next,
    },
  };
}
