// Measures facts about each listed showcase site, for its design note (see showcase_designs):
// fonts actually used, colour variables and computed colours, dominant colours of the home
// screenshot, meta description, language, and platform / library hints. Facts only, no opinions.
// Writes one JSON line per site to <out>/facts.ndjson; a rerun skips sites already done.
//
// Run:  node scripts/extract-facts.ts --out tmp/designs [--limit 20] [--workers 6]
// Then: node scripts/facts-sql.ts tmp/designs > tmp/facts.sql; supabase db query --linked -f tmp/facts.sql

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type BrowserContext } from "playwright";
import sharp from "sharp";
import { blockConsent, hideBanners } from "./consent.ts";
import { BROWSER_ARGS } from "./screen.ts";

type Item = { id: string; url: string; details: { full?: string } | null };

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

const out = arg("out", "tmp/designs");
const limit = Number(arg("limit", "1000"));
const workers = Number(arg("workers", "6"));
const DETAILS = "https://openrefs-details.pages.dev";
mkdirSync(out, { recursive: true });
const file = join(out, "facts.ndjson");
const done = new Set<string>();
if (existsSync(file)) for (const l of readFileSync(file, "utf8").split("\n")) if (l) done.add(JSON.parse(l).id);

const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL");
const key = env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const items: Item[] = [];
for (let from = 0; ; from += 1000) {
  const r = await fetch(`${supabaseUrl}/rest/v1/showcase_items?select=id,url,details&status=eq.listed&url=not.is.null&order=id`, { headers: { apikey: key, range: `${from}-${from + 999}` } });
  if (!r.ok) throw new Error(`Couldn't read showcase items: ${r.status}`);
  const page = (await r.json()) as Item[];
  items.push(...page.filter((i) => !done.has(i.id) && /^https?:\/\//.test(i.url)));
  if (page.length < 1000) break;
}
items.splice(limit);
console.error(`${items.length} sites to measure`);

const hex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

/** Dominant colours of the home screenshot: 4-bit buckets, biggest first, near-duplicates merged. */
async function dominant(item: Item): Promise<{ hex: string; share: number }[]> {
  if (!item.details?.full) return [];
  try {
    const r = await fetch(`${DETAILS}/${item.details.full}`, { signal: AbortSignal.timeout(20_000) });
    if (!r.ok) return [];
    const { data, info } = await sharp(Buffer.from(await r.arrayBuffer()), { limitInputPixels: false })
      .resize({ width: 96 })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
    for (let i = 0; i < data.length; i += 3) {
      const k = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
      const b = buckets.get(k) ?? { n: 0, r: 0, g: 0, b: 0 };
      b.n++;
      b.r += data[i];
      b.g += data[i + 1];
      b.b += data[i + 2];
      buckets.set(k, b);
    }
    const total = info.width * info.height;
    const picked: { r: number; g: number; b: number; n: number }[] = [];
    for (const b of [...buckets.values()].sort((a, c) => c.n - a.n)) {
      const c = { r: b.r / b.n, g: b.g / b.n, b: b.b / b.n, n: b.n };
      const near = picked.find((p) => Math.abs(p.r - c.r) + Math.abs(p.g - c.g) + Math.abs(p.b - c.b) < 60);
      if (near) near.n += c.n;
      else picked.push(c);
      if (picked.length >= 12) break;
    }
    return picked.sort((a, c) => c.n - a.n).slice(0, 6).map((p) => ({ hex: hex(p.r, p.g, p.b), share: Math.round((p.n / total) * 100) / 100 }));
  } catch {
    return [];
  }
}

async function measure(context: BrowserContext, item: Item) {
  const colors = await dominant(item);
  const page = await context.newPage();
  try {
    const response = await page.goto(item.url, { waitUntil: "load", timeout: 30_000 }).catch((e) => {
      if (!/Timeout/.test(String(e))) throw e;
      return null;
    });
    if (response && response.status() >= 400) return { id: item.id, ok: false, error: `status ${response.status()}`, palette: colors };
    await page.waitForTimeout(3000);
    if ((await hideBanners(page)).length) await page.waitForTimeout(300);
    const dom = await page.evaluate(() => {
      const first = (v: string) => v.split(",")[0].trim().replace(/^["']|["']$/g, "");
      const cs = (sel: string) => {
        const el = document.querySelector(sel);
        return el ? getComputedStyle(el) : null;
      };
      const font = (sel: string) => {
        const s = cs(sel);
        return s ? { family: first(s.fontFamily), size: s.fontSize, weight: s.fontWeight, transform: s.textTransform, spacing: s.letterSpacing } : null;
      };
      const body = getComputedStyle(document.body);
      const loaded: string[] = [];
      document.fonts?.forEach((f) => {
        if (f.status === "loaded" && !loaded.includes(f.family.replace(/^["']|["']$/g, ""))) loaded.push(f.family.replace(/^["']|["']$/g, ""));
      });
      const vars: Record<string, string> = {};
      for (const sheet of Array.from(document.styleSheets)) {
        let rules: CSSRuleList;
        try {
          rules = sheet.cssRules;
        } catch {
          continue;
        }
        for (const rule of Array.from(rules)) {
          const r = rule as CSSStyleRule;
          if (r.selectorText !== ":root" && r.selectorText !== "html" && r.selectorText !== "body") continue;
          for (const name of Array.from(r.style)) {
            const v = r.style.getPropertyValue(name).trim();
            if (name.startsWith("--") && /^(#[0-9a-f]{3,8}|rgba?\(|hsla?\(|oklch\()/i.test(v) && Object.keys(vars).length < 14) vars[name] = v;
          }
        }
      }
      const html = document.documentElement.outerHTML.slice(0, 400_000);
      const srcs = [...document.scripts].map((s) => s.src).join(" ");
      const w = window as unknown as Record<string, unknown>;
      const hints: string[] = [];
      const has = (name: string, test: boolean) => test && hints.push(name);
      has("Webflow", /webflow/i.test(html) || !!w.Webflow);
      has("Framer", /framer(usercontent|\.com|-motion)|data-framer/i.test(html));
      has("Wix", /wixstatic|wix\.com/i.test(html));
      has("Squarespace", /squarespace/i.test(html));
      has("Shopify", /cdn\.shopify|Shopify\./i.test(html + srcs));
      has("WordPress", /wp-content|wp-includes/i.test(html));
      has("Next.js", !!w.__NEXT_DATA__ || /_next\/static/.test(html));
      has("Nuxt", !!w.__NUXT__ || /_nuxt\//.test(html));
      has("Astro", /astro-island|_astro\//.test(html));
      has("GSAP", !!w.gsap || /gsap/i.test(srcs));
      has("Three.js", !!w.THREE || /three(\.min)?\.js|three@/i.test(srcs) || !!document.querySelector("canvas"));
      has("Lenis", /lenis/i.test(srcs + html.slice(0, 50_000)));
      has("Locomotive Scroll", /locomotive/i.test(srcs));
      has("Swiper", /swiper/i.test(srcs) || !!document.querySelector(".swiper"));
      const meta = (n: string) => document.querySelector(`meta[name="${n}"], meta[property="${n}"]`)?.getAttribute("content")?.trim().slice(0, 300) ?? null;
      return {
        title: document.title.slice(0, 160),
        description: meta("description") ?? meta("og:description"),
        siteName: meta("og:site_name"),
        generator: meta("generator"),
        lang: document.documentElement.lang || null,
        fonts: { body: font("body"), h1: font("h1"), h2: font("h2"), nav: font("nav a, header a"), button: font("button, a[class*=btn], a[class*=button]"), loaded: loaded.slice(0, 8) },
        colors: {
          background: body.backgroundColor,
          text: body.color,
          link: cs("a") ? getComputedStyle(document.querySelector("a")!).color : null,
          h1: cs("h1")?.color ?? null,
          button: cs("button, a[class*=btn], a[class*=button]")?.backgroundColor ?? null,
        },
        cssVars: vars,
        hints,
        canvas: document.querySelectorAll("canvas").length,
        video: document.querySelectorAll("video").length,
      };
    });
    return { id: item.id, ok: true, palette: colors, ...dom };
  } catch (e) {
    return { id: item.id, ok: false, error: (e as Error).message.split("\n")[0].slice(0, 120), colors };
  } finally {
    await page.close().catch(() => {});
  }
}

const browser = await chromium.launch({ args: BROWSER_ARGS });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: "en-US" });
context.setDefaultNavigationTimeout(30_000);
await blockConsent(context);
let next = 0;
let n = 0;
await Promise.all(
  Array.from({ length: workers }, async () => {
    while (next < items.length) {
      const item = items[next++];
      let timer: ReturnType<typeof setTimeout> | undefined;
      const result = await Promise.race([
        measure(context, item),
        new Promise((resolve) => (timer = setTimeout(() => resolve({ id: item.id, ok: false, error: "gave up after 120 s", palette: [] }), 120_000))),
      ]);
      clearTimeout(timer);
      appendFileSync(file, JSON.stringify(result) + "\n");
      if (++n % 25 === 0 || n === items.length) console.error(`${n}/${items.length}`);
    }
  }),
);
await browser.close();
