// One-off backfill of the showcase: reads every page each gallery lists (not just the
// newest picks) and adds names and links through public.add_showcase_entries. Add-only.
//
// Politeness: honours robots.txt (Disallow/Allow and Crawl-delay), one request at a time
// per gallery with at least 1.5 s between requests, exponential back-off on 429/503, and
// it gives up on a gallery that stays blocked. It never works around CAPTCHAs or blocks.
//
// Run:  node --no-warnings scripts/backfill-showcase.ts crawl [gallery…]   (resumable)
//       node --no-warnings scripts/backfill-showcase.ts apply              (chunks of 300)
// Progress lives in tmp/backfill/<gallery>.json, SQL chunks in tmp/backfill/sql/.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import {
  GALLERIES,
  USER_AGENT,
  decode,
  parseGallery,
  type Found,
  type Gallery,
} from "../supabase/functions/showcase-refresh/galleries.ts";

const DIR = "tmp/backfill";
const MIN_GAP_MS = 1500;
/** Hosts that rate-limit quickly get a longer gap; Land-book answers 403 to bursts. */
const SLOW_HOSTS: Record<string, number> = { "https://land-book.com": 5000 };
const MAX_PAGES = 600;
const BACKOFF_S = [30, 60, 120, 240];
const CHUNK = 300;

type State = {
  gallery: string;
  step: number;
  page: number;
  done: boolean;
  notes: string[];
  entries: Found[];
  applied: number;
  added: { items: number; credits: number };
};

/** One source to read: either numbered pages or a single URL, parsed one way. */
type Step = {
  label: string;
  url: (page: number) => string;
  paged: boolean;
  parse: (body: string, url: string) => Found[];
};

const base = (name: string) => GALLERIES.find((g) => g.name === name)!;
const as = (name: string, extra: Partial<Gallery>) => ({ ...base(name), ...extra }) as Gallery;
const parseWith = (g: Gallery) => (body: string, url: string) => parseGallery(g, body, url);
const single = (label: string, url: string, parse: Step["parse"]): Step => ({ label, url: () => url, paged: false, parse });
const paged = (label: string, url: (n: number) => string, parse: Step["parse"]): Step => ({ label, url, paged: true, parse });

/** Httpster publishes its whole list as /websites.json. */
function parseHttpster(body: string): Found[] {
  const data = JSON.parse(body) as { websites: { title: string; url: string; sponsored: boolean }[] };
  return data.websites
    .filter((w) => !w.sponsored && w.url.startsWith("/website/"))
    .map((w) => ({
      gallery: "Httpster",
      name: decode(w.title),
      src: new URL(w.url, "https://httpster.net/").href,
      url: null,
      platform: "web",
    }));
}

/** Godly's app list: records {"id","name","slug",…,"appUrl"} embedded in the page. */
function parseGodlyApps(body: string): Found[] {
  const text = body.replace(/\\"/g, '"');
  const heads = [...text.matchAll(/\{"id":"[0-9a-f]{24}","name":"((?:[^"\\]|\\.)*)","slug":"([a-z0-9-]+)"/g)];
  const out = new Map<string, Found>();
  heads.forEach((m, i) => {
    const end = heads[i + 1]?.index ?? text.length;
    const app = text.slice(m.index, end).match(/"appUrl":"(https:\/\/apps\.apple\.com\/[^"]+)"/)?.[1] ?? null;
    let name = m[1];
    try {
      name = JSON.parse(`"${name}"`);
    } catch {}
    const src = `https://godly.design/app/${m[2]}`;
    if (!out.has(src) && name.trim())
      out.set(src, { gallery: "Godly", name: decode(name), src, url: app ? app.split("?")[0] : null, platform: "ios" });
  });
  return [...out.values()];
}

const PLANS: Record<string, Step[]> = {
  "Land-book": [
    paged(
      "listing",
      (n) => `https://land-book.com/?page=${n}`,
      parseWith(as("Land-book", { kind: "jsonld", jsonType: "CreativeWork", item: /^https:\/\/land-book\.com\/websites\/\d+-/ })),
    ),
  ],
  SiteInspire: [
    paged(
      "listing",
      (n) => `https://www.siteinspire.com/websites?page=${n}`,
      parseWith(as("SiteInspire", { kind: "html", item: /^https:\/\/www\.siteinspire\.com\/website\/\d+-[a-z0-9-]+$/ })),
    ),
  ],
  "One Page Love": [paged("feed", (n) => `https://onepagelove.com/feed?paged=${n}`, parseWith(base("One Page Love")))],
  "Minimal Gallery": [paged("feed", (n) => `https://minimal.gallery/feed/?paged=${n}`, parseWith(base("Minimal Gallery")))],
  LaudableApps: [single("feed", "https://laudableapps.com/feed.xml", parseWith(base("LaudableApps")))],
  Godly: [
    single("websites", "https://godly.design/websites/", parseWith(base("Godly"))),
    single("apps", "https://godly.design/apps/", parseGodlyApps),
  ],
  Httpster: [single("websites.json", "https://httpster.net/websites.json", parseHttpster)],
  "CSS Design Awards": [
    paged("wotd", (n) => `https://www.cssdesignawards.com/wotd-award-winners?page=${n}`, parseWith(base("CSS Design Awards"))),
  ],
  Awwwards: [paged("sotd", (n) => `https://www.awwwards.com/websites/sites_of_the_day/?page=${n}`, parseWith(base("Awwwards")))],
  Banani: [single("references", "https://www.banani.co/references", parseWith(base("Banani")))],
  "Three.js": [single("home", "https://threejs.org/", parseWith(base("Three.js")))],
  "Brutalist Websites": [single("home", "https://brutalistwebsites.com/", parseWith(base("Brutalist Websites")))],
  "Apple Design Awards": ["", "2025/", "2024/", "2023/", "2022/", "2021/", "2020/", "2019/"].map((year) =>
    single(year || "current", `https://developer.apple.com/design/awards/${year}`, parseWith(base("Apple Design Awards"))),
  ),
};

