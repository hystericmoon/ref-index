// Reads each gallery's newest picks: names and links only, never screenshots or
// descriptions. Feeds are preferred; plain listing pages are read once, page one only.
// Shared by the showcase-refresh Edge Function (Deno), scripts/refresh-showcase.ts and
// scripts/backfill-showcase.ts (Node). The backfill reuses parseGallery on older pages.

export type Found = { gallery: string; name: string; src: string; url: string | null; platform: string };

export type Gallery = {
  name: string;
  platform: string;
  listing: string;
  /**
   * rss: <item>/<entry> titles and links. html: anchors matching `item`.
   * links: external project links wrapping an <img …projects/…>.
   * captioned: an image link followed by a <p> caption (Brutalist Websites).
   * jsonld: schema.org list entries of type `jsonType` (Land-book listing pages).
   */
  kind: "rss" | "html" | "links" | "captioned" | "jsonld";
  item?: RegExp;
  /** Turn a feed title or link text into the site's name. */
  clean?: (title: string) => string;
  /** Use the link's slug for the name (when link text is a long store title). */
  nameFromSlug?: boolean;
  /** html: take the name from this capture in the item anchor (tag and inner HTML). */
  nameFrom?: RegExp;
  /** html: the first off-site link after an item is that item's live site. */
  live?: boolean;
  /** html: the item links are the live links themselves (App Store pages). */
  itemIsLive?: boolean;
  /** rss: keep only items whose block matches (e.g. a category). */
  only?: RegExp;
  /** rss: capture the live link from inside an item. */
  liveFrom?: RegExp;
  jsonType?: string;
  limit?: number;
};

const beforeTagline = (title: string) => title.split(/\s+[|–—-]\s+/)[0];

/**
 * "Name | tagline" → "Name"; "Tagline — Brand — Brand" → "Brand";
 * "EOR, Payroll & Compliance - Worldwide | Remote" → "Remote".
 */
export function brandName(title: string) {
  const parts = title
    .split(/\s+[|–—-]\s+|\s*\|\s*|:\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length < 2) return title.trim();
  const repeated = parts.find((p, i) => parts.indexOf(p, i + 1) > i);
  if (repeated) return repeated;
  const words = (s: string) => s.split(/\s+/).length;
  if (words(parts[0]) <= 3 && !parts[0].includes(",")) return parts[0];
  const last = parts.at(-1)!;
  if (words(last) <= 3) return last;
  return parts[0];
}

export const GALLERIES: Gallery[] = [
  { name: "Land-book", platform: "web", kind: "rss", listing: "https://land-book.com/feed", clean: brandName },
  { name: "SiteInspire", platform: "web", kind: "rss", listing: "https://www.siteinspire.com/websites/feed" },
  {
    name: "One Page Love",
    platform: "web",
    kind: "rss",
    listing: "https://onepagelove.com/feed",
    // Site entries only, not templates, resources or articles.
    only: /<category><!\[CDATA\[Inspiration\]\]><\/category>/,
    clean: (t) => t.replace(/^(website inspiration|template|resource)\s*:\s*/i, ""),
  },
  { name: "Minimal Gallery", platform: "web", kind: "rss", listing: "https://minimal.gallery/feed/" },
  {
    name: "LaudableApps",
    platform: "ios",
    kind: "rss",
    listing: "https://laudableapps.com/feed.xml",
    liveFrom: /href="(https:\/\/(?:itunes|apps)\.apple\.com\/[^"]+)"/,
  },
  {
    name: "Godly",
    platform: "web",
    kind: "html",
    listing: "https://godly.design/websites/",
    item: /^https:\/\/godly\.design\/website\/[a-z0-9-]+$/,
    nameFrom: /<h3[^>]*>([\s\S]*?)<\/h3>/,
    live: true,
  },
  { name: "Httpster", platform: "web", kind: "html", listing: "https://httpster.net/", item: /^https:\/\/httpster\.net\/website\/[a-z0-9-]+\/$/ },
  {
    name: "CSS Design Awards",
    platform: "web",
    kind: "html",
    listing: "https://www.cssdesignawards.com/wotd-award-winners",
    item: /^https:\/\/www\.cssdesignawards\.com\/sites\/[a-z0-9-]+\/\d+\/$/,
    live: true,
  },
  {
    name: "Awwwards",
    platform: "web",
    kind: "html",
    listing: "https://www.awwwards.com/websites/sites_of_the_day/",
    item: /^https:\/\/www\.awwwards\.com\/sites\/[a-z0-9-]+$/,
    nameFrom: /aria-label="([^"]+)"/,
    live: true,
  },
  {
    name: "Banani",
    platform: "mobile",
    kind: "html",
    listing: "https://www.banani.co/references",
    item: /^https:\/\/www\.banani\.co\/references\/apps\/[a-z0-9-]+$/,
    nameFromSlug: true,
  },
  { name: "Three.js", platform: "3d", kind: "links", listing: "https://threejs.org/", limit: 40 },
  { name: "Brutalist Websites", platform: "web", kind: "captioned", listing: "https://brutalistwebsites.com/", limit: 40 },
  {
    name: "Apple Design Awards",
    platform: "ios",
    kind: "html",
    listing: "https://developer.apple.com/design/awards/",
    // Store links to each winner and finalist (not Apple's own apps in the page footer).
    item: /^https:\/\/apps\.apple\.com\/(?:[a-z]{2}\/)?app\/(?!apple-developer\/|apple-store\/)[^/]+\/id\d+\/?$/,
    nameFrom: /<h[3-6][^>]*>([\s\S]*?)<\/h[3-6]>/,
    itemIsLive: true,
    limit: 40,
  },
];

