import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/** A Supabase client typed against our schema. Works with both the browser and server clients. */
export type DbClient = SupabaseClient<Database>;

type Tables = Database["public"]["Tables"];
export type TableName = keyof Tables;
export type Row<T extends TableName> = Tables[T]["Row"];
export type Insert<T extends TableName> = Tables[T]["Insert"];
export type Update<T extends TableName> = Tables[T]["Update"];

/** Throws the Supabase error, otherwise returns the data. */
export function must<T>(result: { data: T; error: null } | { data: null; error: unknown }): T {
  if (result.error) throw result.error;
  return result.data as T;
}

/** Like `must`, for writes that return exactly one row. */
export function mustOne<T>(result: { data: T | null; error: unknown }): T {
  if (result.error) throw result.error;
  if (result.data === null) throw new Error("Expected one row, got none");
  return result.data;
}

/** `%term%` for ilike, with LIKE wildcards in the user's input escaped. */
export function containsPattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
