"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { MouseEvent } from "react";

/** "All sites": steps back when you came from the directory, so its filters and scroll position come back too. */
export function BackLink() {
  function onClick(e: MouseEvent<HTMLAnchorElement>) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    let fromDirectory = false;
    try {
      const ref = new URL(document.referrer);
      fromDirectory = ref.origin === window.location.origin && ref.pathname === "/";
    } catch {}
    if (fromDirectory && window.history.length > 1) {
      e.preventDefault();
      window.history.back();
    }
  }
  return (
    <Link
      href="/"
      onClick={onClick}
      className="inline-flex min-h-11 w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden="true" /> All sites
    </Link>
  );
}
