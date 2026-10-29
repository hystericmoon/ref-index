// Detail captures for showcase items: a full-page screenshot of the home page plus the first
// screen of up to three inner pages linked from it (work, about, pricing and the like). Saves
// 960px-wide WebPs to <out>/img/details/<item id>/{full,page-1,page-2,page-3}.webp and every
// outcome to <out>/results.ndjson, so a rerun resumes.
//
// Only Top picks (staff picks, or featured on 2+ galleries) with a home screenshot are captured,
// to keep the bucket inside the free storage tier. Same rules as capture-showcase.ts: only the
// sites' own pages are visited, and bot checks, errors and blank screens are skipped, never
// worked around.
//
// Run:  node scripts/capture-details.ts --out tmp/showcase-details/batch-1 --limit 200
// Then: supabase storage cp -r <out>/img ss:///showcase --experimental and
// scripts/showcase-details-sql.ts. scripts/capture-details.sh does all three.

import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";
import sharp from "sharp";

type Item = { id: string; url: string };
export type DetailPage = { path: string; url: string; title: string };
export type DetailResult = { id: string; ok: boolean; reason?: string | null; full?: string; fullHeight?: number; pages?: DetailPage[] };

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

const out = arg("out", "tmp/showcase-details/batch");
const limit = Number(arg("limit", "200"));
const workers = Number(arg("workers", "8"));

const root = join(out, "..");
mkdirSync(root, { recursive: true });
const tried = new Set<string>();
for (const dir of readdirSync(root)) {
  const file = join(root, dir, "results.ndjson");
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) if (line) tried.add(JSON.parse(line).id);
}

