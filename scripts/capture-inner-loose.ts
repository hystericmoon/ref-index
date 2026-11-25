// Top-up for sites with fewer than three inner pages: looser link rules than capture-details.ts.
// Keeps the pages already captured and adds new ones until the site has three, saving the extra
// screens to <out>/img/details/<prefix>/<item id>/page-N.webp and every outcome to
// <out>/results.ndjson ({ id, ok, reason, newPages }). Record them with scripts/inner-loose-sql.ts.
//
// Looser than the normal run: two path segments per section (/work/a and /work/b), same-site
// subdomains, the sitemap, clicks on non-link nav items,
// contact and legal pages only as a last resort, 12 candidates, and a longer wait per page.
// Same rules otherwise: only the site's own pages, bot checks, errors, parked domains and blank
// screens are skipped, never worked around.
//
// Run:  node scripts/capture-inner-loose.ts --ids tmp/inner/ids-under3.txt --out tmp/showcase-details-v5/batch-1 --prefix v5 [--limit 20] [--workers 6]
// Then: node scripts/cdn-sync.ts --add <out>; node scripts/inner-loose-sql.ts <out> > x.sql; supabase db query --linked -f x.sql

import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";
import sharp from "sharp";
import { blockConsent, hideBanners } from "./consent.ts";
import { BROWSER_ARGS, ERROR_PAGE, waitForScreen } from "./screen.ts";

type Existing = { path: string; url: string; title: string };
type Item = { id: string; url: string; details: { full?: string; pages?: Existing[] } | null };
export type LoosePage = { path: string; url: string; title: string };
export type LooseResult = { id: string; ok: boolean; reason?: string | null; newPages?: LoosePage[] };
type Candidate = { href: string; text: string; hash?: string; rank: number };

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

