"use client";

import { Maximize2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { useState, type ReactNode } from "react";

const EXIT_MS = 300;

/**
 * A site's detail page as a panel that slides up over the list, after Awwwards. Closing it (×, Esc,
 * the backdrop or the Back button) returns to the list as it was: filters, loaded cards and scroll.
 */
export function DetailSheet({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  function close() {
    setOpen(false);
    window.setTimeout(() => router.back(), EXIT_MS);
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-300 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-500" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 top-3 bottom-0 z-50 flex flex-col overflow-hidden rounded-t-3xl border-t bg-background shadow-2xl outline-none ease-[cubic-bezier(0.32,0.72,0,1)] data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=closed]:duration-300 data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=open]:duration-500 motion-reduce:data-[state=closed]:fade-out-0 motion-reduce:data-[state=open]:fade-in-0 sm:top-5"
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2 sm:px-6 lg:px-10">
            <Dialog.Title className="min-w-0 truncate text-sm font-medium">{title}</Dialog.Title>
            <div className="flex shrink-0 items-center gap-1">
              <a
                href={`/site/${id}`}
                className="inline-flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Maximize2 className="size-4" aria-hidden="true" />
                <span className="sr-only">Open as a full page</span>
              </a>
              <Dialog.Close className="inline-flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
                <X className="size-5" aria-hidden="true" />
                <span className="sr-only">Close and return to the list</span>
              </Dialog.Close>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <div className="mx-auto flex w-full max-w-[100rem] flex-col gap-8 px-4 pt-6 pb-16 sm:px-6 sm:pt-10 lg:px-10">{children}</div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
