import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadScreenDetail } from "./data";
import { ScreenPageView } from "./screen-viewer";

export const metadata: Metadata = { title: "Screen" };

export default async function ScreenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await loadScreenDetail(id);
  if (!detail) notFound();
  return <ScreenPageView screen={detail.screen} facets={detail.facets} />;
}