const out = arg("out", "tmp/showcase-details-v5/batch");
const limit = Number(arg("limit", "200"));
const workers = Number(arg("workers", "6"));
const idsFile = arg("ids", "");
const prefix = arg("prefix", "v5");
const PAGE_WIDTH = 1280;
const WANT = 3;
if (!idsFile) throw new Error("Pass --ids <file>");

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
const ids = readFileSync(idsFile, "utf8").split(/\r?\n/).map((l) => l.trim()).filter((l) => /^[0-9a-f-]{36}$/.test(l) && !tried.has(l));
for (let i = 0; i < ids.length; i += 100) {
  const response = await fetch(`${supabaseUrl}/rest/v1/showcase_items?select=id,url,details&url=not.is.null&id=in.(${ids.slice(i, i + 100).join(",")})`, {
    headers: { apikey: key },
  });
  if (!response.ok) throw new Error(`Couldn't read showcase items: ${response.status}`);
  items.push(...((await response.json()) as Item[]).filter((it) => /^https?:\/\//.test(it.url) && it.details?.full));
}
items.splice(limit);
console.error(`${items.length} to top up in ${out}`);

const BOT_CHECK = /security verification|just a moment|verify you are human|checking your browser|attention required|access denied|captcha/i;
const NETWORK_BLOCK = /situs diblokir|internet ?positif|trustpositif|aduankonten/i;
const PARKED =
  /domain (is|may be) for sale|buy this domain|this domain (has expired|is parked)|parked free|account (has been )?suspended|(?<!\p{L})(casino|togel|gacor|slot online|judi|sportsbook|maxwin|adult media)(?!\p{L})/iu;
const PREFERRED = /\b(work|projects?|case-?stud(y|ies)|portfolio|about|studio|team|services|pricing|plans|features|product|shop|store|collections?|menu|journal|blog|stories|careers|archive|index|news|events?|gallery|film|music|artists?|people)\b/i;
// Never captured: accounts, checkout, files.
const HARD_SKIP = /(privacy|terms|cookie|legal|imprint|impressum|policy|log-?in|sign-?(in|up)|register|account|cart|checkout|mailto:|tel:|\.(pdf|zip|jpe?g|png|gif|webp|svg|mp4|mp3)$)/i;
// Last resort, only to reach three pages (legal pages are never captured).
const SOFT_SKIP = /(contact)/i;

async function open(page: Page, url: string): Promise<string | null> {
  const response = await page.goto(url, { waitUntil: "load", timeout: 40_000 }).catch(async (error) => {
    if (!/Timeout/.test(String(error))) throw error;
    return null;
  });
  if (response && response.status() >= 400) return `status ${response.status()}`;
  await page.waitForTimeout(4000);
  if ((await hideBanners(page)).length) await page.waitForTimeout(400);
  await waitForScreen(page, 15_000);
  if ((await hideBanners(page)).length) await page.waitForTimeout(400);
  const title = await page.title().catch(() => "");
  const text = (await page.locator("body").innerText({ timeout: 3_000 }).catch(() => "")).slice(0, 1500);
  if (BOT_CHECK.test(title) || BOT_CHECK.test(text.slice(0, 400))) return "bot check page";
  if (NETWORK_BLOCK.test(title) || NETWORK_BLOCK.test(text)) return "blocked on this network";
  if (PARKED.test(title) || PARKED.test(text)) return "parked or replaced domain";
  if (ERROR_PAGE.test(title) || (text.length < 400 && ERROR_PAGE.test(text))) return "error page";
  return null;
}

async function save(png: Buffer, file: string, width: number): Promise<boolean> {
  const stats = await sharp(png, { limitInputPixels: false }).stats();
  if (stats.channels.slice(0, 3).every((c) => c.stdev < 3)) return false;
  mkdirSync(join(file, ".."), { recursive: true });
  await sharp(png, { limitInputPixels: false }).resize({ width }).webp({ quality: 70, smartSubsample: true, effort: 5 }).toFile(file);
  return true;
}

const base = (host: string) => host.replace(/^www\./, "");
const sameSite = (host: string, home: string) => base(host) === base(home) || base(host).endsWith(`.${base(home)}`);
const norm = (u: URL) => `${base(u.hostname)}${u.pathname.replace(/\/+$/, "") || "/"}`;
// One candidate per first two path segments, so /work/a and /work/b both count but /work/a?x=1 doesn't repeat.
const sectionKey = (u: URL) => u.pathname.split("/").filter(Boolean).slice(0, 2).join("/").toLowerCase();

async function sitemapLinks(home: URL): Promise<string[]> {
  const get = async (url: string) => {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(8_000), headers: { "user-agent": "Mozilla/5.0" } });
      return r.ok ? await r.text() : "";
    } catch {
      return "";
    }
  };
  const robots = await get(`${home.origin}/robots.txt`);
  let maps = [...robots.matchAll(/^sitemap:\s*(\S+)/gim)].map((m) => m[1]);
  if (!maps.length) maps = [`${home.origin}/sitemap.xml`];
  const locs: string[] = [];
  for (const m of maps.slice(0, 2)) {
    let xml = await get(m);
    const nested = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((x) => x[1]);
    if (/<sitemapindex/i.test(xml) && nested[0]) xml = await get(nested[0]);
    locs.push(...[...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((x) => x[1]).filter((l) => !/\.xml$/i.test(l)));
    if (locs.length > 400) break;
  }
  return locs.slice(0, 400);
}

