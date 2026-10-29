import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getReviewQueue, getViewCounts, isEditor } from "@/lib/db/showcase";
import { createClient } from "@/lib/supabase/server";
import { ReviewQueue } from "./review-queue";

export const metadata: Metadata = { title: "Curate", robots: { index: false } };

export default async function CuratePage() {
  const db = await createClient();
  if (!(await isEditor(db))) notFound();
  const [queue, counts] = await Promise.all([getReviewQueue(db, 24), getViewCounts(db)]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 pb-24 sm:px-6">
      <header className="flex flex-col gap-2 pt-6">
        <h1 className="text-3xl font-semibold tracking-tight">Curate</h1>
        <p className="max-w-[64ch] text-muted-foreground">
          Unreviewed sites with a screenshot, most-featured first. <b className="text-foreground">Feature</b> makes a staff
          pick, <b className="text-foreground">Keep</b> leaves it listed, <b className="text-foreground">Hide</b> removes it
          from every public view. Keys: F, K, H act on the first card; Z undoes.
        </p>
        <p className="font-mono text-xs text-muted-foreground">
          {counts.top.toLocaleString("en-US")} top picks · {counts.all.toLocaleString("en-US")} listed ·{" "}
          {counts.archive.toLocaleString("en-US")} archived
        </p>
      </header>
      <ReviewQueue initial={queue} />
    </main>
  );
}
