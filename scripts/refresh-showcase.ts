// Re-reads the first listing page of each gallery and prints SQL that adds any new
// names and gallery links with today's first_seen. Never deletes or edits existing
// rows. Stores names and links only: no screenshots or descriptions.
//
// Run:  node scripts/refresh-showcase.ts > tmp/showcase-refresh.sql
//       .\node_modules\.bin\supabase db query --linked -f tmp/showcase-refresh.sql
// Galleries that load their list with JavaScript, or hide item links, are skipped.

import { readFileSync } from "node:fs";
import { showcaseSql } from "./showcase-sql.mjs";

type Gallery = { name: string; listing: string; item: RegExp; platform: string };

// Item link patterns match the gallery-page URLs already in docs/showcase.json.
const GALLERIES: Gallery[] = [
  { name: "Land-book", listing: "https://land-book.com/", item: /^https:\/\/land-book\.com\/websites\/\d+-[a-z0-9-]+$/, platform: "web" },
  { name: "Godly", listing: "https://godly.design/", item: /^https:\/\/godly\.design\/website\/[a-z0-9-]+$/, platform: "web" },
  { name: "SiteInspire", listing: "https://www.siteinspire.com/", item: /^https:\/\/www\.siteinspire\.com\/website\/\d+-[a-z0-9-]+$/, platform: "web" },
  { name: "Httpster", listing: "https://httpster.net/", item: /^https:\/\/httpster\.net\/website\/[a-z0-9-]+\/$/, platform: "web" },
  { name: "CSS Design Awards", listing: "https://www.cssdesignawards.com/wotd-award-winners", item: /^https:\/\/www\.cssdesignawards\.com\/sites\/[a-z0-9-]+\/\d+\/$/, platform: "web" },
  { name: "Awwwards", listing: "https://www.awwwards.com/websites/sites_of_the_day/", item: /^https:\/\/www\.awwwards\.com\/sites\/[a-z0-9-]+$/, platform: "web" },
];

const GENERIC =
  /^(website|web site|logo|view|view site|visit|visit site|visit website|more|details|read more|open|site of the day|sotd|honorable mention|developer award|new|featured|\d+)$/i;

function env(name: string): string {
  const line = readFileSync(".env.local", "utf8").split(/\r?\n/).find((l) => l.startsWith(`${name}=`));
  const value = line?.slice(name.length + 1).trim();
  if (!value) throw new Error(`${name} is missing from .env.local`);
  return value;
}

const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** "1234-studio-ol" or "studio-ol" → "Studio Ol", used when the link has no usable text. */
function nameFromSlug(url: string) {
  const segments = new URL(url).pathname.split("/").filter((s) => s && !/^\d+$/.test(s));
  return (segments.at(-1) ?? "")
    .replace(/^\d+-/, "")
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

async function readGallery(gallery: Gallery): Promise<{ name: string; src: string }[]> {
  const res = await fetch(gallery.listing, { headers: { "user-agent": "RefIndex showcase refresh (names and links only)" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const found = new Map<string, string>();
  for (const match of html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const src = new URL(match[1], gallery.listing).href.split(/[?#]/)[0];
    if (!gallery.item.test(src)) continue;
    // Some galleries put an avatar initial before the name ("G Gitnimble").
    const text = decode(match[2]).replace(/^([A-Z0-9]) (?=\1)/i, "");
    // A link's text is the site's name unless it's a generic label ("Website", "Visit site"…).
    const usable = text.length >= 2 && text.length <= 80 && !GENERIC.test(text) && !/[<>#"=]/.test(text);
    if (usable && !found.get(src)) found.set(src, text);
    else if (!found.has(src)) found.set(src, "");
  }
  return [...found].map(([src, name]) => ({ name: name || nameFromSlug(src), src })).filter((e) => e.name);
}

const url = env("NEXT_PUBLIC_SUPABASE_URL");
const key = env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const existing = (await (
  await fetch(`${url}/rest/v1/showcase_items?select=name,url,platform&limit=10000`, { headers: { apikey: key } })
).json()) as { name: string; url: string | null; platform: string }[];
const byName = new Map(existing.map((e) => [e.name.toLowerCase(), e]));
const knownLinks = new Set(
  ((await (
    await fetch(`${url}/rest/v1/showcase_features?select=source_url&limit=100000`, { headers: { apikey: key } })
  ).json()) as { source_url: string }[]).map((f) => f.source_url),
);

const entries = new Map<string, { name: string; url: string | null; platform: string; tags: string[]; featured: { g: string; src: string }[] }>();
for (const gallery of GALLERIES) {
  try {
    const items = await readGallery(gallery);
    const fresh = items.filter((item) => !knownLinks.has(item.src));
    console.error(`${gallery.name}: ${items.length} links, ${fresh.length} new`);
    for (const item of fresh) {
      const known = byName.get(item.name.toLowerCase());
      const entryKey = item.name.toLowerCase();
      const entry = entries.get(entryKey) ?? {
        name: known?.name ?? item.name,
        url: known ? known.url : null,
        platform: known?.platform ?? gallery.platform,
        tags: [],
        featured: [],
      };
      entry.featured.push({ g: gallery.name, src: item.src });
      entries.set(entryKey, entry);
    }
  } catch (error) {
    console.error(`${gallery.name}: skipped (${(error as Error).message})`);
  }
}

const today = new Date().toISOString().slice(0, 10);
process.stdout.write(`-- Generated by scripts/refresh-showcase.ts on ${today}\n${showcaseSql([...entries.values()], today)}`);