// ---------- polite fetching ----------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
type Rules = { rules: { allow: boolean; path: string }[]; delay: number };
const robotsCache = new Map<string, Promise<Rules>>();
const lastHit = new Map<string, number>();

function parseRobots(text: string): Rules {
  // Groups: consecutive User-agent lines, then rules. Use the group naming "*".
  let agents: string[] = [];
  let inRules = false;
  const groups: { agents: string[]; rules: Rules["rules"]; delay: number }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === "user-agent") {
      if (inRules) {
        agents = [];
        inRules = false;
      }
      agents.push(value.toLowerCase());
      if (agents.length === 1) groups.push({ agents, rules: [], delay: 0 });
    } else if (groups.length) {
      inRules = true;
      const g = groups.at(-1)!;
      if (key === "disallow" && value) g.rules.push({ allow: false, path: value });
      if (key === "allow" && value) g.rules.push({ allow: true, path: value });
      if (key === "crawl-delay") g.delay = Number(value) || 0;
    }
  }
  const mine = groups.filter((g) => g.agents.includes("*"));
  return { rules: mine.flatMap((g) => g.rules), delay: Math.max(0, ...mine.map((g) => g.delay)) };
}

function allowed(rules: Rules, pathAndQuery: string) {
  let best: { allow: boolean; len: number } = { allow: true, len: -1 };
  for (const r of rules.rules) {
    const re = new RegExp(
      "^" + r.path.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$"),
    );
    if (re.test(pathAndQuery) && r.path.length > best.len) best = { allow: r.allow, len: r.path.length };
  }
  return best.allow;
}

function robotsFor(origin: string) {
  if (!robotsCache.has(origin)) {
    robotsCache.set(
      origin,
      (async () => {
        await politeWait(origin, 0);
        const res = await fetch(`${origin}/robots.txt`, { headers: { "user-agent": USER_AGENT } });
        return res.ok ? parseRobots(await res.text()) : { rules: [], delay: 0 };
      })(),
    );
  }
  return robotsCache.get(origin)!;
}

async function politeWait(origin: string, delayS: number) {
  const gap = Math.max(SLOW_HOSTS[origin] ?? MIN_GAP_MS, delayS * 1000);
  const wait = (lastHit.get(origin) ?? 0) + gap - Date.now();
  if (wait > 0) await sleep(wait);
  lastHit.set(origin, Date.now());
}

class Blocked extends Error {}

async function politeGet(url: string, log: (s: string) => void): Promise<{ body: string; url: string } | null> {
  const u = new URL(url);
  const rules = await robotsFor(u.origin);
  if (!allowed(rules, u.pathname + u.search)) throw new Blocked(`robots.txt disallows ${u.pathname}${u.search}`);
  for (let attempt = 0; ; attempt++) {
    await politeWait(u.origin, rules.delay);
    let res: Response;
    try {
      res = await fetch(url, { headers: { "user-agent": USER_AGENT } });
    } catch (error) {
      if (attempt >= 2) throw new Error(`network: ${(error as Error).message}`);
      await sleep(10_000);
      continue;
    }
    // 403 is retried too: Land-book uses it for rate limits. Retrying later is not a bypass.
    if (res.status === 429 || res.status === 503 || res.status === 403) {
      if (attempt >= BACKOFF_S.length) throw new Blocked(`HTTP ${res.status} after ${attempt + 1} tries`);
      log(`HTTP ${res.status} on ${url}; waiting ${BACKOFF_S[attempt]} s`);
      await sleep(BACKOFF_S[attempt] * 1000);
      continue;
    }
    if (res.status === 404) return null;
    const body = await res.text();
    if (!res.ok) throw new Blocked(`HTTP ${res.status}`);
    return { body, url: res.url || url };
  }
}

// ---------- state ----------

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const stateFile = (name: string) => `${DIR}/${slug(name)}.json`;
const keyOf = (f: Found) => (f.url ?? f.src).toLowerCase();

