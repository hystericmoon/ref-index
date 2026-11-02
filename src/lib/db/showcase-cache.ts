import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { getCategoryCounts, getShowcaseItem, getViewCounts, searchShowcase, type ShowcaseQuery } from "./showcase";

/**
 * Public showcase reads, kept in Next's data cache for 10 minutes so most visits skip the
 * round trips to Supabase. Editors' changes clear it at once (updateTag in the curate actions).
 */
export const SHOWCASE_TAG = "showcase";
const options = { revalidate: 600, tags: [SHOWCASE_TAG] };

/** One page of showcase items for the directory and /showcase.json. */
export const cachedShowcasePage = unstable_cache((query: ShowcaseQuery) => searchShowcase(createPublicClient(), query), ["showcase-page"], options);

/** Everything the directory shows besides the cards: counts per view and category (galleries aren't credited). */
export const cachedDirectoryCounts = unstable_cache(
  async () => {
    const db = createPublicClient();
    const [viewCounts, categoryCounts] = await Promise.all([getViewCounts(db), getCategoryCounts(db)]);
    return { viewCounts, categoryCounts };
  },
  ["directory-counts"],
  options,
);

/** One site for its detail page or panel. */
export const cachedShowcaseItem = unstable_cache((id: string) => getShowcaseItem(createPublicClient(), id), ["showcase-item"], options);
