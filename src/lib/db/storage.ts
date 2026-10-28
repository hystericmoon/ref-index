import type { DbClient } from "./client";

const BUCKET = "screens";

/** Signed URLs for files in the private screens bucket, keyed by path. Missing files are left out. */
export async function signScreenUrls(db: DbClient, paths: string[], expiresIn = 60 * 60): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return new Map();
  const { data, error } = await db.storage.from(BUCKET).createSignedUrls(unique, expiresIn);
  if (error) throw error;
  return new Map(data.flatMap((row) => (row.path && row.signedUrl ? [[row.path, row.signedUrl] as const] : [])));
}
