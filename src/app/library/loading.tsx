import { GridSkeleton } from "./screen-grid";

export default function LibraryLoading() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 pb-24 sm:px-6">
      <h1 className="font-display text-3xl font-bold tracking-tight">Library</h1>
      <GridSkeleton count={12} />
      <p className="sr-only" aria-live="polite">
        Loading your screens
      </p>
    </main>
  );
}
