// Assigns showcase categories (src/lib/categories.ts) from each site's own title, description
// and headings (tmp/site-meta/meta.ndjson, made by site-meta.ts) plus the galleries' tags.
// A keyword in the title, description or keywords counts 2, in a heading 1; a category needs 2.
// At most one kind of site and two fields are kept, the strongest first.
//
// Run: node scripts/categorize-showcase.ts > tmp/site-meta/categories.sql (needs .env.local)
// Then: supabase db query --linked -f tmp/site-meta/categories.sql
// Items an editor categorized by hand (categories_set_at) are left alone.

import { readFileSync } from "node:fs";
import { CATEGORIES } from "../src/lib/categories.ts";

type Meta = { id: string; title?: string; description?: string; keywords?: string; headings?: string; error?: string };

// Gallery tags that already say what a site is.
const FROM_TAGS: Record<string, string> = {
  portfolio: "portfolio",
  personal: "portfolio",
  ecommerce: "shop",
  "e-commerce": "shop",
  saas: "product",
  startup: "product",
  "digital product": "product",
  app: "product",
  game: "culture",
  "music related": "culture",
  "long-form journalism": "editorial",
  "social impact": "impact",
  agency: "agency",
};

// Phrases that contain a keyword but mean something else.
const NOISE = /\b(app store|play store|google play|studio code|we use cookies[^.]*\.)/gi;

function env(name: string): string {
  const line = readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${name}=`));
  const value = line?.slice(name.length + 1).trim();
  if (!value) throw new Error(`${name} is missing from .env.local`);
  return value;
}

function score(text: string, words: RegExp): number {
  return text.match(new RegExp(words.source, "gi"))?.length ?? 0;
}

function categorize(meta: Meta | undefined, name: string, tags: string[]): string[] {
  const strong = `${name} ${meta?.title ?? ""} ${meta?.description ?? ""} ${meta?.keywords ?? ""}`.replace(NOISE, " ");
  const weak = (meta?.headings ?? "").replace(NOISE, " ");
  const scores = new Map<string, number>();
  for (const c of CATEGORIES) {
    const s = 2 * score(strong, c.words) + score(weak, c.words);
    if (s) scores.set(c.id, s);
  }
  for (const t of tags) {
    const id = FROM_TAGS[t.toLowerCase()];
    if (id) scores.set(id, (scores.get(id) ?? 0) + 4);
  }
  const ranked = (group: "type" | "industry", keep: number) =>
    CATEGORIES.filter((c) => c.group === group && (scores.get(c.id) ?? 0) >= 2)
      .sort((a, b) => scores.get(b.id)! - scores.get(a.id)!)
      .slice(0, keep)
      .map((c) => c.id);
  return [...ranked("type", 1), ...ranked("industry", 2)];
}

const metas = new Map<string, Meta>();
for (const line of readFileSync("tmp/site-meta/meta.ndjson", "utf8").split("\n")) {
  if (!line) continue;
  const m = JSON.parse(line) as Meta;
  metas.set(m.id, m);
}

const items: { id: string; name: string; tags: string[] | null }[] = [];
for (let from = 0; ; from += 1000) {
  const response = await fetch(`${env("NEXT_PUBLIC_SUPABASE_URL")}/rest/v1/showcase_items?select=id,name,tags&order=id`, {
    headers: { apikey: env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), range: `${from}-${from + 999}` },
  });
  if (!response.ok) throw new Error(`Couldn't read showcase items: ${response.status}`);
  const page = (await response.json()) as typeof items;
  items.push(...page);
  if (page.length < 1000) break;
}

const rows: string[] = [];
const counts = new Map<string, number>();
for (const item of items) {
  const cats = categorize(metas.get(item.id), item.name, item.tags ?? []);
  for (const c of cats) counts.set(c, (counts.get(c) ?? 0) + 1);
  rows.push(`('${item.id}'::uuid, array[${cats.map((c) => `'${c}'`).join(",")}]::text[])`);
}
console.error([...counts].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${n}`).join(" · "));
console.error(`${rows.length} items, ${items.filter((i) => metas.get(i.id)?.title).length} with a page title`);

for (let i = 0; i < rows.length; i += 2000) {
  console.log(
    `update public.showcase_items s set categories = v.c from (values ${rows.slice(i, i + 2000).join(",\n")}) v(id, c) where s.id = v.id and s.categories_set_at is null;`,
  );
}
