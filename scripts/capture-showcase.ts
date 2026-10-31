// Screenshots for the showcase. Visits each item's live address at 1280×800 in Chromium,
// rendered at 2× like a retina screen, and saves a 1280px WebP of the first screen to
// <out>/img/<item id>.webp, so cards stay sharp on retina laptops and phones. Only the sites'
// own pages are visited; gallery pages and gallery images are never saved.
//
// Pages that show a bot check, an error status or a blank screen are skipped, never
// worked around. Every outcome goes to <out>/results.ndjson, so a rerun resumes.
//
// Cookie banners: consent platforms are blocked and leftover banners removed (scripts/consent.ts).
// --banners <ids file> retakes only those items whose page shows a banner right now (others are
// logged as "no banner" and left alone), for clearing banners out of older screenshots.
//
// Run:  node scripts/capture-showcase.ts --out tmp/showcase-thumbs/batch-1 --limit 500
// Then: node scripts/cdn-sync.ts --add <out> (uploads to Cloudflare Pages; files land at
// img/<id>.webp) and scripts/showcase-thumbs-sql.ts. scripts/capture-showcase.sh does all three.
// Needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local
// (showcase items are publicly readable).

import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type BrowserContext } from "playwright";
import sharp from "sharp";
import { blockConsent, hideBanners, type Box } from "./consent.ts";

type Item = { id: string; url: string; thumb_path?: string | null };

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

const out = arg("out", "tmp/showcase-thumbs/batch");
const limit = Number(arg("limit", "500"));
const workers = Number(arg("workers", "6"));
// Retakes: --ids <file> (one item id per line) recaptures those items even if tried before, and
// --wait <ms> gives slow intros and loaders longer to finish (default 2.5 s).
const bannersOnly = process.argv.includes("--banners");
const idsFile = arg("ids", "") || arg("banners", "");
const settle = Number(arg("wait", "2500"));
// --shot <ms> gives heavy pages longer to paint the 2x screenshot (default 15 s).
const shotTimeout = Number(arg("shot", "15000"));
// A page that never settles is dropped after this long (90 s with the defaults).
const giveUp = 72_500 + settle + shotTimeout;
const width = Number(arg("width", "1280"));
const quality = Number(arg("quality", "72"));
// Retakes are saved under img/r/ so the new file gets a new address (the old one is cached for a year).
// --prefix <folder> picks another one, e.g. --prefix v2 for the sharper recapture (img/v2/).
const prefix = arg("prefix", bannersOnly ? "c" : idsFile ? "r" : "");
const imgDir = join(out, "img", prefix);
mkdirSync(imgDir, { recursive: true });

