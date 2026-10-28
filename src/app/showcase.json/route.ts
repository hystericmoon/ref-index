import { interleaveByGallery, listShowcase } from "@/lib/db/showcase";
import { createPublicClient } from "@/lib/supabase/public";

// The full showcase for the directory's client-side filters. Cached and rebuilt hourly,
// so the home page HTML only needs to carry the first screenful.
export const revalidate = 3600;

export async function GET() {
  const entries = interleaveByGallery(await listShowcase(createPublicClient()));
  return Response.json(entries);
}
