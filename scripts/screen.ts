// Shared by capture-showcase.ts and capture-details.ts: what the capture browser needs so
// screenshots show the site as visitors see it, not its loader or a blank WebGL canvas.

import type { Page } from "playwright";
import sharp from "sharp";

// The GPU renders WebGL heroes; the software renderer often leaves them blank or half drawn.
export const BROWSER_ARGS = ["--mute-audio", ...(process.platform === "win32" ? ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] : [])];

// The site's host or app answering instead of the site: a crash, a gateway error, a removed site.
export const ERROR_PAGE =
  /unexpected server error|application error|bad gateway|service unavailable|gateway time-?out|internal server error|site (is )?not found|could not find the site|this site can.t be reached|no such app|deployment not found|there isn.t a github pages site here|404 not found|^404\b|page not found|error 5\d\d|this page isn.t working/i;

// A loader or intro still on screen: little text, and what there is says loading or counts up.
const LOADER = /^\W*(loading|chargement|laden|cargando)\b|^\W*\d{1,3}\s?%\W*$/i;

/** A 64×40 grey copy of the screen, and whether its middle is one flat colour. */
async function glance(page: Page): Promise<{ pixels: Buffer; emptyMiddle: boolean }> {
  const shot = await page.screenshot({ type: "jpeg", quality: 50, scale: "css", timeout: 5_000 });
  const pixels = await sharp(shot).resize(64, 40, { fit: "fill" }).greyscale().raw().toBuffer();
  const counts = new Array<number>(256).fill(0);
  for (const v of pixels) counts[v]++;
  const bg = counts.indexOf(Math.max(...counts));
  let flat = 0;
  let n = 0;
  for (let y = 10; y < 32; y++) for (let x = 10; x < 54; x++, n++) if (Math.abs(pixels[y * 64 + x] - bg) <= 4) flat++;
  return { pixels, emptyMiddle: flat / n > 0.98 };
}

/**
 * Waits for intros and loaders to finish: checks the screen every second, up to max ms, until
 * nothing reads "loading", the middle of the screen isn't empty and two checks in a row look the same.
 */
export async function waitForScreen(page: Page, max: number): Promise<void> {
  let last: Buffer | null = null;
  for (let waited = 0; waited < max; waited += 1_000) {
    const seen = await glance(page).catch(() => null);
    if (!seen) return;
    const text = (await page.locator("body").innerText({ timeout: 2_000 }).catch(() => "")).trim();
    const loading = text.length < 200 && LOADER.test(text);
    let change = Infinity;
    if (last) {
      change = 0;
      for (let i = 0; i < seen.pixels.length; i++) change += Math.abs(seen.pixels[i] - last[i]);
      change /= seen.pixels.length;
    }
    // A playing video never holds still, so a full screen is good enough after a few seconds.
    if (!loading && !seen.emptyMiddle && (change < 2 || waited >= 4_000)) return;
    last = seen.pixels;
    await page.waitForTimeout(1_000);
  }
}
