import { strToU8, zipSync } from "fflate";
import { SITE_URL, designFileName, loadDesignEntries } from "@/lib/db/designs";

// All design notes as one download: sites/<name>-<id8>.md per site plus an index (see /llms.txt).
export async function GET() {
  const entries = await loadDesignEntries();
  const files: Record<string, Uint8Array> = {};
  const index = [
    "# Openrefs design notes",
    "",
    `${entries.length} sites, one file each in sites/. First-pass notes written from screenshots and measured facts. Live pages: ${SITE_URL}/site/{id}`,
    "",
  ];
  for (const e of entries) {
    const name = designFileName(e.id, e.name);
    files[`sites/${name}`] = strToU8(`<!-- id: ${e.id} | ${e.url} -->\n\n${e.design_md.trim()}\n`);
    index.push(`- [${e.name}](sites/${name}) - ${e.url}`);
  }
  files["README.md"] = strToU8(index.join("\n") + "\n");
  const zip = zipSync(files, { level: 6 });
  return new Response(new Uint8Array(zip), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": 'attachment; filename="openrefs-design-notes.zip"',
      "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400",
      "access-control-allow-origin": "*",
    },
  });
}
