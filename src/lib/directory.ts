/** Deep links into a gallery's own search or tag pages, as in the prototype. */

export type DirectorySource = {
  id: string;
  name: string;
  homeUrl: string;
  mediums: string[];
  kind: "query" | "tag" | "none";
  urlTemplate: string | null;
  confirmed: boolean;
  pricing: string | null;
  description: string | null;
  thumbUrl: string | null;
};

export const MEDIUM_GROUPS = [
  { id: "web", title: "Web design galleries" },
  { id: "motion", title: "3D and animated web" },
  { id: "mobile", title: "Mobile app UI and flows" },
] as const;

export const SUGGESTIONS = ["onboarding", "pricing", "sign up", "dashboard", "empty state", "checkout", "settings", "paywall", "portfolio", "3d"];

/** "Empty state!" → "empty-state" for tag-page URLs. */
export function hyphenate(term: string) {
  return term.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export type SourceAction = { kind: "search" | "tagpage" | "browse"; label: string; url: string };

/** What the row's button does for a search term: run the site's search, open a tag page, or browse. */
export function sourceAction(source: DirectorySource, term: string): SourceAction {
  const t = term.trim();
  if (!t || source.kind === "none" || !source.urlTemplate) {
    return { kind: "browse", label: t ? "Browse gallery" : "Open site", url: source.homeUrl };
  }
  const url = source.urlTemplate.replaceAll("{q}", encodeURIComponent(t)).replaceAll("{slug}", hyphenate(t));
  return source.kind === "query" ? { kind: "search", label: "Search", url } : { kind: "tagpage", label: "Tag page", url };
}

export const KIND_RANK = { query: 0, tag: 1, none: 2 } as const;
