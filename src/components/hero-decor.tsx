"use client";

import { useSyncExternalStore } from "react";
import { Beam, Orb } from "@/components/effects";

const WIDE = "(min-width: 80rem)";
const subscribeWide = (onChange: () => void) => {
  const query = window.matchMedia(WIDE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

/** Whether the decoration shows (xl and up); the live orb and beam only run then. */
function useWide() {
  return useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE).matches, () => false);
}

/** One dotted "measurement" frame: a dashed rounded box with corner ticks and a size label. */
function Frame({ label, className, children }: { label: string; className: string; children?: React.ReactNode }) {
  return (
    <div className={`absolute ${className}`}>
      <span className="absolute -top-5 left-0 font-mono text-[10px] whitespace-nowrap tracking-wide text-muted-foreground/70">{label}</span>
      <span className="absolute -top-1 -left-1 size-2 border border-muted-foreground/50" />
      <span className="absolute -top-1 -right-1 size-2 border border-muted-foreground/50" />
      <div className="dot-grid flex size-full items-center justify-center rounded-3xl border border-dashed border-muted-foreground/30">
        {children}
      </div>
    </div>
  );
}

/** Decoration behind the hero, after libraries.dev: measurement frames, a live orb and a beam tile. */
export function HeroDecor() {
  const wide = useWide();
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 hidden xl:block">
      <Frame label="120 × 129  t+0.47s" className="top-6 left-[4%] h-32 w-32">
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          {wide ? <Orb label="" size={64} state="searching" /> : <span className="block size-16" />}
        </div>
      </Frame>
      <Frame label="112 × 112  t+0.31s" className="right-[5%] bottom-4 h-28 w-28">
        {wide ? (
          <Beam size="md" colorVariant="ocean" strength={0.9}>
            <div className="size-14 rounded-2xl border bg-card" />
          </Beam>
        ) : (
          <div className="size-14 rounded-2xl border bg-card" />
        )}
      </Frame>
      <Frame label="124 × 124  t+0.39s" className="top-10 right-[9%] h-24 w-24 opacity-70" />
      <Frame label="96 × 96" className="bottom-10 left-[11%] h-20 w-20 opacity-60" />
    </div>
  );
}
