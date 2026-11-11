// Style tags for showcase sites, beside the topic categories in categories.ts. Three groups:
// the look (style), how the page is laid out (layout) and its colour. A site can have several.
// scripts/ai-categorize.ts fills them from each site's screenshot; ids are stored in
// showcase_items.styles and are unique across groups.

export type StyleGroup = "style" | "layout" | "colour";
export type StyleTag = { id: string; label: string; group: StyleGroup; hint: string };

export const STYLE_GROUPS: { id: StyleGroup; label: string; max: number }[] = [
  { id: "style", label: "Style", max: 2 },
  { id: "layout", label: "Layout", max: 2 },
  { id: "colour", label: "Colour", max: 3 },
];

export const STYLES: StyleTag[] = [
  // Look and feel
  { id: "minimal", label: "Minimal", group: "style", hint: "lots of white space, few elements, restrained" },
  { id: "bold", label: "Bold type", group: "style", hint: "oversized or expressive typography leads the design" },
  { id: "brutalist", label: "Brutalist", group: "style", hint: "raw, harsh, default fonts, visible grid, anti-polish" },
  { id: "editorial", label: "Editorial", group: "style", hint: "magazine-like, serif type, strong text hierarchy" },
  { id: "playful", label: "Playful", group: "style", hint: "fun, quirky, cartoonish, bouncy" },
  { id: "retro", label: "Retro", group: "style", hint: "nostalgic: vintage print, 80s/90s, pixel, y2k" },
  { id: "futuristic", label: "Futuristic", group: "style", hint: "tech, sci-fi, glow, glass, gradients" },
  { id: "luxury", label: "Luxury", group: "style", hint: "premium, elegant, refined, high-end brand" },
  { id: "corporate", label: "Corporate", group: "style", hint: "clean, trustworthy business or SaaS look" },
  { id: "organic", label: "Organic", group: "style", hint: "soft shapes, natural, handmade, warm" },
  { id: "illustrated", label: "Illustrated", group: "style", hint: "custom illustration or hand-drawn art is the main visual" },
  { id: "immersive", label: "3D & motion", group: "style", hint: "WebGL, 3D, video or heavy animation is the main visual" },
  // Layout
  { id: "grid", label: "Grid", group: "layout", hint: "cards or tiles in a regular grid" },
  { id: "bento", label: "Bento", group: "layout", hint: "mixed-size rounded boxes in a compact grid" },
  { id: "asymmetric", label: "Asymmetric", group: "layout", hint: "off-grid, overlapping, broken or unusual composition" },
  { id: "centered", label: "Centered", group: "layout", hint: "single centred column, classic hero" },
  { id: "split", label: "Split screen", group: "layout", hint: "the first screen is divided into two halves" },
  { id: "full-bleed", label: "Full-bleed", group: "layout", hint: "a full-screen image, video or colour fills the first view" },
  { id: "sidebar", label: "Sidebar", group: "layout", hint: "persistent side navigation or fixed rail" },
  { id: "horizontal", label: "Horizontal scroll", group: "layout", hint: "scrolls or slides sideways" },
  // Colour
  { id: "dark", label: "Dark", group: "colour", hint: "dark background" },
  { id: "light", label: "Light", group: "colour", hint: "white or light background" },
  { id: "monochrome", label: "Monochrome", group: "colour", hint: "black, white and greys, or one hue only" },
  { id: "pastel", label: "Pastel", group: "colour", hint: "soft, low-saturation colours" },
  { id: "vibrant", label: "Vibrant", group: "colour", hint: "saturated, many strong colours" },
  { id: "neon", label: "Neon", group: "colour", hint: "glowing or fluorescent accents on dark" },
  { id: "earthy", label: "Earthy", group: "colour", hint: "browns, beige, olive, terracotta" },
  { id: "gradient", label: "Gradient", group: "colour", hint: "gradients are a main part of the look" },
  { id: "red", label: "Red", group: "colour", hint: "red is the dominant accent" },
  { id: "orange", label: "Orange", group: "colour", hint: "orange or yellow is the dominant accent" },
  { id: "green", label: "Green", group: "colour", hint: "green is the dominant accent" },
  { id: "blue", label: "Blue", group: "colour", hint: "blue is the dominant accent" },
  { id: "purple", label: "Purple", group: "colour", hint: "purple or violet is the dominant accent" },
  { id: "pink", label: "Pink", group: "colour", hint: "pink or magenta is the dominant accent" },
];

export const STYLE_IDS = new Set(STYLES.map((s) => s.id));

/** Parses a `style` URL parameter ("minimal,dark") into known ids, at most 4. */
export function parseStyles(value: string | null | undefined): string[] {
  return [...new Set((value ?? "").split(",").filter((s) => STYLE_IDS.has(s)))].slice(0, 4);
}
