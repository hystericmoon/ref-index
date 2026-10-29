import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getQueueCounts, getReviewQueue, getViewCounts, isEditor, type ReviewQueueName } from "@/lib/db/showcase";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { ReviewQueue } from "./review-queue";

export const metadata: Metadata = { title: "Curate", robots: { index: false } };

export default async function CuratePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const db = await createClient();
  if (!(await isEditor(db))) notFound();
  const name: ReviewQueueName = (await searchParams).queue === "flagged" ? "flagged" : "new";
  const [queue, counts, waiting] = await Promise.all([getReviewQueue(db, 24, name), getViewCounts(db), getQueueCounts(db)]);

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
      <nav aria-label="Queues" className="flex gap-1.5">
        {(["new", "flagged"] as const).map((q) => (
          <Link
            key={q}
            href={q === "new" ? "/curate" : "/curate?queue=flagged"}
            aria-current={q === name ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center gap-1.5 rounded-full border bg-card px-4 text-sm font-medium sm:min-h-9",
              q === name && "border-primary bg-primary text-primary-foreground",
            )}
          >
            {q === "new" ? "To review" : "Flagged by AI"}
            <span className="font-mono text-xs opacity-70">{waiting[q].toLocaleString("en-US")}</span>
          </Link>
        ))}
      </nav>
      <ReviewQueue key={name} initial={queue} queue={name} />
    </main>
  );
}
