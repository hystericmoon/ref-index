import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { listApps } from "@/lib/db/apps";
import { createClient } from "@/lib/supabase/server";
import { loadTagOptions } from "@/lib/tags";
import { UploadForm } from "./upload-form";

export const metadata: Metadata = { title: "Upload screens" };

// Server actions on this page run sharp on originals up to 10 MB.
export const maxDuration = 60;

export default async function UploadPage() {
  const db = await createClient();
  const [apps, facets] = await Promise.all([listApps(db), loadTagOptions(db)]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 pb-24 sm:px-6">
      <div className="space-y-2">
        <Link
          href="/library"
          className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Library
        </Link>
        <h1 className="font-display text-3xl font-bold tracking-tight">Upload screens</h1>
        <p className="text-muted-foreground">PNG, JPG or WebP, up to 10 MB each.</p>
      </div>
      <UploadForm apps={apps} facets={facets} />
    </main>
  );
}
