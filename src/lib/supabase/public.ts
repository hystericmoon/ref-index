import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { supabaseKey, supabaseUrl } from "./env";

/**
 * Cookie-free client for public data (sources, showcase), so pages and routes that only
 * read it can be cached. Never use it for anything a signed-in user owns.
 */
export function createPublicClient() {
  return createClient<Database>(supabaseUrl(), supabaseKey(), { auth: { persistSession: false } });
}
