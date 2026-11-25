import { cachedShowcasePages } from "@/lib/db/showcase-cache";
import { PAGE_PATTERN_IDS, PAGE_TYPE_IDS } from "@/lib/page-types";

// Tagged page screenshots for AI agents and scripts (see /llms.txt). Filters: type, pattern, offset.
// Cached at the edge per URL for 10 minutes.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const type = params.get("type") ?? "";
  const pattern = params.get("pattern") ?? "";
  const page = await cachedShowcasePages({
    type: PAGE_TYPE_IDS.has(type) ? type : undefined,
    pattern: PAGE_PATTERN_IDS.has(pattern) ? pattern : undefined,
    offset: Math.min(Math.max(Number(params.get("offset")) || 0, 0), 5000),
    limit: 100,
  });
  return Response.json(page, {
    headers: { "cache-control": "public, s-maxage=600, stale-while-revalidate=3600", "access-control-allow-origin": "*" },
  });
}
