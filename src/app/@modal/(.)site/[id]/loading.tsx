/** Shown inside the panel while the site's details load: the shape of SiteDetail's header and capture. */
export default function SiteSheetLoading() {
  return (
    <div role="status" aria-label="Loading site" className="flex animate-pulse flex-col gap-8 motion-reduce:animate-none">
      <div className="flex flex-col gap-3">
        <span className="h-3 w-40 rounded-full bg-muted" />
        <span className="h-9 w-2/3 max-w-md rounded-xl bg-muted sm:h-12" />
        <span className="h-4 w-56 rounded-full bg-muted" />
      </div>
      <span className="aspect-[16/10] w-full max-w-5xl rounded-2xl border bg-muted" />
    </div>
  );
}
