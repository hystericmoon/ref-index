import { revalidateTag } from "next/cache";
import { timingSafeEqual } from "node:crypto";
import { SHOWCASE_TAG } from "@/lib/db/showcase-cache";

/**
 * Clears the public showcase cache after changes made outside the app (bulk unlists, imports, SQL).
 * Called by scripts/clear-cache.ts with `Authorization: Bearer $REVALIDATE_SECRET`; off when the secret is unset.
 */
export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return Response.json({ error: "REVALIDATE_SECRET is not set" }, { status: 503 });
  const sent = Buffer.from(request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "");
  const want = Buffer.from(secret);
  if (sent.length !== want.length || !timingSafeEqual(sent, want)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  revalidateTag(SHOWCASE_TAG, { expire: 0 });
  return Response.json({ cleared: SHOWCASE_TAG });
}
