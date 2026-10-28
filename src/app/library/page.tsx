import { ImagePlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { loadTagOptions } from "@/lib/tags";
import { loadScreenPage } from "./data";
import { ScreenGrid } from "./screen-grid";

export const metadata: Metadata = { title: "Library" };

export default async function LibraryPage() {
  const [page, facets] = await Promise.all([loadScreenPage(), createClient().then(loadTagOptions)]);
  const empty = page.screens.length === 0;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 pb-24 sm:px-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-bold tracking-tight">Library</h1>
        {!empty && (
          <Button asChild className="h-11 px-5">
            <Link href="/library/upload">
              <ImagePlus aria-hidden="true" />
              Upload
            </Link>
          </Button>
        )}
      </div>

      {empty ? (
        <section
          aria-labelledby="empty-title"
          className="flex flex-col items-center gap-4 rounded-xl border border-dashed px-6 py-16 text-center"
        >
          <ImagePlus className="size-10 text-muted-foreground" aria-hidden="true" />
          <div className="space-y-1">
            <h2 id="empty-title" className="text-lg font-semibold">
              No screens yet
            </h2>
            <p className="max-w-[45ch] text-muted-foreground">
              Upload screenshots of apps and sites you want to remember, then tag them so you can find them
              later.
            </p>
          </div>
          <Button asChild className="h-11 px-5">
            <Link href="/library/upload">Upload screens</Link>
          </Button>
        </section>
      ) : (
        <ScreenGrid initial={page} facets={facets} />
      )}
    </main>
  );
}