export const USER_AGENT = "RefIndex showcase refresh (names and links only; https://ref-index.vercel.app)";
const GENERIC =
  /^(website|web site|logo|view|view site|visit|visit site|visit website|more|details|read more|open|site of the day|sotd|honorable mention|developer award|new|featured|\d+)$/i;
const NOT_PROJECTS =
  /threejs\.org|github\.com|twitter\.com|\/\/x\.com|discord|stackoverflow|reddit|discourse|youtube|npmjs|mrdoob|instagram\.com|linkedin\.com|facebook\.com|dribbble\.com|behance\.net|framer\.link|grsm\.io|\?via=|vimeo\.com|tiktok\.com|threads\.net|bsky\.app/;

export function decode(s: string) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&apos;|&#8217;|&#x27;/g, "'")
    .replace(/&quot;|&#8220;|&#8221;/g, '"')
    .replace(/&#8211;|&#8212;/g, "–")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&[a-z]+;|&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** "1234-studio-ol-2" → "Studio Ol", for links without usable text. */
function nameFromSlug(link: string) {
  const segments = new URL(link).pathname.split("/").filter((s) => s && !/^(id)?\d+$/.test(s));
  return (segments.at(-1) ?? "")
    .replace(/^\d+-/, "")
    .replace(/-\d+$/, "")
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function usable(text: string) {
  return text.length >= 2 && text.length <= 80 && !GENERIC.test(text) && !/[<>#"=]/.test(text);
}

function anchors(html: string, base: string) {
  return [...html.matchAll(/<a\b([^>]*)href="([^"]+)"([^>]*)>([\s\S]*?)<\/a>/gi)].flatMap((m) => {
    try {
      // Some galleries put an avatar initial before the name ("G Gitnimble").
      const text = decode(m[4]).replace(/^([A-Z0-9]) (?=\1)/i, "");
      return [{ href: new URL(decode(m[2]), base).href, text, inner: m[4], tag: m[1] + m[3] }];
    } catch {
      return [];
    }
  });
}

const hostOf = (link: string) => new URL(link).hostname.replace(/^www\./, "");

/** Parse one fetched page of a gallery. `base` is the page's URL (defaults to the listing). */
export function parseGallery(gallery: Gallery, body: string, base = gallery.listing): Found[] {
  const found = new Map<string, Found>();
  const clean = gallery.clean ?? ((t: string) => t);
  const add = (src: string, name: string, url: string | null) => {
    name = name.trim();
    if (name && !found.has(url ?? src)) found.set(url ?? src, { gallery: gallery.name, name, src, url, platform: gallery.platform });
  };

  if (gallery.kind === "rss") {
    for (const block of body.match(/<(item|entry)>[\s\S]*?<\/\1>/g) ?? []) {
      if (gallery.only && !gallery.only.test(block)) continue;
      const title = decode(block.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] ?? "");
      const link = decode(block.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? block.match(/<link[^>]*href="([^"]+)"/)?.[1] ?? "");
      const live = gallery.liveFrom ? (block.match(gallery.liveFrom)?.[1] ?? null) : null;
      const name = clean(title).trim();
      if (link.startsWith("http")) add(link, usable(name) ? name : nameFromSlug(link), live && decode(live));
    }
  } else if (gallery.kind === "html") {
    const names = new Map<string, string>();
    const lives = new Map<string, string>();
    const home = hostOf(base);
    let current: string | null = null;
    for (const { href, text, inner, tag } of anchors(body, base)) {
      const src = href.split(/[?#]/)[0];
      if (gallery.item!.test(src)) {
        current = src;
        const raw = gallery.nameFrom ? decode((tag + inner).match(gallery.nameFrom)?.[1] ?? "") : text;
        const name = clean(raw).trim();
        if (!names.get(src)) names.set(src, usable(name) ? name : "");
      } else if (gallery.live && current && !lives.has(current) && /^https?:\/\//.test(href)) {
        if (hostOf(href) !== home && !NOT_PROJECTS.test(href)) lives.set(current, href);
      }
    }
    for (const [src, name] of names) {
      const finalName = (!gallery.nameFromSlug && name) || nameFromSlug(src);
      if (gallery.itemIsLive) add(base, finalName, src.replace(/\/$/, ""));
      else add(src, finalName, lives.get(src) ?? null);
    }
  } else if (gallery.kind === "links") {
    for (const { href, text, inner } of anchors(body, base)) {
      // Featured projects are image tiles; other external links are tools and docs.
      if (!/^https?:\/\//.test(href) || NOT_PROJECTS.test(href) || !/<img[^>]+projects\//.test(inner)) continue;
      add(base, usable(text) ? text : hostOf(href), href);
    }
  } else if (gallery.kind === "captioned") {
    const home = hostOf(base);
    for (const m of body.matchAll(/<a\s[^>]*href="([^"]+)"[^>]*>\s*<img[^>]*>\s*<\/a>\s*(?:<\/div>\s*)?<p>([\s\S]*?)<\/p>/gi)) {
      let href: string;
      try {
        href = new URL(decode(m[1]), base).href;
      } catch {
        continue;
      }
      const own = m[2].match(/<a\s[^>]*href="([^"]+)"/)?.[1];
      const name = clean(decode(m[2].replace(/<a\b[\s\S]*?<\/a>/gi, "")));
      if (!usable(name)) continue;
      if (hostOf(href) === home) add(href, name, null);
      else add(own ? new URL(decode(own), base).href : base, name, href);
    }
  } else {
    // JSON-LD list entries: {"@type":"CreativeWork","name":"…","url":"…"}.
    const text = body.replace(/\\"/g, '"').replace(/\\\//g, "/");
    for (const m of text.matchAll(/"@type":"(\w+)","name":"((?:[^"\\]|\\.)*)","url":"([^"]+)"/g)) {
      if (m[1] !== (gallery.jsonType ?? "CreativeWork")) continue;
      if (gallery.item && !gallery.item.test(m[3])) continue;
      let name = m[2];
      try {
        name = JSON.parse(`"${name}"`);
      } catch {}
      name = clean(decode(name)).trim();
      add(m[3], usable(name) ? name : nameFromSlug(m[3]), null);
    }
  }
  return [...found.values()];
}

export async function readGallery(gallery: Gallery): Promise<Found[]> {
  const res = await fetch(gallery.listing, { headers: { "user-agent": USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseGallery(gallery, await res.text(), res.url || gallery.listing).slice(0, gallery.limit ?? 100);
}

/** Read every gallery; a gallery that fails (blocked, down) is reported and skipped. */
export async function readAllGalleries() {
  const found: Found[] = [];
  const report: Record<string, string> = {};
  for (const gallery of GALLERIES) {
    try {
      const items = await readGallery(gallery);
      found.push(...items);
      report[gallery.name] = `${items.length} read`;
    } catch (error) {
      report[gallery.name] = `skipped (${(error as Error).message})`;
    }
  }
  return { found, report };
}
