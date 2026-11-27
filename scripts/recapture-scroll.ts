// Retakes page screenshots that came out blank below the first screen (scroll-reveal, Lenis, loaders).
// Scrolls with real mouse-wheel events, takes one screenshot per screen at each stop, and stitches
// them, so sections that un-reveal when you scroll back up still show. Fixed elements (nav bars) are
// hidden after the first screen so they don't repeat down the page. Same rules as capture-details.ts:
// only the sites' own pages, bot checks and error pages are skipped, never worked around.
//
// Run:  node scripts/recapture-scroll.ts --targets tmp/targets.json --out tmp/rescroll/batch-1 --prefix s1 [--workers 6]
// targets.json: [{ "id": "<item id>", "position": 0, "url": "https://..." }]  (position 0 = home, up to 8 screens;
// 1-3 = inner page, first two screens). Writes <out>/img/details/<prefix>/<id>/{full|page-N}.webp and results.ndjson.

import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";
import sharp from "sharp";
import { blockConsent, hideBanners } from "./consent.ts";
import { BROWSER_ARGS, ERROR_PAGE, waitForScreen } from "./screen.ts";

type Target = { id: string; position: number; url: string };
const arg = (n: string, d: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const out = arg("out", "tmp/rescroll/batch-1");
const prefix = arg("prefix", "s1");
const workers = Number(arg("workers", "6"));
const targets = JSON.parse(readFileSync(arg("targets", "tmp/targets.json"), "utf8")) as Target[];

const BOT_CHECK = /security verification|just a moment|verify you are human|checking your browser|attention required|access denied|captcha/i;
const VIEW = { width: 1280, height: 800 };
const MAX_SCREENS_HOME = 8;
const MAX_SCREENS_INNER = 2;

async function open(page: Page, url: string): Promise<string | null> {
  const response = await page.goto(url, { waitUntil: "load", timeout: 30_000 }).catch((e) => (/Timeout/.test(String(e)) ? null : Promise.reject(e)));
  if (response && response.status() >= 400) return `status ${response.status()}`;
  await page.waitForTimeout(2500);
  if ((await hideBanners(page)).length) await page.waitForTimeout(400);
  await waitForScreen(page, 12_000);
  if ((await hideBanners(page)).length) await page.waitForTimeout(400);
  const title = await page.title().catch(() => "");
  const text = (await page.locator("body").innerText({ timeout: 3_000 }).catch(() => "")).slice(0, 1500);
  if (BOT_CHECK.test(title) || BOT_CHECK.test(text.slice(0, 400))) return "bot check page";
  if (ERROR_PAGE.test(title) || (text.length < 400 && ERROR_PAGE.test(text))) return "error page";
  return null;
}

const scrollY = (page: Page) => page.evaluate(() => Math.round(window.scrollY || document.documentElement.scrollTop || 0));

async function stitched(page: Page, maxScreens: number): Promise<{ png: Buffer; cssHeight: number; moved: boolean } | null> {
  const shots: { y: number; png: Buffer }[] = [];
  await page.mouse.move(VIEW.width / 2, VIEW.height / 2);
  let moved = false;
  for (let n = 0; n < maxScreens; n++) {
    if (n > 0) {
      const before = await scrollY(page);
      await page.mouse.wheel(0, VIEW.height * 0.9);
      await page.waitForTimeout(1100);
      let y = await scrollY(page);
      if (y === before) {
        // Smooth-scroll libraries and scroll-jacked pages may need another nudge; then call it the end.
        await page.mouse.wheel(0, VIEW.height * 0.9);
        await page.waitForTimeout(1100);
        y = await scrollY(page);
        if (y === before) break;
      }
      moved = true;
      // Hide fixed bars after the first screen so they don't repeat down the page.
      await page.evaluate(() => {
        for (const el of document.querySelectorAll<HTMLElement>("body *")) {
          if (getComputedStyle(el).position === "fixed") el.style.setProperty("visibility", "hidden", "important");
        }
      });
      if ((await hideBanners(page)).length) await page.waitForTimeout(300);
    }
    const y = await scrollY(page);
    if (shots.length && y <= shots[shots.length - 1].y) break; // reached the end
    shots.push({ y, png: await page.screenshot({ type: "png", timeout: 30_000 }) });
  }
  if (!shots.length) return null;
  const cssHeight = shots[shots.length - 1].y + VIEW.height;
  const canvas = sharp({ create: { width: VIEW.width * 2, height: cssHeight * 2, channels: 3, background: "#ffffff" } });
  const png = await canvas.composite(shots.map((s) => ({ input: s.png, left: 0, top: s.y * 2 }))).png().toBuffer();
  return { png, cssHeight, moved };
}

async function capture(context: BrowserContext, t: Target) {
  const page = await context.newPage();
  const name = t.position === 0 ? "full" : `page-${t.position}`;
  const file = join(out, "img", "details", prefix, t.id, `${name}.webp`);
  try {
    const failure = await open(page, t.url);
    if (failure) return { id: t.id, position: t.position, ok: false, reason: failure };
    const shot = await stitched(page, t.position === 0 ? MAX_SCREENS_HOME : MAX_SCREENS_INNER);
    if (!shot) return { id: t.id, position: t.position, ok: false, reason: "no screenshot" };
    const stats = await sharp(shot.png, { limitInputPixels: false }).stats();
    if (stats.channels.slice(0, 3).every((c) => c.stdev < 3)) return { id: t.id, position: t.position, ok: false, reason: "blank screen" };
    mkdirSync(join(file, ".."), { recursive: true });
    const width = t.position === 0 ? 2048 : 1280;
    await sharp(shot.png, { limitInputPixels: false }).resize({ width }).webp({ quality: 70, smartSubsample: true, effort: 5 }).toFile(file);
    return { id: t.id, position: t.position, ok: true, path: `img/details/${prefix}/${t.id}/${name}.webp`, cssHeight: shot.cssHeight, moved: shot.moved };
  } catch (e) {
    return { id: t.id, position: t.position, ok: false, reason: (e as Error).message.split("\n")[0].slice(0, 120) };
  } finally {
    await page.close().catch(() => {});
  }
}

const browser = await chromium.launch({ args: BROWSER_ARGS });
const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 2, reducedMotion: "no-preference", locale: "en-US" });
context.setDefaultNavigationTimeout(30_000);
await blockConsent(context);
mkdirSync(out, { recursive: true });
let next = 0;
let done = 0;
await Promise.all(
  Array.from({ length: workers }, async () => {
    while (next < targets.length) {
      const t = targets[next++];
      let timer: ReturnType<typeof setTimeout> | undefined;
      const result = await Promise.race([
        capture(context, t),
        new Promise((resolve) => (timer = setTimeout(() => resolve({ id: t.id, position: t.position, ok: false, reason: "gave up after 240 s" }), 240_000))),
      ]);
      clearTimeout(timer);
      appendFileSync(join(out, "results.ndjson"), JSON.stringify(result) + "\n");
      if (++done % 10 === 0 || done === targets.length) console.error(`${done}/${targets.length}`);
    }
  }),
);
await browser.close();
