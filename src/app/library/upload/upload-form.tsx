"use client";

import { AlertCircle, Check, ImageUp, Loader2, RotateCw, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { App } from "@/lib/db/apps";
import type { Flow } from "@/lib/db/flows";
import { createClient } from "@/lib/supabase/client";
import { supabaseKey, supabaseUrl } from "@/lib/supabase/env";
import type { FacetOption } from "@/lib/tags";
import { cn } from "@/lib/utils";
import { TagChips, TagPicker, useTagCatalog } from "@/components/tag-picker";
import {
  addScreensToFlowAction,
  createAppAction,
  createFlowAction,
  listFlowsAction,
  processScreen,
} from "./actions";

const MAX_BYTES = 10 * 1024 * 1024;
const CONCURRENCY = 3;
const EXTENSIONS: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const NEW = "__new__";

type Status = "queued" | "uploading" | "processing" | "done" | "failed";

type Item = {
  id: string;
  file: File;
  preview: string;
  status: Status;
  progress: number;
  reason?: string;
  /** Where Retry resumes; null when retrying can't help. */
  retryFrom?: "upload" | "process" | null;
  appId?: string;
  flowId?: string;
  tagIds?: string[];
};

const selectClass =
  "h-11 w-full rounded-md border border-input bg-transparent px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 md:text-sm dark:bg-input/30";

function formatSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Upload straight to Supabase Storage (not through our server) so we get progress events. */
function uploadOriginal(path: string, file: File, token: string, onProgress: (percent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${supabaseUrl()}/storage/v1/object/screens/${path}`);
    xhr.setRequestHeader("authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", supabaseKey());
    xhr.setRequestHeader("content-type", file.type);
    xhr.setRequestHeader("x-upsert", "true");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onerror = () => reject(new Error("Network error. Check your connection and retry."));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let body: { statusCode?: string; message?: string } = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {}
      const code = Number(body.statusCode ?? xhr.status);
      const message = body.message?.toLowerCase() ?? "";
      if (code === 413 || message.includes("size")) reject(new Error("Larger than 10 MB."));
      else if (message.includes("mime")) reject(new Error("Only PNG, JPG or WebP images."));
      else if (code === 401 || code === 403) reject(new Error("You're signed out. Sign in again and retry."));
      else reject(new Error("Upload failed. Try again."));
    };
    xhr.send(file);
  });
}

async function inBatches<T>(items: T[], limit: number, run: (item: T) => Promise<void>) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await run(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

export function UploadForm({ apps: initialApps, facets: initialFacets }: { apps: App[]; facets: FacetOption[] }) {
  const [supabase] = useState(createClient);
  const catalog = useTagCatalog(initialFacets);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [apps, setApps] = useState(initialApps);
  const [appChoice, setAppChoice] = useState(initialApps.length ? "" : NEW);
  const [newAppName, setNewAppName] = useState("");
  const [newAppPlatform, setNewAppPlatform] = useState("ios");
  const [flows, setFlows] = useState<Flow[]>([]);
  const [flowChoice, setFlowChoice] = useState("");
  const [newFlowName, setNewFlowName] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [running, setRunning] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const itemsRef = useRef(items);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(() => () => itemsRef.current.forEach((item) => URL.revokeObjectURL(item.preview)), []);

  async function chooseApp(value: string) {
    setAppChoice(value);
    setFlowChoice("");
    setFlows([]);
    if (value && value !== NEW) {
      const result = await listFlowsAction(value);
      if (result.ok) setFlows(result.data);
    }
  }

  function patch(id: string, changes: Partial<Item>) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...changes } : item)));
  }

  function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const added = Array.from(files, (file): Item => {
      const item: Item = {
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
        status: "queued",
        progress: 0,
      };
      if (!EXTENSIONS[file.type]) return { ...item, status: "failed", reason: "Only PNG, JPG or WebP images.", retryFrom: null };
      if (file.size > MAX_BYTES)
        return { ...item, status: "failed", reason: `Larger than 10 MB (${formatSize(file.size)}).`, retryFrom: null };
      return item;
    });
    setItems((prev) => [...prev, ...added]);
    setFormError(null);
  }

  function remove(id: string) {
    const item = items.find((i) => i.id === id);
    if (item) URL.revokeObjectURL(item.preview);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  /** Upload one file and turn it into a screen. Resolves true when the screen is saved. */
  async function runItem(item: Item, appId: string, from: "upload" | "process"): Promise<boolean> {
    const { session } = (await supabase.auth.getSession()).data;
    if (!session) {
      patch(item.id, { status: "failed", reason: "You're signed out. Sign in again and retry.", retryFrom: from });
      return false;
    }
    const path = `${session.user.id}/${item.id}.${EXTENSIONS[item.file.type]}`;
    if (from === "upload") {
      patch(item.id, { status: "uploading", progress: 0, reason: undefined });
      try {
        await uploadOriginal(path, item.file, session.access_token, (progress) => patch(item.id, { progress }));
      } catch (error) {
        patch(item.id, { status: "failed", reason: (error as Error).message, retryFrom: "upload" });
        return false;
      }
    }
    patch(item.id, { status: "processing", progress: 100, reason: undefined });
    const result = await processScreen({
      screenId: item.id,
      path,
      appId,
      capturedAt: new Date(item.file.lastModified).toISOString(),
      tagIds: item.tagIds,
    }).catch(() => ({ ok: false as const, reason: "Network error. Check your connection and retry.", retry: true }));
    if (!result.ok) {
      patch(item.id, { status: "failed", reason: result.reason, retryFrom: result.retry ? "process" : null });
      return false;
    }
    patch(item.id, { status: "done" });
    return true;
  }

  async function resolveTargets(): Promise<{ appId: string; flowId?: string } | null> {
    let appId = appChoice;
    if (!appId) {
      setFormError("Choose an app for these screens.");
      return null;
    }
    if (appId === NEW) {
      const result = await createAppAction({ name: newAppName, platform: newAppPlatform });
      if (!result.ok) {
        setFormError(result.reason);
        return null;
      }
      appId = result.data.id;
      setApps((prev) => [...prev, result.data].sort((a, b) => a.name.localeCompare(b.name)));
      setAppChoice(appId);
      setNewAppName("");
    }
    let flowId = flowChoice || undefined;
    if (flowId === NEW) {
      const result = await createFlowAction({ appId, name: newFlowName });
      if (!result.ok) {
        setFormError(result.reason);
        return null;
      }
      flowId = result.data.id;
      setFlows((prev) => [...prev, result.data]);
      setFlowChoice(flowId);
      setNewFlowName("");
    }
    return { appId, flowId };
  }

  async function uploadAll() {
    const queued = items.filter((item) => item.status === "queued");
    if (!queued.length) {
      setFormError("Add some images first.");
      return;
    }
    setFormError(null);
    setRunning(true);
    try {
      const targets = await resolveTargets();
      if (!targets) return;
      const { appId, flowId } = targets;
      const saved = new Set<string>();
      const batch = queued.map((item) => ({ ...item, appId, flowId, tagIds }));
      batch.forEach((item) => patch(item.id, { appId, flowId, tagIds }));
      await inBatches(batch, CONCURRENCY, async (item) => {
        if (await runItem(item, appId, "upload")) saved.add(item.id);
      });
      if (flowId && saved.size) {
        const result = await addScreensToFlowAction(
          flowId,
          queued.filter((item) => saved.has(item.id)).map((item) => item.id),
        );
        if (!result.ok) setFormError(result.reason);
      }
    } finally {
      setRunning(false);
    }
  }

  async function retry(item: Item) {
    if (!item.appId || !item.retryFrom) return;
    if (await runItem(item, item.appId, item.retryFrom)) {
      if (item.flowId) {
        const result = await addScreensToFlowAction(item.flowId, [item.id]);
        if (!result.ok) setFormError(result.reason);
      }
    }
  }

  const counts = {
    queued: items.filter((i) => i.status === "queued").length,
    done: items.filter((i) => i.status === "done").length,
    failed: items.filter((i) => i.status === "failed").length,
    busy: items.filter((i) => i.status === "uploading" || i.status === "processing").length,
  };
  const summary = items.length
    ? [
        counts.done && `${counts.done} of ${items.length} uploaded`,
        counts.busy && `${counts.busy} in progress`,
        counts.failed && `${counts.failed} failed`,
        counts.queued && `${counts.queued} ready`,
      ]
        .filter(Boolean)
        .join(", ")
    : "";

  return (
    <div className="flex flex-col gap-6">
      <fieldset disabled={running} className="grid gap-4 sm:grid-cols-2">
        <legend className="sr-only">Where these screens go</legend>
        <div className="flex flex-col gap-2">
          <Label htmlFor="app">App</Label>
          <select id="app" className={selectClass} value={appChoice} onChange={(e) => chooseApp(e.target.value)}>
            {apps.length > 0 && <option value="">Choose an app…</option>}
            {apps.map((app) => (
              <option key={app.id} value={app.id}>
                {app.name} ({app.platform === "ios" ? "iOS" : app.platform === "android" ? "Android" : "Web"})
              </option>
            ))}
            <option value={NEW}>New app…</option>
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="flow">
            Flow <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <select
            id="flow"
            className={selectClass}
            value={flowChoice}
            onChange={(e) => setFlowChoice(e.target.value)}
            disabled={!appChoice}
          >
            <option value="">None</option>
            {flows.map((flow) => (
              <option key={flow.id} value={flow.id}>
                {flow.name}
              </option>
            ))}
            <option value={NEW}>New flow…</option>
          </select>
        </div>

        {appChoice === NEW && (
          <div className="flex flex-col gap-4 rounded-lg border p-4 sm:col-span-2 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="app-name">App name</Label>
              <Input
                id="app-name"
                className="h-11"
                value={newAppName}
                onChange={(e) => setNewAppName(e.target.value)}
                placeholder="e.g. Revolut"
                autoComplete="off"
              />
            </div>
            <div className="flex flex-col gap-2">
              <span id="platform-label" className="text-sm font-medium">
                Platform
              </span>
              <ToggleGroup
                type="single"
                variant="outline"
                aria-labelledby="platform-label"
                value={newAppPlatform}
                onValueChange={(value) => value && setNewAppPlatform(value)}
              >
                <ToggleGroupItem value="ios" className="h-11 px-4">iOS</ToggleGroupItem>
                <ToggleGroupItem value="android" className="h-11 px-4">Android</ToggleGroupItem>
                <ToggleGroupItem value="web" className="h-11 px-4">Web</ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>
        )}

        {flowChoice === NEW && (
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="flow-name">Flow name</Label>
            <Input
              id="flow-name"
              className="h-11"
              value={newFlowName}
              onChange={(e) => setNewFlowName(e.target.value)}
              placeholder="e.g. Sign up"
              autoComplete="off"
            />
          </div>
        )}
        <div className="flex flex-col gap-2 sm:col-span-2">
          <span className="text-sm font-medium">
            Tags <span className="font-normal text-muted-foreground">(optional, applied to every file)</span>
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <TagPicker
              facets={catalog.facets}
              stateOf={(id) => (tagIds.includes(id) ? "all" : "none")}
              onChange={(tag, change) =>
                setTagIds((prev) => (change === "add" ? [...new Set([...prev, tag.id])] : prev.filter((id) => id !== tag.id)))
              }
              onCreated={catalog.addTag}
              disabled={running}
            />
            <TagChips
              tags={tagIds.flatMap((id) => catalog.tagById.get(id) ?? [])}
              onRemove={(tag) => setTagIds((prev) => prev.filter((id) => id !== tag.id))}
              disabled={running}
            />
          </div>
        </div>
      </fieldset>

      <label
        htmlFor="files"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors hover:bg-accent/50",
          "has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-[3px] has-[input:focus-visible]:ring-ring/50",
          dragging && "border-primary bg-accent/50",
        )}
      >
        <ImageUp className="size-10 text-muted-foreground" aria-hidden="true" />
        <span className="font-medium">Drop screenshots here, or choose files</span>
        <span className="text-sm text-muted-foreground">PNG, JPG or WebP · up to 10 MB each</span>
        <input
          id="files"
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {items.length > 0 && (
        <ul className="flex flex-col divide-y rounded-xl border" aria-label="Files">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
              <img src={item.preview} alt="" className="size-14 shrink-0 rounded-md border object-cover object-top" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium">{item.file.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatSize(item.file.size)}</span>
                </div>
                {item.status === "failed" ? (
                  <p className="flex items-center gap-1.5 text-sm text-destructive">
                    <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
                    {item.reason}
                  </p>
                ) : item.status === "done" ? (
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
                    Uploaded
                  </p>
                ) : item.status === "queued" ? (
                  <p className="text-sm text-muted-foreground">Ready</p>
                ) : (
                  <div className="flex items-center gap-2">
                    <Progress value={item.progress} aria-label={`Uploading ${item.file.name}`} className="flex-1" />
                    <span className="flex w-24 shrink-0 items-center gap-1 text-xs text-muted-foreground">
                      {item.status === "processing" ? (
                        <>
                          <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                          Processing
                        </>
                      ) : (
                        `${item.progress}%`
                      )}
                    </span>
                  </div>
                )}
              </div>
              {item.status === "failed" && item.retryFrom && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  onClick={() => retry(item)}
                  aria-label={`Retry ${item.file.name}`}
                >
                  <RotateCw className="size-4" aria-hidden="true" />
                </Button>
              )}
              {(item.status === "queued" || item.status === "failed") && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  onClick={() => remove(item.id)}
                  aria-label={`Remove ${item.file.name}`}
                >
                  <X className="size-4" aria-hidden="true" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {summary}
        </p>
        <div className="flex gap-2">
          {counts.done > 0 && !running && (
            <Button asChild variant="outline" className="h-11 px-5">
              <Link href="/library">View library</Link>
            </Button>
          )}
          <Button className="h-11 px-5" onClick={uploadAll} disabled={running || counts.queued === 0}>
            {running && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {running ? "Uploading…" : counts.queued > 0 ? `Upload ${counts.queued} ${counts.queued === 1 ? "screen" : "screens"}` : "Upload"}
          </Button>
        </div>
      </div>

      {formError && (
        <p role="alert" className="flex items-center gap-1.5 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          {formError}
        </p>
      )}
    </div>
  );
}
