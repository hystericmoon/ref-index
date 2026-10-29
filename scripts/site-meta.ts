// Reads each showcase site's own home page (plain HTTP, no browser) and keeps its title,
// description and headings in tmp/site-meta/meta.ndjson, for categorize-showcase.ts.
// Nothing here goes into the database; a rerun skips sites already read.
//
// Run: node scripts/site-meta.ts [--workers 32]
// Needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";

function env(name: string): string {
  const line = readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${name}=`));
  const value = line?.slice(name.length + 1).trim();
  if (!value) throw new Error(`${name} is missing from .env.local`);
  return value;
}

const i = process.argv.indexOf("--workers");
const workers = i > 0 ? Number(process.argv[i + 1]) : 32;
const OUT = "tmp/site-meta/meta.ndjson";
mkdirSync("tmp/site-meta", { recursive: true });

const seen = new Set<string>();
if (existsSync(OUT)) for (const line of readFileSync(OUT, "utf8").split("\n")) if (line) seen.add(JSON.parse(line).id);

const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL");
const key = env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const items: { id: string; url: string }[] = [];
for (let from = 0; ; from += 1000) {
  const response = await fetch(`${supabaseUrl}/rest/v1/showcase_items?select=id,url&url=not.is.null&order=id`, {
    headers: { apikey: key, range: `${from}-${from + 999}` },
  });
  if (!response.ok) throw new Error(`Couldn't read showcase items: ${response.status}`);
  const page = (await response.json()) as { id: string; url: string }[];
  items.push(...page.filter((it) => !seen.has(it.id) && /^https?:\/\//.test(it.url)));
  if (page.length < 1000) break;
}
console.error(`${items.length} sites to read`);

const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&apos;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/&[a-z]+;|&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function meta(html: string, name: string): string {
  const tag = html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*>`, "i"))?.[0];
  return decode(tag?.match(/content=["']([^"']*)["']/i)?.[1] ?? "");
}

async function read(url: string) {
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
    headers: { "user-agent": "Mozilla/5.0 (compatible; OpenrefsBot/1.0; +https://ref-index.vercel.app)", accept: "text/html" },
  });
  if (!response.ok) return { error: `status ${response.status}` };
  const html = (await response.text()).slice(0, 400_000);
  const headings = [...html.matchAll(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/gi)].map((m) => decode(m[1])).filter(Boolean).slice(0, 12);
  return {
    title: decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").slice(0, 300),
    description: (meta(html, "description") || meta(html, "og:description")).slice(0, 600),
    keywords: meta(html, "keywords").slice(0, 300),
    headings: headings.join(" | ").slice(0, 1200),
  };
}

let next = 0;
let done = 0;
await Promise.all(
  Array.from({ length: workers }, async () => {
    while (next < items.length) {
      const item = items[next++];
      const result = await read(item.url).catch((e: Error) => ({ error: e.message.slice(0, 100) }));
      appendFileSync(OUT, JSON.stringify({ id: item.id, ...result }) + "\n");
      if (++done % 500 === 0) console.error(`${done}/${items.length}`);
    }
  }),
);
console.error("done");
