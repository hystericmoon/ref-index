"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Copies the site's design note, wrapped as a prompt for a coding agent, from /site/{id}.md?prompt. */
export function CopyPromptButton({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      const url = `/site/${id}.md?prompt`;
      const text = fetch(url).then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))));
      try {
        // Safari only allows the copy during the click, so hand it the pending text instead of awaiting first.
        if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
          await navigator.clipboard.write([new ClipboardItem({ "text/plain": text.then((t) => new Blob([t], { type: "text/plain" })) })]);
        } else {
          await navigator.clipboard.writeText(await text);
        }
      } catch {
        // The Clipboard API can be refused (embedded views, strict permissions); fall back to the older copy command.
        const area = document.createElement("textarea");
        area.value = await text;
        area.setAttribute("readonly", "");
        area.style.cssText = "position:fixed;top:0;left:0;opacity:0";
        document.body.appendChild(area);
        area.select();
        const ok = document.execCommand("copy");
        area.remove();
        if (!ok) throw new Error("copy refused");
      }
      setCopied(true);
      toast.success("Prompt copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy. Open the Markdown version and add ?prompt to the address.");
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={copy} className="min-h-11 sm:min-h-8">
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      {copied ? "Copied" : "Copy as prompt"}
    </Button>
  );
}
