// Reads each gallery's newest picks: names and links only, never screenshots or
// descriptions. Feeds are preferred; plain listing pages are read once, page one only.
// Shared by the showcase-refresh Edge Function (Deno) and scripts/refresh-showcase.ts (Node).

export type Found = { gallery: string; name: string; src: string; url: string | null; platform: string };

type Gallery = {
  name: string;
  platform: string;
  listing: string;
  /** rss: <item>/<entry> titles and links. html: anchors matching `item`. links: external project links. */
  kind: "rss" | "html" | "links";
  item?: RegExp;
  /** Turn a feed title into the site's name. */
  clean?: (title: string) => string;
  /** Use the link's slug for the name (when link text is a long store title). */
  nameFromSlug?: boolean;
  limit?: number;
};

const beforeTagline = (title: string) => title.split(/\s+[|–—-]\s+/)[0];

export const GALLERIES: Gallery[] = [
  { name: "Land-book", platform: "web", kind: "rss", listing: "https://land-book.com/feed", clean: beforeTagline },
  { name: "SiteInspire", platform: "web", kind: "rss", listing: "https://www.siteinspire.com/websites/feed" },
  {
    name: "One Page Love",
    platform: "web",
    kind: "rss",
    listing: "https://onepagelove.com/feed",
    clean: (t) => t.replace(/^(website inspiration|template|resource)\s*:\s*/i, ""),
  },
  { name: "Minimal Gallery", platform: "web", kind: "rss", listing: "https://minimal.gallery/feed/" },
  { name: "LaudableApps", platform: "ios", kind: "rss", listing: "https://laudableapps.com/feed.xml" },
  { name: "Godly", platform: "web", kind: "html", listing: "https://godly.design/", item: /^https:\/\/godly\.design\/website\/[a-z0-9-]+$/ },
  { name: "Httpster", platform: "web", kind: "html", listing: "https://httpster.net/", item: /^https:\/\/httpster\.net\/website\/[a-z0-9-]+\/$/ },
  {
    name: "CSS Design Awards",
    platform: "web",
    kind: "html",
    listing: "https://www.cssdesignawards.com/wotd-award-winners",
    item: /^https:\/\/www\.cssdesignawards\.com\/sites\/[a-z0-9-]+\/\d+\/$/,
  },
  {
    name: "Awwwards",
    platform: "web",
    kind: "html",
    listing: "https://www.awwwards.com/websites/sites_of_the_day/",
    item: /^https:\/\/www\.awwwards\.com\/sites\/[a-z0-9-]+$/,
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
];

const USER_AGENT = "RefIndex showcase refresh (names and links only; https://ref-index.vercel.app)";
const GENERIC =
  /^(website|web site|logo|view|view site|visit|visit site|visit website|more|details|read more|open|site of the day|sotd|honorable mention|developer award|new|featured|\d+)$/i;
const NOT_PROJECTS = /threejs\.org|github\.com|twitter\.com|x\.com|discord|stackoverflow|reddit|discourse|youtube|npmjs|mrdoob/;

function decode(s: string) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&apos;|&#8217;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#8211;|&#8212;/g, "–")
    .replace(/&[a-z]+;|&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** "1234-studio-ol-2" → "Studio Ol", for links without usable text. */
function nameFromSlug(link: string) {
  const segments = new URL(link).pathname.split("/").filter((s) => s && !/^\d+$/.test(s));
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
  return [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)].flatMap((m) => {
    try {
      // Some galleries put an avatar initial before the name ("G Gitnimble").
      return [{ href: new URL(m[1], base).href, text: decode(m[2]).replace(/^([A-Z0-9]) (?=\1)/i, ""), inner: m[2] }];
    } catch {
      return [];
    }
  });
}

export async function readGallery(gallery: Gallery): Promise<Found[]> {
  const res = await fetch(gallery.listing, { headers: { "user-agent": USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.text();
  const found = new Map<string, Found>();
  const add = (src: string, name: string, url: string | null) => {
    if (name && !found.has(url ?? src)) found.set(url ?? src, { gallery: gallery.name, name, src, url, platform: gallery.platform });
  };

  if (gallery.kind === "rss") {
    for (const block of body.match(/<(item|entry)>[\s\S]*?<\/\1>/g) ?? []) {
      const title = decode(block.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] ?? "");
      const link = decode(block.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? block.match(/<link[^>]*href="([^"]+)"/)?.[1] ?? "");
      const name = (gallery.clean ?? ((t: string) => t))(title).trim();
      if (link.startsWith("http")) add(link, usable(name) ? name : nameFromSlug(link), null);
    }
  } else if (gallery.kind === "html") {
    const names = new Map<string, string>();
    for (const { href, text } of anchors(body, gallery.listing)) {
      const src = href.split(/[?#]/)[0];
      if (!gallery.item!.test(src)) continue;
      if (!names.get(src)) names.set(src, usable(text) ? text : "");
    }
    for (const [src, name] of names) add(src, (!gallery.nameFromSlug && name) || nameFromSlug(src), null);
  } else {
    for (const { href, text, inner } of anchors(body, gallery.listing)) {
      // Featured projects are image tiles; other external links are tools and docs.
      if (!/^https?:\/\//.test(href) || NOT_PROJECTS.test(href) || !/<img[^>]+projects\//.test(inner)) continue;
      const host = new URL(href).hostname.replace(/^www\./, "");
      add(gallery.listing, usable(text) ? text : host, href);
    }
  }
  return [...found.values()].slice(0, gallery.limit ?? 100);
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
