import { ChevronLeft, Workflow } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { listFlowsWithCounts } from "@/lib/db/flows";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Flows" };

const PLATFORMS: Record<string, string> = { ios: "iOS", android: "Android", web: "Web" };

export default async function FlowsPage() {
  const flows = await listFlowsWithCounts(await createClient());

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 pb-24 sm:px-6">
      <div className="space-y-2">
        <Link
          href="/library"
          className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Library
        </Link>
        <h1 className="font-display text-3xl font-bold tracking-tight">Flows</h1>
        <p className="text-muted-foreground">Screens in the order people move through them. Create flows when you upload.</p>
      </div>

      {flows.length === 0 ? (
        <p className="rounded-xl border border-dashed px-6 py-12 text-center text-muted-foreground">
          No flows yet. Pick or create one on the{" "}
          <Link href="/library/upload" className="font-medium text-foreground underline underline-offset-4">
            upload page
          </Link>
          .
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {flows.map((flow) => (
            <li key={flow.id}>
              <Link
                href={`/library/flows/${flow.id}`}
                className="flex min-h-16 items-center gap-3 rounded-xl border p-4 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <Workflow className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{flow.name}</span>
                  <span className="truncate text-sm text-muted-foreground">
                    {flow.app?.name} · {PLATFORMS[flow.app?.platform ?? ""] ?? flow.app?.platform}
                  </span>
                </span>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {flow.screenCount} {flow.screenCount === 1 ? "screen" : "screens"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
