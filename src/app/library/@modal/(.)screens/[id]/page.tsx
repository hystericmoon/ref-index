import { notFound } from "next/navigation";
import { loadScreenDetail } from "../../../screens/[id]/data";
import { ScreenModalView } from "../../../screens/[id]/screen-viewer";

/** Opening a screen from the grid shows it in a modal; a direct visit gets the full page. */
export default async function ScreenModal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await loadScreenDetail(id);
  if (!detail) notFound();
  return <ScreenModalView screen={detail.screen} facets={detail.facets} />;
}
