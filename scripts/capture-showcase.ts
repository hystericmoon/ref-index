// Screenshots for the showcase. Visits each item's live address at 1280×800 in Chromium
// and saves a 640px WebP of the first screen to <out>/img/<item id>.webp. Only the sites'
// own pages are visited; gallery pages and gallery images are never saved.
//
// Pages that show a bot check, an error status or a blank screen are skipped, never
// worked around. Every outcome goes to <out>/results.ndjson, so a rerun resumes.
//
// Run:  node scripts/capture-showcase.ts --out tmp/showcase-thumbs/batch-1 --limit 500
// Then: supabase storage cp -r <out>/img ss:///showcase --experimental (objects land at
// img/<id>.webp) and scripts/showcase-thumbs-sql.ts. scripts/capture-showcase.sh does all three.
// Needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local
// (showcase items are publicly readable).

import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type BrowserContext } from "playwright";
import sharp from "sharp";

type Item = { id: string; url: string };

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
mkdirSync(join(out, "img"), { recursive: true });

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
for (let from = 0; items.length < limit; from += 1000) {
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

// Cookie and consent banners are hidden (not clicked) so they don't cover the page.
const HIDE_BANNERS = `
  #onetrust-banner-sdk, #onetrust-consent-sdk, #CybotCookiebotDialog, #usercentrics-root, .cc-window,
  .cookie-banner, .cookie-consent, .cookie-notice, #cookie-banner, #cookie-notice, #cookie-law-info-bar,
  .cky-consent-container, #didomi-host, .qc-cmp2-container, #truste-consent-track, [aria-label*="cookie" i][role="dialog"],
  [class*="CookieBanner"], [id*="cookie-consent"] { display: none !important; }`;
// Lapsed domains that now show a parking page, a host's placeholder or spam.
const PARKED =
  /domain (is|may be) for sale|buy this domain|this domain (has expired|is parked)|parked free|hostinger|godaddy|account (has been )?suspended|website is (almost )?ready|casino|index of \//i;
const BOT_CHECK =/security verification|just a moment|verify you are human|checking your browser|attention required|access denied|captcha/i;

async function capture(context: BrowserContext, item: Item): Promise<string | null> {
  const page = await context.newPage();
  try {
    const response = await page.goto(item.url, { waitUntil: "load", timeout: 30_000 }).catch(async (error) => {
      // Slow pages: take what has rendered once the DOM is ready.
      if (!/Timeout/.test(String(error))) throw error;
      return null;
    });
    if (response && response.status() >= 400) return `status ${response.status()}`;
    await page.addStyleTag({ content: HIDE_BANNERS }).catch(() => {});
    await page.waitForTimeout(2500);
    const title = await page.title().catch(() => "");
    const text = (await page.locator("body").innerText({ timeout: 3_000 }).catch(() => "")).slice(0, 1500);
    if (BOT_CHECK.test(title) || BOT_CHECK.test(text.slice(0, 400))) return "bot check page";
    if (PARKED.test(title) || PARKED.test(text)) return "parked or replaced domain";
    const shot = await page.screenshot({ type: "png", timeout: 15_000 });
    const stats = await sharp(shot).stats();
    if (stats.channels.slice(0, 3).every((c) => c.stdev < 3)) return "blank screen";
    await sharp(shot).resize({ width: 640 }).webp({ quality: 70 }).toFile(join(out, "img", `${item.id}.webp`));
    return null;
  } catch (error) {
    return (error as Error).message.split("\n")[0].slice(0, 120);
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

let next = 0;
let done = 0;
await Promise.all(
  Array.from({ length: workers }, async () => {
    while (next < items.length) {
      const item = items[next++];
      // A page that never settles (a hung renderer, an endless dialog) mustn't stall the run.
      let timer: ReturnType<typeof setTimeout> | undefined;
      const failure = await Promise.race([
        capture(context, item),
        new Promise<string>((resolve) => (timer = setTimeout(() => resolve("gave up after 90 s"), 90_000))),
      ]);
      clearTimeout(timer);
      appendFileSync(join(out, "results.ndjson"), JSON.stringify({ id: item.id, ok: !failure, reason: failure }) + "\n");
      done++;
      if (done % 25 === 0 || done === items.length) console.error(`${done}/${items.length}`);
    }
  }),
);
await browser.close();
