// One-off full import of a `sitemap` gallery (refresh only reads the newest 30 per run): reads every
// entry page once, 1.5 s apart, takes the site's name and live link, and prints SQL for
// public.add_showcase_entries. Add-only. Resumable: pages already read are kept in tmp/import/<slug>.ndjson.
// Honours the gallery's robots.txt (Disallow for *); a blocked or rate-limited page (403/429) is skipped.
//
// Run:  node scripts/import-sitemap-gallery.ts "GradientDeck UI"            (read pages)
//       node scripts/import-sitemap-gallery.ts "GradientDeck UI" --sql      (print the SQL, chunks of 300)

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { GALLERIES, USER_AGENT, parseGallery, resolveLive, type Found } from "../supabase/functions/showcase-refresh/galleries.ts";

const name = process.argv[2];
const gallery = GALLERIES.find((g) => g.name === name && g.kind === "sitemap");
if (!gallery) throw new Error(`no sitemap gallery called ${name}`);
const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
mkdirSync("tmp/import", { recursive: true });
const file = `tmp/import/${slug}.ndjson`;
const read = (): (Found & { checked?: boolean })[] =>
  existsSync(file) ? readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];

if (process.argv.includes("--sql")) {
  const entries = [...new Map(read().filter((e) => e.name && e.url).map((e) => [e.src, e])).values()];
  for (let i = 0; i < entries.length; i += 300) {
    const json = JSON.stringify(entries.slice(i, i + 300)).replace(/'/g, "''");
    writeFileSync(`tmp/import/${slug}-${i}.sql`, `select public.add_showcase_entries('${json}'::jsonb) as added;\n`);
  }
  console.log(`${entries.length} entries with a name and live link, ${Math.ceil(entries.length / 300)} files in tmp/import/`);
  process.exit(0);
}

const origin = new URL(gallery.listing).origin;
const robots = await fetch(`${origin}/robots.txt`, { headers: { "user-agent": USER_AGENT } }).then((r) => (r.ok ? r.text() : ""));
const disallowed = [...robots.split(/\r?\n/).reduce<{ star: boolean; paths: string[] }>((s, line) => {
  const [k, ...v] = line.split(":");
  const key = k.trim().toLowerCase();
  const value = v.join(":").trim();
  if (key === "user-agent") s.star = value === "*";
  else if (key === "disallow" && s.star && value) s.paths.push(value);
  return s;
}, { star: false, paths: [] }).paths];

const sitemap = await fetch(gallery.listing, { headers: { "user-agent": USER_AGENT } }).then((r) => r.text());
const all = parseGallery(gallery, sitemap).filter((f) => !disallowed.some((d) => new URL(f.src).pathname.startsWith(d)));
const seen = new Set(read().map((e) => e.src));
const todo = all.filter((f) => !seen.has(f.src));
console.log(`${all.length} entries in the sitemap, ${seen.size} already read, ${todo.length} to read`);
for (let i = 0; i < todo.length; i += 50) {
  const chunk = todo.slice(i, i + 50);
  await resolveLive(chunk, 50, 1500);
  appendFileSync(file, chunk.map((f) => JSON.stringify(f)).join("\n") + "\n");
  console.log(`${seen.size + i + chunk.length} of ${all.length} (${chunk.filter((f) => f.name && f.url).length} of this chunk with a name and link)`);
}
console.log("done");
