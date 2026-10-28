import { ImagePlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { listScreens } from "@/lib/db/screens";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Library" };

export default async function LibraryPage() {
  const screens = await listScreens(await createClient(), { limit: 1 });

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 pb-24 sm:px-6">
      <h1 className="font-display text-3xl font-bold tracking-tight">Library</h1>

      {screens.length === 0 && (
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
      )}
    </main>
  );
}
