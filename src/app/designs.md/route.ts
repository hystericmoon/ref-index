import { SITE_URL, loadDesignEntries } from "@/lib/db/designs";

// Every design note in one Markdown file, for agents that want it all at once (see /llms.txt).
export async function GET() {
  const entries = await loadDesignEntries();
  const body = [
    "# Openrefs design notes",
    "",
    `${entries.length} sites. Each note describes palette, type, layout and motion in plain words, from screenshots and measured facts (first pass, some details may be off). One file per site: ${SITE_URL}/site/{id}.md. Download as a zip: ${SITE_URL}/designs.zip`,
    "",
    ...entries.flatMap((e) => ["---", "", `<!-- id: ${e.id} | ${SITE_URL}/site/${e.id}.md -->`, "", e.design_md.trim(), ""]),
  ].join("\n");
  return new Response(body, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400",
      "access-control-allow-origin": "*",
    },
  });
}
