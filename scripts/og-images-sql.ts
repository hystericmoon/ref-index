// Prints SQL that lists the sites that got a share picture from scripts/og-images.ts (thumb_path, flag,
// status 'listed'). Every other site tried only gets thumb_checked_at left as it was.
// Run:  node scripts/og-images-sql.ts tmp/og/batch-1 > tmp/og/batch-1.sql
import { readFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
if (!dir) throw new Error("Pass the batch folder");
const ids = readFileSync(join(dir, "results.ndjson"), "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l) as { id: string; ok: boolean })
  .filter((r) => r.ok)
  .map((r) => `'${r.id.replace(/[^0-9a-f-]/g, "")}'`);
if (ids.length) {
  console.log(
    `update public.showcase_items set thumb_path = 'img/og/' || id::text || '.webp', thumb_is_share_image = true, thumb_checked_at = now(), status = 'listed' where id in (${ids.join(",")});`,
  );
}
