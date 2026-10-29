// Sorts every live showcase item into categories and flags screenshots that look broken or low
// quality, by asking Claude to look at each site's screenshot and its own title, description and
// headings. Replaces the keyword categories (categorize-showcase.ts) except ones an editor set by
// hand. Flags only feed the "Flagged by AI" queue in /curate; nothing is hidden automatically.
// Runs through the Message Batches API (half price, done within a day, usually an hour).
//
// 1. node scripts/ai-categorize.ts submit [--model claude-haiku-5-5] [--limit N]
//    Sends one batch of items not checked yet and saves its id to tmp/ai-categorize/batch.json.
// 2. node scripts/ai-categorize.ts collect
//    When the batch has ended, writes tmp/ai-categorize/categories.sql and prints the counts.
// 3. supabase db query --linked -f tmp/ai-categorize/categories.sql, then delete batch.json.
//
// Needs ANTHROPIC_API_KEY, NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in
// .env.local, and tmp/site-meta/meta.ndjson from site-meta.ts.

import Anthropic from "@anthropic-ai/sdk";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { CATEGORIES, CATEGORY_IDS } from "../src/lib/categories.ts";

function env(name: string): string {
  const line = readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${name}=`));
  const value = line?.slice(name.length + 1).trim();
  if (!value) throw new Error(`${name} is missing from .env.local`);
  return value;
}

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
}

const DIR = "tmp/ai-categorize";
const BATCH_FILE = `${DIR}/batch.json`;
mkdirSync(DIR, { recursive: true });

const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL");

const SYSTEM = `You sort websites and apps into categories for a free gallery of design references, and
check whether each screenshot is worth showing to designers.

Categories, as id: label (meaning):
${CATEGORIES.map((c) => `- ${c.id}: ${c.label} (${c.group === "type" ? "what kind of site" : "what field it is in"})`).join("\n")}

Pick at most one "what kind of site" category and at most two "what field" categories that clearly fit.
Use the screenshot and the text; the text may be in any language. A studio or agency's own site is
"agency" even when its clients are in other fields; only add a field when the site itself is about it.
If nothing clearly fits, return an empty list.

"looks" describes the screenshot:
- "broken": an error or "not found" page, a blank or half-loaded page, a login wall, a cookie or
  pop-up covering most of the page, "coming soon", a parked or for-sale domain, or a different site
  than the name suggests.
- "low_quality": a working page with dated, generic or amateur visual design that a designer would
  not use as a reference.
- "fine": anything else, including plain or minimal designs done with care.
With no screenshot, answer "fine".`;

const SCHEMA = {
  type: "object",
  properties: {
    categories: { type: "array", items: { type: "string", enum: CATEGORIES.map((c) => c.id) } },
    looks: { type: "string", enum: ["fine", "broken", "low_quality"] },
  },
  required: ["categories", "looks"],
  additionalProperties: false,
} as const;

type Meta = { id: string; title?: string; description?: string; keywords?: string; headings?: string };
type Item = { id: string; name: string; url: string | null; platform: string; thumb_path: string | null };

function client() {
  return new Anthropic({ apiKey: env("ANTHROPIC_API_KEY") });
}

async function submit() {
  if (existsSync(BATCH_FILE)) throw new Error(`${BATCH_FILE} exists; run collect first, or delete it to start over.`);
  const model = arg("model", "claude-haiku-5-5");
  const limit = Number(arg("limit", "100000"));

  const metas = new Map<string, Meta>();
  for (const line of readFileSync("tmp/site-meta/meta.ndjson", "utf8").split("\n")) {
    if (!line) continue;
    const m = JSON.parse(line) as Meta;
    metas.set(m.id, m);
  }

  // Live, listed items the AI hasn't checked yet (dead ones sit in the archive already).
  const items: Item[] = [];
  for (let from = 0; items.length < limit; from += 1000) {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/showcase_items?select=id,name,url,platform,thumb_path&status=eq.listed&ai_checked_at=is.null&or=(thumb_path.not.is.null,thumb_checked_at.is.null)&order=id`,
      { headers: { apikey: env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), range: `${from}-${from + 999}` } },
    );
    if (!response.ok) throw new Error(`Couldn't read showcase items: ${response.status}`);
    const page = (await response.json()) as Item[];
    items.push(...page);
    if (page.length < 1000) break;
  }
  items.splice(limit);

  const requests = items.map((item) => {
    const meta = metas.get(item.id);
    const text = [
      `Name: ${item.name}`,
      `Address: ${item.url ?? "none"}`,
      `Platform: ${item.platform}`,
      meta?.title && `Page title: ${meta.title}`,
      meta?.description && `Description: ${meta.description}`,
      meta?.keywords && `Keywords: ${meta.keywords}`,
      meta?.headings && `Headings: ${meta.headings}`,
      !item.thumb_path && "No screenshot.",
    ]
      .filter(Boolean)
      .join("\n");
    const content: Anthropic.ContentBlockParam[] = [];
    if (item.thumb_path) {
      content.push({ type: "image", source: { type: "url", url: `${supabaseUrl}/storage/v1/object/public/showcase/${item.thumb_path}` } });
    }
    content.push({ type: "text", text });
    return {
      custom_id: item.id,
      params: {
        model,
        max_tokens: 2000,
        system: [{ type: "text" as const, text: SYSTEM, cache_control: { type: "ephemeral" as const } }],
        output_config: { effort: "low" as const, format: { type: "json_schema" as const, schema: SCHEMA } },
        messages: [{ role: "user" as const, content }],
      },
    };
  });

  if (!requests.length) return console.error("Nothing to check.");
  const batch = await client().messages.batches.create({ requests });
  writeFileSync(BATCH_FILE, JSON.stringify({ id: batch.id, model, count: requests.length }));
  console.error(`Sent ${requests.length} sites to ${model} as batch ${batch.id}.`);
}

