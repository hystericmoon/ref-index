// Page types and design patterns for showcase pages (showcase_pages.page_type / .patterns).
// Assigned by looking at screenshots; ids must match the check constraint in
// supabase/migrations/20261125000100_showcase_pages.sql.

export const PAGE_TYPES = [
  { id: "home", label: "Home" },
  { id: "about", label: "About" },
  { id: "work-index", label: "Work index" },
  { id: "case-study", label: "Case study" },
  { id: "pricing", label: "Pricing" },
  { id: "features", label: "Features" },
  { id: "services", label: "Services" },
  { id: "shop", label: "Shop" },
  { id: "product-detail", label: "Product detail" },
  { id: "blog-index", label: "Blog index" },
  { id: "article", label: "Article" },
  { id: "team", label: "Team" },
  { id: "careers", label: "Careers" },
  { id: "contact", label: "Contact" },
  { id: "menu", label: "Menu" },
  { id: "event", label: "Event" },
  { id: "gallery", label: "Gallery" },
  { id: "collection", label: "Collection" },
  { id: "other", label: "Other" },
] as const;

export const PAGE_TYPE_IDS = new Set<string>(PAGE_TYPES.map((t) => t.id));
export const pageTypeLabel = (id: string | null) => PAGE_TYPES.find((t) => t.id === id)?.label ?? null;

export const PAGE_PATTERNS = [
  "hero-video",
  "big-type",
  "grid",
  "horizontal-scroll",
  "sticky-nav",
  "split-screen",
  "marquee",
  "full-bleed-image",
  "carousel",
  "editorial-layout",
  "dark-mode",
  "illustration",
  "3d-webgl",
  "minimal",
] as const;
export const PAGE_PATTERN_IDS = new Set<string>(PAGE_PATTERNS);
