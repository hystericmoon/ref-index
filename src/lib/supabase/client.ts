import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/db/types";
import { supabaseKey, supabaseUrl } from "./env";

/** Supabase client for Client Components. Uses the publishable key; access is governed by RLS. */
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl(), supabaseKey());
}