const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL");
const key = env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const items: Item[] = [];
for (let from = 0; items.length < limit; from += 1000) {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/showcase_items?select=id,url&status=eq.listed&thumb_path=not.is.null&details_checked_at=is.null&or=(staff_pick.is.true,gallery_count.gte.2)&order=staff_pick.desc,gallery_count.desc,id`,
    { headers: { apikey: key, range: `${from}-${from + 999}` } },
  );
  if (!response.ok) throw new Error(`Couldn't read showcase items: ${response.status}`);
  const page = (await response.json()) as Item[];
  items.push(...page.filter((i) => !tried.has(i.id) && /^https?:\/\//.test(i.url)));
  if (page.length < 1000) break;
}
items.splice(limit);
console.error(`${items.length} to capture in ${out}`);

const HIDE_BANNERS = `
  #onetrust-banner-sdk, #onetrust-consent-sdk, #CybotCookiebotDialog, #usercentrics-root, .cc-window,
  .cookie-banner, .cookie-consent, .cookie-notice, #cookie-banner, #cookie-notice, #cookie-law-info-bar,
  .cky-consent-container, #didomi-host, .qc-cmp2-container, #truste-consent-track, [aria-label*="cookie" i][role="dialog"],
  [class*="CookieBanner"], [id*="cookie-consent"] { display: none !important; }`;
const BOT_CHECK = /security verification|just a moment|verify you are human|checking your browser|attention required|access denied|captcha/i;
const NETWORK_BLOCK = /situs diblokir|internet ?positif|trustpositif|aduankonten/i;
// Lapsed domains now parked or taken over by spam. These get flagged for an editor
// (showcase-details-sql.ts), since the site in the showcase is gone.
export const REPLACED = "parked or replaced domain";
const PARKED =
  /domain (is|may be) for sale|buy this domain|this domain (has expired|is parked)|parked free|account (has been )?suspended|(?<!\p{L})(casino|togel|gacor|slot online|judi|sportsbook|maxwin|adult media)(?!\p{L})/iu;
// Inner pages worth showing, best first; links to accounts, legal pages and files are skipped.
const PREFERRED = /\b(work|projects?|case-?stud(y|ies)|portfolio|about|studio|team|services|pricing|plans|features|product|shop|store|collections?|menu|journal|blog|stories|careers)\b/i;
const SKIP = /(log-?in|sign-?(in|up)|register|account|cart|checkout|privacy|terms|cookie|legal|imprint|impressum|policy|contact|mailto:|tel:|\.(pdf|zip|jpe?g|png|mp4)$)/i;
// Full-page captures stop at 6,400 CSS pixels (8 screens) to keep files small.
const MAX_HEIGHT = 6400;

async function open(page: Page, url: string): Promise<string | null> {
  const response = await page.goto(url, { waitUntil: "load", timeout: 30_000 }).catch(async (error) => {
    if (!/Timeout/.test(String(error))) throw error;
    return null;
  });
  if (response && response.status() >= 400) return `status ${response.status()}`;
  await page.addStyleTag({ content: HIDE_BANNERS }).catch(() => {});
  await page.waitForTimeout(2000);
  const title = await page.title().catch(() => "");
  const text = (await page.locator("body").innerText({ timeout: 3_000 }).catch(() => "")).slice(0, 1500);
  if (BOT_CHECK.test(title) || BOT_CHECK.test(text.slice(0, 400))) return "bot check page";
  if (NETWORK_BLOCK.test(title) || NETWORK_BLOCK.test(text)) return "blocked on this network";
  if (PARKED.test(title) || PARKED.test(text)) return REPLACED;
  return null;
}

async function save(png: Buffer, file: string): Promise<boolean> {
  const stats = await sharp(png).stats();
  if (stats.channels.slice(0, 3).every((c) => c.stdev < 3)) return false;
  mkdirSync(join(file, ".."), { recursive: true });
  await sharp(png, { limitInputPixels: false }).resize({ width: 960 }).webp({ quality: 60 }).toFile(file);
  return true;
}

async function capture(context: BrowserContext, item: Item): Promise<DetailResult> {
  const page = await context.newPage();
  const dir = join(out, "img", "details", item.id);
  const rel = (name: string) => `img/details/${item.id}/${name}.webp`;
  try {
    const failure = await open(page, item.url);
    if (failure) return { id: item.id, ok: false, reason: failure };

    // Scroll through the page so lazy-loaded sections render, then back to the top.
    const height = await page.evaluate(async (max) => {
      const step = window.innerHeight * 0.8;
      for (let y = 0; y < Math.min(document.documentElement.scrollHeight, max); y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 250));
      }
      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 600));
      return Math.min(document.documentElement.scrollHeight, max);
    }, MAX_HEIGHT);
    const full = await page.screenshot({ type: "png", fullPage: height > 800, clip: height > 800 ? { x: 0, y: 0, width: 1280, height } : undefined, timeout: 30_000 });
    if (!(await save(full, join(dir, "full.webp")))) return { id: item.id, ok: false, reason: "blank screen" };

    // Inner pages: same-site links, header and nav first, one per first path segment.
    const home = new URL(page.url());
    const links = await page.evaluate(() =>
      [...document.querySelectorAll("header a[href], nav a[href], a[href]")].map((a) => ({
        href: (a as HTMLAnchorElement).href,
        text: (a.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 60),
      })),
    );
    const seen = new Set<string>();
    const candidates: { href: string; text: string }[] = [];
    for (const l of links) {
      let u: URL;
      try {
        u = new URL(l.href);
      } catch {
        continue;
      }
      if (u.hostname.replace(/^www\./, "") !== home.hostname.replace(/^www\./, "")) continue;
      const segment = u.pathname.split("/").filter(Boolean)[0]?.toLowerCase();
      if (!segment || seen.has(segment) || SKIP.test(u.pathname) || SKIP.test(l.text)) continue;
      seen.add(segment);
      candidates.push({ href: `${u.origin}${u.pathname}`, text: l.text });
    }
    candidates.sort((a, b) => Number(PREFERRED.test(b.href + " " + b.text)) - Number(PREFERRED.test(a.href + " " + a.text)));

    const pages: DetailPage[] = [];
    for (const c of candidates.slice(0, 6)) {
      if (pages.length === 3) break;
      const inner = await context.newPage();
      try {
        if (await open(inner, c.href)) continue;
        const shot = await inner.screenshot({ type: "png", timeout: 15_000 });
        const name = `page-${pages.length + 1}`;
        if (!(await save(shot, join(dir, `${name}.webp`)))) continue;
        const title = (await inner.title().catch(() => "")) || c.text;
        pages.push({ path: rel(name), url: inner.url(), title: title.replace(/\s+/g, " ").trim().slice(0, 120) });
      } catch {
        // An inner page that fails is just left out.
      } finally {
        await inner.close().catch(() => {});
      }
    }
    return { id: item.id, ok: true, full: rel("full"), fullHeight: height, pages };
  } catch (error) {
    return { id: item.id, ok: false, reason: (error as Error).message.split("\n")[0].slice(0, 120) };
  } finally {
    await page.close().catch(() => {});
  }
}

const browser = await chromium.launch({ args: ["--mute-audio"] });
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
  reducedMotion: "reduce",
  locale: "en-US",
});
context.setDefaultNavigationTimeout(30_000);

mkdirSync(join(out, "img"), { recursive: true });
let next = 0;
let done = 0;
await Promise.all(
  Array.from({ length: workers }, async () => {
    while (next < items.length) {
      const item = items[next++];
      let timer: ReturnType<typeof setTimeout> | undefined;
      const result = await Promise.race([
        capture(context, item),
        new Promise<DetailResult>((resolve) => (timer = setTimeout(() => resolve({ id: item.id, ok: false, reason: "gave up after 150 s" }), 150_000))),
      ]);
      clearTimeout(timer);
      appendFileSync(join(out, "results.ndjson"), JSON.stringify(result) + "\n");
      done++;
      if (done % 25 === 0 || done === items.length) console.error(`${done}/${items.length}`);
    }
  }),
);
await browser.close();
