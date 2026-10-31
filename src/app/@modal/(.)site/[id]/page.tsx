import { notFound } from "next/navigation";
import { DetailSheet } from "@/app/site/[id]/detail-sheet";
import { SiteDetail, loadSite } from "@/app/site/[id]/site-detail";

/** A detail page opened from the list: shown as a panel over it (see DetailSheet). */
export default async function SiteSheet({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await loadSite(id);
  if (!item) notFound();
  return (
    <DetailSheet id={id} title={item.name}>
      <SiteDetail item={item} />
    </DetailSheet>
  );
}
