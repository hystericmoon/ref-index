import { SHOWCASE_VIEWS, searchShowcase, type ShowcaseView } from "@/lib/db/showcase";
import { createPublicClient } from "@/lib/supabase/public";

const MEDIUMS = new Set(["all", "web", "3d", "mobile"]);

// One page of the showcase for the directory's search and filters. Responses are cached at
// the edge per URL for 10 minutes.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const medium = params.get("medium") ?? "all";
  const view = params.get("view") as ShowcaseView;
  const page = await searchShowcase(createPublicClient(), {
    q: (params.get("q") ?? "").slice(0, 100),
    medium: MEDIUMS.has(medium) ? medium : "all",
    gallery: (params.get("gallery") ?? "").slice(0, 60),
    view: SHOWCASE_VIEWS.includes(view) ? view : "top",
    offset: Math.min(Math.max(Number(params.get("offset")) || 0, 0), 50_000),
  });
  return Response.json(page, { headers: { "cache-control": "public, s-maxage=600, stale-while-revalidate=3600" } });
}
