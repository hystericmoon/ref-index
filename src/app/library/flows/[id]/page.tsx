import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFlowSummary, listFlowSteps } from "@/lib/db/flows";
import { listScreens } from "@/lib/db/screens";
import { signScreenUrls } from "@/lib/db/storage";
import { createClient } from "@/lib/supabase/server";
import { FlowEditor, type FlowItem } from "./flow-editor";

export const metadata: Metadata = { title: "Flow" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function FlowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const db = await createClient();
  const flow = await getFlowSummary(db, id);
  if (!flow) notFound();
  const [steps, appScreens] = await Promise.all([
    listFlowSteps(db, id),
    listScreens(db, { appId: flow.app_id, limit: 200 }),
  ]);
  const urls = await signScreenUrls(db, [...steps, ...appScreens].flatMap((s) => (s.thumb_path ? [s.thumb_path] : [])));
  const toItem = (s: { id: string; thumb_path: string | null; width: number | null; height: number | null }): FlowItem => ({
    id: s.id,
    thumbUrl: s.thumb_path ? (urls.get(s.thumb_path) ?? null) : null,
    width: s.width,
    height: s.height,
  });

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 pb-24 sm:px-6">
      <div className="space-y-2">
        <Link
          href="/library/flows"
          className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Flows
        </Link>
        <h1 className="font-display text-3xl font-bold tracking-tight">{flow.name}</h1>
        <p className="text-muted-foreground">{flow.app?.name}</p>
      </div>
      <FlowEditor
        flowId={flow.id}
        appName={flow.app?.name ?? "this app"}
        initial={steps.map(toItem)}
        candidates={appScreens.map(toItem)}
      />
    </main>
  );
}