async function topUp(context: BrowserContext, item: Item): Promise<LooseResult> {
  const existing = item.details?.pages ?? [];
  const need = WANT - existing.length;
  const have = new Set(existing.map((p) => { try { return norm(new URL(p.url)); } catch { return p.url; } }));
  const page = await context.newPage();
  try {
    const failure = await open(page, item.url);
    if (failure) return { id: item.id, ok: false, reason: failure };
    const home = new URL(page.url());
    have.add(norm(home));

    const raw: { href: string; text: string; nav: boolean }[] = await page.evaluate(() =>
      [...document.querySelectorAll("a[href]")].map((a) => ({
        href: (a as HTMLAnchorElement).href,
        text: (a.textContent ?? (a as HTMLElement).getAttribute("aria-label") ?? "").trim().replace(/\s+/g, " ").slice(0, 60),
        nav: !!a.closest("header, nav, [role=navigation]"),
      })),
    );
    const cands: Candidate[] = [];
    const seen = new Set<string>();
    const add = (href: string, text: string, nav: boolean, sitemap = false) => {
      let u: URL;
      try {
        u = new URL(href);
      } catch {
        return;
      }
      if (!/^https?:$/.test(u.protocol) || !sameSite(u.hostname, home.hostname)) return;
      if (HARD_SKIP.test(u.pathname) || HARD_SKIP.test(text)) return;
      // /#section links are parts of the home page, which the full-page capture already covers.
      if (u.hash.length > 2 && u.pathname.replace(/\/+$/, "") === home.pathname.replace(/\/+$/, "")) return;
      const hash = undefined as string | undefined;
      const k = hash ? `#${hash.toLowerCase()}` : sectionKey(u);
      if (!hash && (!k || have.has(norm(u)))) return;
      if (hash === undefined && !u.pathname.replace(/\//g, "")) return;
      if (seen.has(k)) return;
      seen.add(k);
      const soft = SOFT_SKIP.test(u.pathname) || SOFT_SKIP.test(text);
      const pref = PREFERRED.test(`${u.pathname} ${text}`);
      // Lower is better: preferred nav links, other nav links, other links, sitemap, soft-skipped last.
      const rank = soft ? 9 : sitemap ? (pref ? 4 : 5) : (pref ? 0 : 2) + (nav ? 0 : 1);
      cands.push({ href: hash ? `${home.origin}${home.pathname}${hash}` : `${u.origin}${u.pathname}`, text, hash, rank });
    };
    for (const l of raw) add(l.href, l.text, l.nav);

    // Navigation that isn't a link: click it and see where it goes.
    if (cands.filter((c) => c.rank < 9).length < 3) {
      const handles = await page.locator("header [role=link], nav [role=link], header button, nav button, [role=navigation] button").all();
      for (const h of handles.slice(0, 8)) {
        if (!(await h.isVisible().catch(() => false))) continue;
        const text = ((await h.innerText({ timeout: 1000 }).catch(() => "")) || "").trim().replace(/\s+/g, " ").slice(0, 60);
        if (!text || HARD_SKIP.test(text)) continue;
        const before = page.url();
        await h.click({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(1500);
        if (page.url() !== before) {
          add(page.url(), text, true);
          await page.goBack({ timeout: 10_000 }).catch(() => {});
          await page.waitForTimeout(1000);
        }
      }
    }
    // The sitemap, only when the page itself gave too few.
    if (cands.filter((c) => c.rank < 9).length < need + 2) {
      for (const loc of await sitemapLinks(home)) add(loc, "", false, true);
    }
    cands.sort((a, b) => a.rank - b.rank);

    const dir = join(out, "img", "details", prefix, item.id);
    const newPages: LoosePage[] = [];
    for (const c of cands.slice(0, 12)) {
      if (newPages.length >= need) break;
      const inner = await context.newPage();
      try {
        if (await open(inner, c.href)) continue;
        if (c.hash) {
          const found = await inner.evaluate((h) => {
            const el = document.getElementById(decodeURIComponent(h.slice(1))) ?? document.querySelector(`[name="${h.slice(1)}"]`);
            el?.scrollIntoView();
            return !!el;
          }, c.hash).catch(() => false);
          if (!found) continue;
          await inner.waitForTimeout(1200);
        }
        const shot = await inner.screenshot({ type: "png", timeout: 30_000 });
        const name = `page-${existing.length + newPages.length + 1}`;
        if (!(await save(shot, join(dir, `${name}.webp`), PAGE_WIDTH))) continue;
        const title = (await inner.title().catch(() => "")) || c.text;
        newPages.push({ path: `img/details/${prefix}/${item.id}/${name}.webp`, url: inner.url(), title: title.replace(/\s+/g, " ").trim().slice(0, 120) });
        have.add(norm(new URL(inner.url())));
      } catch {
        // An inner page that fails is just left out.
      } finally {
        await inner.close().catch(() => {});
      }
    }
    return { id: item.id, ok: true, newPages };
  } catch (error) {
    return { id: item.id, ok: false, reason: (error as Error).message.split("\n")[0].slice(0, 120) };
  } finally {
    await page.close().catch(() => {});
  }
}

const browser = await chromium.launch({ args: BROWSER_ARGS });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, reducedMotion: "no-preference", locale: "en-US" });
context.setDefaultNavigationTimeout(40_000);
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
        topUp(context, item),
        new Promise<LooseResult>((resolve) => (timer = setTimeout(() => resolve({ id: item.id, ok: false, reason: "gave up after 400 s" }), 400_000))),
      ]);
      clearTimeout(timer);
      appendFileSync(join(out, "results.ndjson"), JSON.stringify(result) + "\n");
      done++;
      if (done % 10 === 0 || done === items.length) console.error(`${done}/${items.length}`);
    }
  }),
);
await browser.close();