// Items already tried in any batch folder are skipped, whatever the outcome.
const root = join(out, "..");
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
  // Retakes go in their own folder tree (e.g. tmp/showcase-retakes), so "tried" means retaken.
  const ids = readFileSync(idsFile, "utf8").split(/\r?\n/).map((l) => l.trim()).filter((l) => /^[0-9a-f-]{36}$/.test(l) && !tried.has(l));
  for (let i = 0; i < ids.length && items.length < limit; i += 100) {
    const response = await fetch(`${supabaseUrl}/rest/v1/showcase_items?select=id,url,thumb_path&url=not.is.null&id=in.(${ids.slice(i, i + 100).join(",")})`, {
      headers: { apikey: key },
    });
    if (!response.ok) throw new Error(`Couldn't read showcase items: ${response.status}`);
    // A banner retake only replaces a screenshot that exists (archived sites have none).
    items.push(...((await response.json()) as Item[]).filter((it) => /^https?:\/\//.test(it.url) && (!bannersOnly || it.thumb_path)));
  }
}
for (let from = 0; !idsFile && items.length < limit; from += 1000) {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/showcase_items?select=id,url&url=not.is.null&thumb_checked_at=is.null&order=first_seen.desc,created_at.desc,id`,
    { headers: { apikey: key, range: `${from}-${from + 999}` } },
  );
  if (!response.ok) throw new Error(`Couldn't read showcase items: ${response.status}`);
  const page = (await response.json()) as Item[];
  items.push(...page.filter((i) => !tried.has(i.id) && /^https?:\/\//.test(i.url)));
  if (page.length < 1000) break;
}
items.splice(limit);
console.error(`${items.length} to capture in ${out}`);

// Lapsed domains that now show a parking page, a host's placeholder or spam.
const PARKED =
  /domain (is|may be) for sale|buy this domain|this domain (has expired|is parked)|parked free|hostinger|godaddy|account (has been )?suspended|website is (almost )?ready|casino|index of \//i;
// The capturing machine's internet provider shows its own page for sites it blocks. Those
// sites aren't gone, so they're left unchecked (see showcase-thumbs-sql.ts) for a later run elsewhere.
const NETWORK_BLOCK = /situs diblokir|internet ?positif|trustpositif|aduankonten/i;
const BLOCKED_HERE = "blocked on this network";
const BOT_CHECK = /security verification|just a moment|verify you are human|checking your browser|attention required|access denied|captcha/i;

const NO_BANNER = "no banner";

/** How much a screenshot shows (entropy at 320×200) with the given 1280×800 boxes blacked out. */
async function outsideBanners(image: Buffer, boxes: Box[]): Promise<number> {
  const scale = 320 / 1280;
  const rects = boxes.map((b) => `<rect x="${b.x * scale}" y="${b.y * scale}" width="${b.width * scale}" height="${b.height * scale}"/>`).join("");
  const masked = await sharp(image)
    .resize(320, 200, { fit: "cover", position: "top" })
    .composite([{ input: Buffer.from(`<svg width="320" height="200">${rects}</svg>`), top: 0, left: 0 }])
    .png()
    .toBuffer();
  return (await sharp(masked).stats()).entropy;
}

async function capture(context: BrowserContext, item: Item): Promise<{ failure: string | null; banners: number }> {
  let banners = 0;
  const fail = (failure: string | null) => ({ failure, banners });
  const page = await context.newPage();
  try {
    const response = await page.goto(item.url, { waitUntil: "load", timeout: 30_000 }).catch(async (error) => {
      // Slow pages: take what has rendered once the DOM is ready.
      if (!/Timeout/.test(String(error))) throw error;
      return null;
    });
    if (response && response.status() >= 400) return fail(`status ${response.status()}`);
    await page.waitForTimeout(settle);
    if (bannersOnly && !(await hideBanners(page, false)).length) return fail(NO_BANNER);
    const boxes = await hideBanners(page);
    banners = boxes.length;
    if (banners) await page.waitForTimeout(400);
    const title = await page.title().catch(() => "");
    const text = (await page.locator("body").innerText({ timeout: 3_000 }).catch(() => "")).slice(0, 1500);
    if (BOT_CHECK.test(title) || BOT_CHECK.test(text.slice(0, 400))) return fail("bot check page");
    if (PARKED.test(title) || PARKED.test(text)) return fail("parked or replaced domain");
    if (NETWORK_BLOCK.test(title) || NETWORK_BLOCK.test(text)) return fail(BLOCKED_HERE);
    const shot = await page.screenshot({ type: "png", timeout: shotTimeout });
    const stats = await sharp(shot).stats();
    if (stats.channels.slice(0, 3).every((c) => c.stdev < 3)) return fail("blank screen");
    // smartSubsample keeps small coloured text from smearing.
    const webp = await sharp(shot).resize({ width }).webp({ quality, smartSubsample: true, effort: 5 }).toBuffer();
    // A banner retake can catch an intro or loader the old screenshot had got past. If the rest of
    // the screen (the banner's area is blacked out in both) shows much less than the old screenshot
    // in the local mirror (cdn/openrefs-thumbs), the old one stays. Buffers, not paths: sharp keeps
    // files open on Windows.
    const old = join("cdn", "openrefs-thumbs", item.thumb_path ?? "");
    if (bannersOnly && item.thumb_path && existsSync(old)) {
      const [before, after] = await Promise.all([outsideBanners(readFileSync(old), boxes), outsideBanners(webp, boxes)]);
      // (Near-empty pages, like a plain black screen, have nothing to lose.)
      if (before > 0.5 && after < before * 0.8) {
        // Kept aside, so a run's rejects can be looked over.
        mkdirSync(join(out, "rejected"), { recursive: true });
        writeFileSync(join(out, "rejected", `${item.id}.webp`), webp);
        return fail(`retake looks emptier (${after.toFixed(1)} vs ${before.toFixed(1)})`);
      }
    }
    writeFileSync(join(imgDir, `${item.id}.webp`), webp);
    return fail(null);
  } catch (error) {
    return fail((error as Error).message.split("\n")[0].slice(0, 120));
  } finally {
    await page.close().catch(() => {});
  }
}

const browser = await chromium.launch({ args: ["--mute-audio"] });
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 2,
  reducedMotion: "reduce",
  locale: "en-US",
});
context.setDefaultNavigationTimeout(30_000);
// A retake for banners leaves the consent platform running, so the banner shows and is found.
if (!bannersOnly) await blockConsent(context);

let next = 0;
let done = 0;
await Promise.all(
  Array.from({ length: workers }, async () => {
    while (next < items.length) {
      const item = items[next++];
      // A page that never settles (a hung renderer, an endless dialog) mustn't stall the run.
      let timer: ReturnType<typeof setTimeout> | undefined;
      const { failure, banners } = await Promise.race([
        capture(context, item),
        new Promise<{ failure: string; banners: number }>(
          (resolve) => (timer = setTimeout(() => resolve({ failure: `gave up after ${giveUp / 1000} s`, banners: 0 }), giveUp)),
        ),
      ]);
      clearTimeout(timer);
      appendFileSync(join(out, "results.ndjson"), JSON.stringify({ id: item.id, ok: !failure, reason: failure, banners }) + "\n");
      done++;
      if (done % 25 === 0 || done === items.length) console.error(`${done}/${items.length}`);
    }
  }),
);
await browser.close();
