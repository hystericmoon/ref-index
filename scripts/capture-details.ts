// Detail captures for showcase items: a full-page screenshot of the home page plus the first
// screen of up to three inner pages linked from it (work, about, pricing and the like), rendered
// at 2x like a retina screen. Saves WebPs to <out>/img/details/<item id>/{full,page-1,page-2,page-3}.webp
// (the full page 2048px wide, since the detail page shows it up to 1,024 CSS px; inner pages 1280px)
// and every outcome to <out>/results.ndjson, so a rerun resumes.
//
// Only Top picks (staff picks, or featured on 2+ galleries) with a home screenshot are captured.
// Retakes: --ids <file> recaptures those items even if done before, and --prefix <folder> saves
// under img/details/<folder>/ so the new files get new addresses (old ones are cached for a year).
// Same rules as capture-showcase.ts: only the
// sites' own pages are visited, and bot checks, errors and blank screens are skipped, never
// worked around. Cookie banners and pop-ups are kept out the same way too (scripts/consent.ts), and
// each page waits out its intro or loader on the GPU like the home screenshot (scripts/screen.ts).
//
// Run:  node scripts/capture-details.ts --out tmp/showcase-details/batch-1 --limit 200
// Then: node scripts/cdn-sync.ts --add <out> (uploads to Cloudflare Pages) and
// scripts/showcase-details-sql.ts. scripts/capture-details.sh does all three.

import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";
import sharp from "sharp";
import { blockConsent, hideBanners } from "./consent.ts";
import { BROWSER_ARGS, ERROR_PAGE, waitForScreen } from "./screen.ts";

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
const idsFile = arg("ids", "");
const prefix = arg("prefix", "");
const FULL_WIDTH = 2048;
const PAGE_WIDTH = 1280;

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
if (idsFile) {
  // Retakes go in their own folder tree (e.g. tmp/showcase-details-v2), so "tried" means retaken.
  const ids = readFileSync(idsFile, "utf8").split(/\r?\n/).map((l) => l.trim()).filter((l) => /^[0-9a-f-]{36}$/.test(l) && !tried.has(l));
  for (let i = 0; i < ids.length && items.length < limit; i += 100) {
    const response = await fetch(`${supabaseUrl}/rest/v1/showcase_items?select=id,url&url=not.is.null&id=in.(${ids.slice(i, i + 100).join(",")})`, {
      headers: { apikey: key },
    });
    if (!response.ok) throw new Error(`Couldn't read showcase items: ${response.status}`);
    items.push(...((await response.json()) as Item[]).filter((it) => /^https?:\/\//.test(it.url)));
  }
}
for (let from = 0; !idsFile && items.length < limit; from += 1000) {
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
  await page.waitForTimeout(2000);
  if ((await hideBanners(page)).length) await page.waitForTimeout(400);
  await waitForScreen(page, 12_000);
  // Banners that came in late, while the intro played.
  if ((await hideBanners(page)).length) await page.waitForTimeout(400);
  const title = await page.title().catch(() => "");
  const text = (await page.locator("body").innerText({ timeout: 3_000 }).catch(() => "")).slice(0, 1500);
  if (BOT_CHECK.test(title) || BOT_CHECK.test(text.slice(0, 400))) return "bot check page";
  if (NETWORK_BLOCK.test(title) || NETWORK_BLOCK.test(text)) return "blocked on this network";
  if (PARKED.test(title) || PARKED.test(text)) return REPLACED;
  if (ERROR_PAGE.test(title) || (text.length < 400 && ERROR_PAGE.test(text))) return "error page";
  return null;
}

async function save(png: Buffer, file: string, width: number): Promise<boolean> {
  const stats = await sharp(png, { limitInputPixels: false }).stats();
  if (stats.channels.slice(0, 3).every((c) => c.stdev < 3)) return false;
  mkdirSync(join(file, ".."), { recursive: true });
  // smartSubsample keeps small coloured text from smearing.
  await sharp(png, { limitInputPixels: false }).resize({ width }).webp({ quality: 70, smartSubsample: true, effort: 5 }).toFile(file);
  return true;
}

async function capture(context: BrowserContext, item: Item): Promise<DetailResult> {
  const page = await context.newPage();
  const dir = join(out, "img", "details", prefix, item.id);
  const rel = (name: string) => `img/details/${prefix ? `${prefix}/` : ""}${item.id}/${name}.webp`;
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
    // Pop-ups that open once the visitor scrolls.
    if ((await hideBanners(page)).length) await page.waitForTimeout(400);
    const full = await page.screenshot({ type: "png", fullPage: height > 800, clip: height > 800 ? { x: 0, y: 0, width: 1280, height } : undefined, timeout: 60_000 });
    if (!(await save(full, join(dir, "full.webp"), FULL_WIDTH))) return { id: item.id, ok: false, reason: "blank screen" };

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
        const shot = await inner.screenshot({ type: "png", timeout: 30_000 });
        const name = `page-${pages.length + 1}`;
        if (!(await save(shot, join(dir, `${name}.webp`), PAGE_WIDTH))) continue;
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

const browser = await chromium.launch({ args: BROWSER_ARGS });
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 2,
  // Reduced motion keeps many video heroes paused on a black frame; waitForScreen waits out the motion.
  reducedMotion: "no-preference",
  locale: "en-US",
});
context.setDefaultNavigationTimeout(30_000);
await blockConsent(context);

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
        new Promise<DetailResult>((resolve) => (timer = setTimeout(() => resolve({ id: item.id, ok: false, reason: "gave up after 300 s" }), 300_000))),
      ]);
      clearTimeout(timer);
      appendFileSync(join(out, "results.ndjson"), JSON.stringify(result) + "\n");
      done++;
      if (done % 25 === 0 || done === items.length) console.error(`${done}/${items.length}`);
    }
  }),
);
await browser.close();
