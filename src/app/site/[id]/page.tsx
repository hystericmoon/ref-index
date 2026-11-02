import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SITE_NAME } from "@/lib/brand";
import { BackLink } from "./back-link";
import { SiteDetail, hostOf, loadSite } from "./site-detail";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const item = await loadSite((await params).id);
  if (!item) return {};
  const description = `${item.name}${item.url ? ` (${hostOf(item.url)})` : ""}: screenshots and pages, on ${SITE_NAME}.`;
  return {
    title: item.name,
    description,
    openGraph: { title: item.name, description, images: item.thumbUrl ? [item.thumbUrl] : undefined },
  };
}

/** The detail page on its own: opened from a shared link, a reload, or a new tab. From the list it opens as a panel instead. */
export default async function SitePage({ params }: { params: Promise<{ id: string }> }) {
  const item = await loadSite((await params).id);
  if (!item) notFound();

  return (
    <main className="mx-auto flex w-full max-w-[100rem] flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12 lg:px-10">
      <BackLink />
      <SiteDetail item={item} />
    </main>
  );
}