async function collect() {
  const { id } = JSON.parse(readFileSync(BATCH_FILE, "utf8")) as { id: string };
  const anthropic = client();
  const batch = await anthropic.messages.batches.retrieve(id);
  if (batch.processing_status !== "ended") {
    const c = batch.request_counts;
    console.error(`Still running: ${c.processing} left, ${c.succeeded} done, ${c.errored} errored.`);
    process.exitCode = 2;
    return;
  }

  const rows: string[] = [];
  const counts = new Map<string, number>();
  const looks = new Map<string, number>();
  let failed = 0;
  let input = 0;
  let output = 0;
  for await (const result of await anthropic.messages.batches.results(id)) {
    if (result.result.type !== "succeeded") {
      failed++;
      continue;
    }
    const message = result.result.message;
    input += message.usage.input_tokens + (message.usage.cache_read_input_tokens ?? 0) + (message.usage.cache_creation_input_tokens ?? 0);
    output += message.usage.output_tokens;
    const text = message.content.find((b) => b.type === "text")?.text;
    if (message.stop_reason !== "end_turn" || !text) {
      failed++;
      continue;
    }
    const answer = JSON.parse(text) as { categories?: string[]; looks?: string };
    const picked = (answer.categories ?? []).filter((c) => CATEGORY_IDS.has(c));
    const group = (c: string) => CATEGORIES.find((x) => x.id === c)?.group;
    const cats = [...new Set([...picked.filter((c) => group(c) === "type").slice(0, 1), ...picked.filter((c) => group(c) === "industry").slice(0, 2)])];
    const flag = answer.looks === "broken" || answer.looks === "low_quality" ? answer.looks : null;
    for (const c of cats) counts.set(c, (counts.get(c) ?? 0) + 1);
    looks.set(answer.looks ?? "?", (looks.get(answer.looks ?? "?") ?? 0) + 1);
    rows.push(`('${result.custom_id}'::uuid, array[${cats.map((c) => `'${c}'`).join(",")}]::text[], ${flag ? `'${flag}'` : "null"})`);
  }

  // Categories only where an editor hasn't set them; a flag on every checked item.
  const sql = [];
  for (let i = 0; i < rows.length; i += 2000) {
    sql.push(
      `update public.showcase_items s set categories = case when s.categories_set_at is null then v.c else s.categories end, ai_flag = v.f, ai_checked_at = now() from (values ${rows.slice(i, i + 2000).join(",\n")}) v(id, c, f) where s.id = v.id;`,
    );
  }
  writeFileSync(`${DIR}/categories.sql`, sql.join("\n"));
  console.error([...counts].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${n}`).join(" · "));
  console.error(`Looks: ${[...looks].map(([k, n]) => `${k} ${n}`).join(" · ")}`);
  console.error(`${rows.length} answered, ${failed} failed. Tokens: ${input} in, ${output} out.`);
}

const mode = process.argv[2];
if (mode === "submit") await submit();
else if (mode === "collect") await collect();
else console.error("Usage: node scripts/ai-categorize.ts submit|collect");
