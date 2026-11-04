// Pictures for sites that block screenshots (403, bot check, 429): reads the share picture the site
// publishes openly (og:image, else twitter:image) from its home page. One plain request per site, a
// generic client name with no contact details, no disguise. A site that answers 403/429 or shows a bot
// check is skipped, not worked around. Pictures under 600 px wide or far from a landscape shape (logos,
// icons) are skipped. Saved as <out>/img/og/<id>.webp, which scripts/cdn-sync.ts --add uploads.
//
// Run:  node scripts/og-images.ts --ids tmp/og/candidates.json --out tmp/og/batch-1 [--limit 50]
// Then: node scripts/og-images-sql.ts tmp/og/batch-1   (writes the SQL and the undo SQL)

import { mkdirSync, readFileSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const argv = process.argv.slice(2);
const arg = (name: string, fallback: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};
const out = arg("out", "tmp/og/batch-1");
const limit = Number(arg("limit", "100000"));
const workers = Number(arg("workers", "8"));
const items = (JSON.parse(readFileSync(arg("ids", "tmp/og/candidates.json"), "utf8")) as { id: string; name: string; url: string }[]).slice(0, limit);
const UA = "ref-index-share-image-reader/1.0";
const MIN_WIDTH = 600;

mkdirSync(join(out, "img", "og"), { recursive: true });
const resultsFile = join(out, "results.ndjson");
const done = new Set<string>(existsSync(resultsFile) ? readFileSync(resultsFile, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).id) : []);

async function get(url: string, maxBytes: number): Promise<{ res: Response; body: Buffer }> {
  const res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html,image/*;q=0.8,*/*;q=0.5" }, redirect: "follow", signal: AbortSignal.timeout(15_000) });
  const chunks: Buffer[] = [];
  let size = 0;
  if (res.body) {
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk));
      size += chunk.length;
      if (size > maxBytes) break;
    }
  }
  return { res, body: Buffer.concat(chunks) };
}

function metaImage(html: string): string | null {
  const head = html.slice(0, 400_000);
  const tags = head.match(/<meta\b[^>]*>/gi) ?? [];
  const found = new Map<string, string>();
  for (const tag of tags) {
    const key = /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
    const value = /content\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1];
    if (key && value && !found.has(key)) found.set(key, value.replace(/&amp;/g, "&").trim());
  }
  return found.get("og:image") ?? found.get("og:image:secure_url") ?? found.get("twitter:image") ?? found.get("twitter:image:src") ?? null;
}

const BOT_CHECK = /just a moment|attention required|checking your browser|cf-chl|captcha|are you a robot|access denied|verify you are human|ddos-guard|px-captcha/i;

async function one(item: { id: string; url: string }) {
  try {
    const page = await get(item.url, 600_000);
    if (page.res.status !== 200) return { ok: false, reason: `home page status ${page.res.status}` };
    const html = page.body.toString("utf8");
    if (BOT_CHECK.test(html.slice(0, 5000)) && !/og:image/i.test(html)) return { ok: false, reason: "bot check page" };
    const raw = metaImage(html);
    if (!raw) return { ok: false, reason: "no og:image or twitter:image" };
    let src: string;
    try {
      src = new URL(raw, page.res.url).href;
    } catch {
      return { ok: false, reason: "bad image address" };
    }
    if (!/^https?:/.test(src)) return { ok: false, reason: "bad image address" };
    const img = await get(src, 12_000_000);
    if (img.res.status !== 200) return { ok: false, reason: `image status ${img.res.status}`, source: src };
    const meta = await sharp(img.body).metadata();
    const { width = 0, height = 0 } = meta;
    if (width < MIN_WIDTH) return { ok: false, reason: `image too small (${width}x${height})`, source: src };
    const ratio = width / height;
    if (ratio < 1.3 || ratio > 2.5) return { ok: false, reason: `image not landscape (${width}x${height})`, source: src };
    const w = Math.min(1280, width);
    const h = Math.round(w * 0.625);
    const webp = await sharp(img.body).resize(w, h, { fit: "cover", position: "centre" }).webp({ quality: 72, effort: 5 }).toBuffer();
    writeFileSync(join(out, "img", "og", `${item.id}.webp`), webp);
    return { ok: true, reason: null, source: src, size: `${width}x${height}` };
  } catch (e) {
    return { ok: false, reason: `error: ${(e as Error).message.slice(0, 80)}` };
  }
}

const queue = items.filter((i) => !done.has(i.id));
let n = 0;
await Promise.all(
  Array.from({ length: workers }, async () => {
    while (queue.length) {
      const item = queue.shift()!;
      const r = await one(item);
      appendFileSync(resultsFile, JSON.stringify({ id: item.id, ...r }) + "\n");
      if (++n % 50 === 0) console.log(`${n} of ${n + queue.length}`);
    }
  }),
);
console.log("done", n);
