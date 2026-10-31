import { Suspense, type ReactNode } from "react";
import { DetailSheet } from "@/app/site/[id]/detail-sheet";
import { loadSite } from "@/app/site/[id]/site-detail";

async function SiteName({ id }: { id: string }) {
  return (await loadSite(id))?.name ?? "Site";
}

/**
 * The panel frame stays outside the loading boundary, so a tap slides it up straight away
 * with loading.tsx inside, and the site's details stream in when they arrive.
 */
export default async function SiteSheetLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <DetailSheet
      id={id}
      title={
        <Suspense fallback="Loading…">
          <SiteName id={id} />
        </Suspense>
      }
    >
      {children}
    </DetailSheet>
  );
}
