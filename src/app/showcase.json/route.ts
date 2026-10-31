import { SHOWCASE_VIEWS, type ShowcaseView } from "@/lib/db/showcase";
import { cachedShowcasePage } from "@/lib/db/showcase-cache";
import { CATEGORY_IDS } from "@/lib/categories";

const MEDIUMS = new Set(["all", "web", "3d", "mobile"]);

// One page of the showcase for the directory's search and filters. Responses are cached at
// the edge per URL for 10 minutes.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const medium = params.get("medium") ?? "all";
  const category = params.get("category") ?? "";
  const view = params.get("view") as ShowcaseView;
  const page = await cachedShowcasePage({
    q: (params.get("q") ?? "").slice(0, 100),
    medium: MEDIUMS.has(medium) ? medium : "all",
    gallery: (params.get("gallery") ?? "").slice(0, 60),
    category: CATEGORY_IDS.has(category) ? category : undefined,
    view: SHOWCASE_VIEWS.includes(view) ? view : "top",
    offset: Math.min(Math.max(Number(params.get("offset")) || 0, 0), 50_000),
  });
  return Response.json(page, { headers: { "cache-control": "public, s-maxage=600, stale-while-revalidate=3600" } });
}
