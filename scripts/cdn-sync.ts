// Keeps the showcase images the site uses in a local mirror (cdn/), keeps the master copy in the
// Cloudflare R2 bucket openrefs-images, and uploads the mirror to three Cloudflare Pages projects,
// where the site loads images from: card screenshots, their 720px copies (what cards load on most
// screens), and detail captures. Pages hosting is free with unlimited traffic, but each upload
// replaces the whole project. R2 (free up to 10 GB, free downloads) holds the same files under
// <project>/<path>, so a fresh machine or a CI runner can rebuild the mirror from it. Images the site
// no longer uses are dropped from the mirror, from R2, and so from Pages on the next upload.
// Unchanged files aren't sent again.
//
// New captures go straight into the mirror with --add <batch folder> (its img/ tree), and are
// uploaded before the batch is recorded, so the site never points at a file Pages doesn't have yet.
// Files missing from the mirror are fetched from R2. The 720px copies are made here from the
// mirrored screenshots when R2 has none, so every screenshot the site can show has one
// (src/lib/db/showcase.ts relies on that).
//
// Run:  node scripts/cdn-sync.ts                       (mirror and R2, then upload to Pages)
//       node scripts/cdn-sync.ts --add <batch folder>  (add a capture batch, then upload)
//       node scripts/cdn-sync.ts --no-deploy           (mirror and R2 only)
// Needs R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY (an R2 token with Object Read & Write on
// openrefs-images) and CLOUDFLARE_ACCOUNT_ID in .env.local, plus `wrangler login` or
// CLOUDFLARE_API_TOKEN for the Pages uploads. The site uses the copies once NEXT_PUBLIC_THUMBS_URL,
// NEXT_PUBLIC_THUMBS_SM_URL and NEXT_PUBLIC_DETAILS_URL point at the projects (src/lib/db/showcase.ts).

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";

// The free plan allows 20,000 files per project; start another project before one fills up.
// Order matters: the small copies are made from the screenshot mirror, so thumbs goes first.
const PROJECTS = { thumbs: "openrefs-thumbs", thumbsSmall: "openrefs-thumbs-sm", details: "openrefs-details" };
const MAX_FILES = 20_000;
const MIRROR = "cdn";
const R2_BUCKET = "openrefs-images";
const HEADERS = "/img/*\n  Cache-Control: public, max-age=31536000, immutable\n  Access-Control-Allow-Origin: *\n";

