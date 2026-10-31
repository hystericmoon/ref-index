import { notFound } from "next/navigation";
import { SiteDetail, loadSite } from "@/app/site/[id]/site-detail";

/** A detail page opened from the list: shown as a panel over it (see layout.tsx and DetailSheet). */
export default async function SiteSheet({ params }: { params: Promise<{ id: string }> }) {
  const item = await loadSite((await params).id);
  if (!item) notFound();
  return <SiteDetail item={item} />;
}
