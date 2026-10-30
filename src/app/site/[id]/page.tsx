import { ArrowLeft, ExternalLink, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { CATEGORIES } from "@/lib/categories";
import { getShowcaseItem } from "@/lib/db/showcase";
import { createPublicClient } from "@/lib/supabase/public";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PLATFORM_LABEL: Record<string, string> = { web: "Web", "3d": "3D", ios: "iOS", android: "Android", mobile: "App" };

const load = cache(async (id: string) => (UUID.test(id) ? getShowcaseItem(createPublicClient(), id) : null));

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const item = await load((await params).id);
  if (!item) return {};
  const description = `${item.name}${item.url ? ` (${hostOf(item.url)})` : ""}, featured on ${item.featured.map((f) => f.gallery).join(", ")}.`;
  return {
    title: item.name,
    description,
    openGraph: { title: item.name, description, images: item.thumbUrl ? [item.thumbUrl] : undefined },
  };
}

/** One showcase site: its full home page and a few inner pages, with links to the site and the galleries. */
export default async function SitePage({ params }: { params: Promise<{ id: string }> }) {
  const item = await load((await params).id);
  if (!item) notFound();
  const href = item.url ?? item.featured[0]?.sourceUrl;
  const labels = item.categories.map((c) => CATEGORIES.find((x) => x.id === c)?.label).filter(Boolean);
  const d = item.details;

  return (
    <main className="mx-auto flex w-full max-w-[100rem] flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12 lg:px-10">
      <Link href="/" className="inline-flex min-h-11 w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" /> All sites
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <p className="font-mono text-xs tracking-wider text-muted-foreground uppercase">
            {PLATFORM_LABEL[item.platform] ?? item.platform}
            {item.url && <> · {hostOf(item.url)}</>}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-balance break-words sm:text-5xl">{item.name}</h1>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {item.staffPick && (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 font-medium text-accent-foreground">
                <Sparkles className="size-3" aria-hidden="true" /> Staff pick
              </span>
            )}
            {labels.map((l) => (
              <span key={l} className="rounded-full border px-2.5 py-1 text-muted-foreground">
                {l}
              </span>
            ))}
          </div>
          <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
            Featured on
            {item.featured.map((f, i) => (
              <span key={f.gallery} className="flex items-center gap-1.5">
                {i > 0 && <span aria-hidden="true">·</span>}
                <a href={f.sourceUrl} target="_blank" rel="noopener" className="py-1 font-medium text-primary hover:underline">
                  {f.gallery}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </span>
            ))}
          </p>
        </div>
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener"
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Visit site <ExternalLink className="size-4" aria-hidden="true" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        )}
      </header>

      {d && d.pages.length > 0 && (
        <section aria-labelledby="inner-pages" className="flex flex-col gap-3">
          <h2 id="inner-pages" className="text-lg font-semibold tracking-tight">
            Inner pages
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {d.pages.map((p) => (
              <li key={p.imageUrl} className="flex min-w-0 flex-col gap-2">
                <a href={p.url} target="_blank" rel="noopener" className="group flex flex-col gap-2">
                  <span className="block aspect-[16/10] overflow-hidden rounded-2xl border bg-muted">
                    <Image src={p.imageUrl} alt="" width={960} height={600} unoptimized className="size-full object-cover object-top" />
                  </span>
                  <span className="truncate px-1 text-sm font-medium group-hover:underline">
                    {p.title || hostOf(p.url)}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="home-page" className="flex flex-col gap-3">
        <h2 id="home-page" className="text-lg font-semibold tracking-tight">
          {d ? "Full home page" : "Home page"}
        </h2>
        {d ? (
          <div className="w-full max-w-5xl overflow-hidden rounded-2xl border bg-muted">
            <Image
              src={d.full}
              alt={`The full home page of ${item.name}, captured from the live site.`}
              width={960}
              height={Math.round(d.fullHeight * 0.75)}
              unoptimized
              className="h-auto w-full"
            />
          </div>
        ) : item.thumbUrl ? (
          <>
            <div className="w-full max-w-5xl overflow-hidden rounded-2xl border bg-muted">
              <Image src={item.thumbUrl} alt={`The top of ${item.name}'s home page.`} width={1280} height={800} unoptimized className="h-auto w-full" />
            </div>
            <p className="text-sm text-muted-foreground">Full-page and inner-page captures are made for Top picks.</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No capture of this site yet.</p>
        )}
      </section>
    </main>
  );
}
