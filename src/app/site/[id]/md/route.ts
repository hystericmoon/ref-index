import { getSiteMarkdown } from "@/lib/db/designs";

// A site's design note as Markdown, served at /site/{id}.md (see the rewrite in next.config.ts).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const md = await getSiteMarkdown(id);
  if (!md) return new Response("Not found\n", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  return new Response(md, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400",
      "access-control-allow-origin": "*",
    },
  });
}