function optionalEnv(name: string): string | undefined {
  const line = readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${name}=`));
  return line?.slice(name.length + 1).trim() || undefined;
}

function env(name: string): string {
  const value = optionalEnv(name);
  if (!value) throw new Error(`${name} is missing from .env.local`);
  return value;
}

// Unattended runs (Task Scheduler, CI) can't renew a `wrangler login`, so they need an API token
// with "Cloudflare Pages: Edit" in .env.local.
const wranglerEnv = { ...process.env };
for (const name of ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"]) {
  const value = optionalEnv(name);
  if (value) wranglerEnv[name] = value;
}

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${env("CLOUDFLARE_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: env("R2_ACCESS_KEY_ID"), secretAccessKey: env("R2_SECRET_ACCESS_KEY") },
  // R2 doesn't take every checksum the SDK sends by default.
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

/** Every file R2 holds for a project, by path inside the project. */
async function listR2(project: string): Promise<Set<string>> {
  const paths = new Set<string>();
  let token: string | undefined;
  do {
    const page = await r2.send(new ListObjectsV2Command({ Bucket: R2_BUCKET, Prefix: `${project}/`, ContinuationToken: token }));
    for (const object of page.Contents ?? []) if (object.Key) paths.add(object.Key.slice(project.length + 1));
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return paths;
}

async function getR2(project: string, path: string): Promise<Buffer | null> {
  try {
    const object = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: `${project}/${path}` }));
    return object.Body ? Buffer.from(await object.Body.transformToByteArray()) : null;
  } catch {
    return null;
  }
}

/** Runs `task` over `list` with `workers` at a time; returns the items it failed on. */
async function pool<T>(list: T[], workers: number, task: (item: T) => Promise<boolean>, label: string): Promise<T[]> {
  const failed: T[] = [];
  let next = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: workers }, async () => {
      while (next < list.length) {
        const item = list[next++];
        if (!(await task(item).catch(() => false))) failed.push(item);
        if (++done % 2000 === 0) console.error(`  ${label}: ${done} of ${list.length}`);
      }
    }),
  );
  return failed;
}

const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL");
const key = env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

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

/** A 720px copy of a mirrored screenshot. */
async function small(path: string): Promise<Buffer | null> {
  const full = join(MIRROR, PROJECTS.thumbs, path);
  if (!existsSync(full)) return null;
  return sharp(full).resize({ width: 720, withoutEnlargement: true }).webp({ quality: 72, smartSubsample: true }).toBuffer().catch(() => null);
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
    have.delete(path);
    removed++;
  }

  // Fill the mirror from R2; small copies R2 doesn't have yet are made from the screenshots.
  const remote = await listR2(project);
  const missing = [...paths].filter((p) => !have.has(p));
  let made = 0;
  const failed = await pool(
    missing,
    32,
    async (path) => {
      let image = remote.has(path) ? await getR2(project, path) : null;
      if (!image && name === "thumbsSmall") {
        image = await small(path);
        if (image) made++;
      }
      if (!image) return false;
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), image);
      have.add(path);
      return true;
    },
    `${project} download`,
  );
  // Every image gets a new path when it changes, so browsers and Cloudflare can keep it for a year.
  writeFileSync(join(dir, "_headers"), HEADERS);
  have.add("_headers");

  // R2 is the master copy: send it what it lacks and drop what the site no longer uses, before Pages.
  const toUpload = [...have].filter((p) => !remote.has(p) || p === "_headers");
  const notSent = await pool(
    toUpload,
    32,
    async (path) => {
      await r2.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: `${project}/${path}`,
          Body: readFileSync(join(dir, path)),
          ContentType: path.endsWith(".webp") ? "image/webp" : "text/plain",
        }),
      );
      return true;
    },
    `${project} upload to R2`,
  );
  if (notSent.length) throw new Error(`${project}: ${notSent.length} files didn't reach R2, e.g. ${notSent.slice(0, 3).join(", ")}`);
  const stale = [...remote].filter((p) => p !== "_headers" && !paths.has(p));
  // A sudden mass removal points at a bad read of the database, not at the site: keep the files.
  const deleteLimit = Math.max(200, Math.floor(remote.size * 0.1));
  const dropStale = stale.length <= deleteLimit;
  if (!dropStale) console.error(`  ${project}: ${stale.length} R2 files are no longer used; over the ${deleteLimit} limit, so none removed`);
  for (let i = 0; dropStale && i < stale.length; i += 1000) {
    const objects = stale.slice(i, i + 1000).map((p) => ({ Key: `${project}/${p}` }));
    await r2.send(new DeleteObjectsCommand({ Bucket: R2_BUCKET, Delete: { Objects: objects, Quiet: true } }));
  }
  console.error(
    `${project}: ${paths.size} files, ${missing.length - failed.length - made} from R2, ${made} made, ${removed} removed, ` +
      `${failed.length} failed; R2: ${toUpload.length - 1} uploaded, ${dropStale ? stale.length : 0} removed`,
  );
  if (failed.length) console.error(`  failed, e.g. ${failed.slice(0, 3).join(", ")}`);

  if (process.argv.includes("--no-deploy")) continue;
  if (!existsSync(join(dir, "img"))) continue;
  // Run from outside the repo: inside it, wrangler looks for pnpm and fails on Windows.
  const result = spawnSync(
    `"${resolve("node_modules", ".bin", "wrangler")}"`,
    ["pages", "deploy", `"${resolve(dir)}"`, "--project-name", project, "--branch", "main", "--commit-dirty=true"],
    { stdio: "inherit", shell: true, cwd: tmpdir(), env: wranglerEnv },
  );
  if (result.status !== 0) throw new Error(`Upload to ${project} failed`);
}
