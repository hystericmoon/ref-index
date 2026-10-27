import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col px-4 sm:px-6">
      <header className="flex items-center justify-between py-4">
        <span className="font-display text-lg font-bold tracking-tight">Ref Index</span>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 flex-col justify-center gap-4 pb-24">
        <h1 className="font-display text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          Ref Index
        </h1>
        <p className="max-w-[60ch] text-muted-foreground">
          A library of UI screens you capture and tag, and an index of the websites and apps that
          design galleries feature. The library and directory arrive in the next sessions.
        </p>
        <p className="font-mono text-sm text-muted-foreground">Session 0 · scaffold</p>
      </main>
    </div>
  );
}
