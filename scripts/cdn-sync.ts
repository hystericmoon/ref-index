// Keeps the showcase images the site uses in a local mirror and uploads it to three Cloudflare Pages
// projects: card screenshots, their 720px copies (what cards load on most screens), and detail
// captures. Pages hosting is free with unlimited traffic, but each upload replaces the whole project,
// so the mirror (cdn/, not committed) is the only full copy besides Pages itself: back it up. Images
// the site no longer uses are dropped from the mirror, and so from Pages on the next upload.
// Unchanged files aren't sent again.
//
// New captures go straight into the mirror with --add <batch folder> (its img/ tree), and are
// uploaded before the batch is recorded, so the site never points at a file Pages doesn't have yet.
// Older images missing from the mirror are fetched from the Supabase bucket, which no longer keeps
// copies of current images. The 720px copies are made here from the mirrored screenshots, so every
// screenshot the site can show has one (src/lib/db/showcase.ts relies on that).
//
// Run:  node scripts/cdn-sync.ts                       (mirror, then upload)
//       node scripts/cdn-sync.ts --add <batch folder>  (add a capture batch, then upload)
//       node scripts/cdn-sync.ts --no-deploy           (mirror only)
// Needs a one-time `wrangler login`. The site uses the copies once NEXT_PUBLIC_THUMBS_URL,
// NEXT_PUBLIC_THUMBS_SM_URL and NEXT_PUBLIC_DETAILS_URL point at the projects (src/lib/db/showcase.ts).

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import sharp from "sharp";

// The free plan allows 20,000 files per project; start another project before one fills up.
// Order matters: the small copies are made from the screenshot mirror, so thumbs goes first.
const PROJECTS = { thumbs: "openrefs-thumbs", thumbsSmall: "openrefs-thumbs-sm", details: "openrefs-details" };
const MAX_FILES = 20_000;
const MIRROR = "cdn";

function env(name: string): string {
  const line = readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${name}=`));
  const value = line?.slice(name.length + 1).trim();
  if (!value) throw new Error(`${name} is missing from .env.local`);
  return value;
}

const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL");
const key = env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const bucket = `${supabaseUrl}/storage/v1/object/public/showcase`;

// Every image path the site can show, by project. Small copies share the screenshots' paths.
const thumbs = new Set<string>();
const wanted = { thumbs, thumbsSmall: thumbs, details: new Set<string>() };
for (let from = 0; ; from += 1000) {
  const response = await fetch(`${supabaseUrl}/rest/v1/showcase_items?select=id,thumb_path,details&thumb_path=not.is.null&order=id`, {
    headers: { apikey: key, range: `${from}-${from + 999}` },
  });
  if (!response.ok) throw new Error(`Couldn't read showcase items: ${response.status}`);
  const page = (await response.json()) as { thumb_path: string; details: { full: string; pages: { path: string }[] } | null }[];
  for (const row of page) {
    wanted.thumbs.add(row.thumb_path);
    if (row.details) for (const path of [row.details.full, ...row.details.pages.map((p) => p.path)]) wanted.details.add(path);
  }
  if (page.length < 1000) break;
}

// A capture batch not yet recorded: its files join the mirror and count as wanted.
const addIndex = process.argv.indexOf("--add");
const added = addIndex > 0 ? join(process.argv[addIndex + 1], "img") : "";
if (added && existsSync(added)) {
  for (const entry of readdirSync(added, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".webp")) continue;
    const path = `img/${relative(added, join(entry.parentPath, entry.name)).replaceAll("\\", "/")}`;
    const name = path.startsWith("img/details/") ? "details" : "thumbs";
    const target = join(MIRROR, PROJECTS[name], path);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(entry.parentPath, entry.name), target);
    wanted[name].add(path);
  }
}

/** A missing mirror file: a 720px copy of the screenshot for thumbsSmall, else from the old bucket. */
async function source(name: keyof typeof PROJECTS, path: string): Promise<Buffer | null> {
  if (name === "thumbsSmall") {
    const full = join(MIRROR, PROJECTS.thumbs, path);
    if (!existsSync(full)) return null;
    return sharp(full).resize({ width: 720, withoutEnlargement: true }).webp({ quality: 72, smartSubsample: true }).toBuffer().catch(() => null);
  }
  const response = await fetch(`${bucket}/${path}`).catch(() => null);
  return response?.ok ? Buffer.from(await response.arrayBuffer()) : null;
}

for (const [name, paths] of Object.entries(wanted) as [keyof typeof PROJECTS, Set<string>][]) {
  const project = PROJECTS[name];
  const dir = join(MIRROR, project);
  if (paths.size >= MAX_FILES) throw new Error(`${project} would hold ${paths.size} files, over the ${MAX_FILES} limit`);
  mkdirSync(dir, { recursive: true });

  const have = new Set(
    readdirSync(dir, { recursive: true, withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => relative(dir, join(e.parentPath, e.name)).replaceAll("\\", "/")),
  );
  let removed = 0;
  for (const path of have) {
    if (path === "_headers" || paths.has(path)) continue;
    unlinkSync(join(dir, path));
    removed++;
  }

  const missing = [...paths].filter((p) => !have.has(p));
  const failed: string[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: 16 }, async () => {
      while (next < missing.length) {
        const path = missing[next++];
        const image = await source(name, path);
        if (!image) {
          failed.push(path);
          continue;
        }
        mkdirSync(dirname(join(dir, path)), { recursive: true });
        writeFileSync(join(dir, path), image);
      }
    }),
  );
  // Every image gets a new path when it changes, so browsers and Cloudflare can keep it for a year.
  writeFileSync(join(dir, "_headers"), "/img/*\n  Cache-Control: public, max-age=31536000, immutable\n  Access-Control-Allow-Origin: *\n");
  console.error(`${project}: ${paths.size} files, ${missing.length - failed.length} ${name === "thumbsSmall" ? "made" : "downloaded"}, ${removed} removed, ${failed.length} failed`);
  if (failed.length) console.error(`  failed, e.g. ${failed.slice(0, 3).join(", ")}`);

  if (process.argv.includes("--no-deploy")) continue;
  if (!existsSync(join(dir, "img"))) continue;
  // Run from outside the repo: inside it, wrangler looks for pnpm and fails on Windows.
  const result = spawnSync(
    `"${resolve("node_modules", ".bin", "wrangler")}"`,
    ["pages", "deploy", `"${resolve(dir)}"`, "--project-name", project, "--branch", "main", "--commit-dirty=true"],
    { stdio: "inherit", shell: true, cwd: tmpdir() },
  );
  if (result.status !== 0) throw new Error(`Upload to ${project} failed`);
}