function load(name: string): State {
  const file = stateFile(name);
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  return { gallery: name, step: 0, page: 1, done: false, notes: [], entries: [], applied: 0, added: { items: 0, credits: 0 } };
}
const save = (s: State) => writeFileSync(stateFile(s.gallery), JSON.stringify(s, null, 1));

// ---------- crawl ----------

async function crawl(name: string) {
  const plan = PLANS[name];
  const s = load(name);
  const log = (msg: string) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${name}: ${msg}`);
  const seen = new Set(s.entries.map(keyOf));
  while (!s.done && s.step < plan.length) {
    const step = plan[s.step];
    const url = step.url(s.page);
    let fresh = 0;
    let read = 0;
    // A feed page whose items were all filtered out (templates) is not the end.
    let filteredOnly = false;
    try {
      const got = await politeGet(url, log);
      if (got) {
        const items = step.parse(got.body, got.url);
        read = items.length;
        filteredOnly = !read && /<(item|entry)>/.test(got.body);
        if (!read && /captcha|verify you are human|cf-chl|Just a moment.../i.test(got.body)) throw new Blocked("bot check page (not bypassed)");
        for (const item of items) {
          if (seen.has(keyOf(item))) continue;
          seen.add(keyOf(item));
          s.entries.push(item);
          fresh++;
        }
      } else if (!step.paged) s.notes.push(`${step.label}: 404`);
    } catch (error) {
      const msg = `${step.label} page ${s.page}: ${(error as Error).message}`;
      s.notes.push(msg);
      log(`stopped: ${msg}`);
      s.step++;
      s.page = 1;
      save(s);
      continue;
    }
    if (step.paged && s.page % 10 === 0) log(`${step.label} page ${s.page}: ${read} read, ${s.entries.length} total`);
    if (!step.paged || (!filteredOnly && (read === 0 || fresh === 0)) || s.page >= MAX_PAGES) {
      if (step.paged) s.notes.push(`${step.label}: stopped at page ${s.page} (${read === 0 ? "no items" : fresh === 0 ? "nothing new" : "page cap"})`);
      else s.notes.push(`${step.label}: ${read} read`);
      s.step++;
      s.page = 1;
    } else s.page++;
    save(s);
  }
  s.done = true;
  save(s);
  log(`done, ${s.entries.length} entries. ${s.notes.join("; ")}`);
}

// ---------- apply ----------

function apply(name: string) {
  const s = load(name);
  mkdirSync(`${DIR}/sql`, { recursive: true });
  while (s.applied < s.entries.length) {
    const chunk = s.entries.slice(s.applied, s.applied + CHUNK);
    const file = `${DIR}/sql/${slug(name)}-${s.applied}.sql`;
    const json = JSON.stringify(chunk).replace(/'/g, "''");
    writeFileSync(file, `-- scripts/backfill-showcase.ts: ${name} ${s.applied}..${s.applied + chunk.length}\nselect public.add_showcase_entries('${json}'::jsonb) as added;\n`);
    const bin = process.platform === "win32" ? ".\\node_modules\\.bin\\supabase.cmd" : "./node_modules/.bin/supabase";
    const run = spawnSync(`${bin} db query --linked -f ${file}`, { shell: true, encoding: "utf8", maxBuffer: 1 << 24 });
    const out = (run.stdout ?? "") + (run.stderr ?? "");
    const m = out.match(/"credits_added":\s*(\d+)[\s\S]*?"items_added":\s*(\d+)|"items_added":\s*(\d+)[\s\S]*?"credits_added":\s*(\d+)/);
    if (run.status !== 0 || !m) {
      console.error(`${name}: chunk at ${s.applied} failed:\n${out.slice(-2000)}`);
      process.exitCode = 1;
      return;
    }
    const credits = Number(m[1] ?? m[4]);
    const items = Number(m[2] ?? m[3]);
    s.added.items += items;
    s.added.credits += credits;
    s.applied += chunk.length;
    save(s);
    console.log(`${name}: applied ${s.applied}/${s.entries.length} (+${items} items, +${credits} credits)`);
  }
}

// ---------- main ----------

mkdirSync(DIR, { recursive: true });
const [command, ...names] = process.argv.slice(2);
const targets = names.length ? names : Object.keys(PLANS);
for (const n of targets) if (!PLANS[n]) throw new Error(`unknown gallery ${n}`);

if (command === "crawl") {
  await Promise.all(targets.map((n) => crawl(n).catch((e) => console.error(`${n}: ${(e as Error).stack}`))));
} else if (command === "apply") {
  for (const n of targets) if (existsSync(stateFile(n))) apply(n);
} else if (command === "report") {
  for (const n of targets) {
    const s = load(n);
    console.log(`${n}: ${s.entries.length} read, ${s.applied} applied, +${s.added.items} items, +${s.added.credits} credits. ${s.notes.join("; ")}`);
  }
} else {
  console.error("usage: node scripts/backfill-showcase.ts crawl|apply|report [gallery…]");
  process.exitCode = 1;
}

