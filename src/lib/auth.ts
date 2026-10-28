import { createClient } from "@/lib/supabase/server";

export type CurrentUser = { id: string; email: string | null };

/** The signed-in user from the verified session token, or null. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
}

/** Only same-site relative paths, so `next` can't send people to another site. */
export function safeNextPath(next: string | null | undefined, fallback = "/library"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
