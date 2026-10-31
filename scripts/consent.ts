// Keeps cookie and consent banners out of captures without answering them: nothing is accepted or
// declined. blockConsent() stops the common consent platforms from loading, so most banners never
// appear; hideBanners() then removes what's left on screen: known banner boxes plus any fixed box
// that talks about cookies, and the dimmed backdrop and scroll lock some of them add.
// Used by capture-showcase.ts and capture-details.ts.

import type { BrowserContext, Page } from "playwright";

// Consent platforms served from their own hosts.
const CONSENT_HOSTS =
  /(^|\.)(cookielaw\.org|onetrust\.com|cookiebot\.(com|eu)|usercentrics\.(eu|com)|didomi\.io|privacy-mgmt\.com|consensu\.org|cmp\.quantcast\.com|trustarc\.com|truste\.com|iubenda\.com|termly\.io|osano\.com|cookieyes\.com|consentmanager\.net|cookie-script\.com|cookiefirst\.com|axept\.io|cookiehub\.(net|eu)|cookieinformation\.com|civiccomputing\.com|termsfeed\.com|enzuzo\.com|cookiepro\.com|consentmo\.com|pandectes\.io|termageddon\.com|secureprivacy\.ai|cookie-consent\.app)$/i;
// Consent plugins served from the site itself (WordPress, Shopify, Webflow and open-source banners).
const CONSENT_PATHS =
  /(cookie-law-info|cookie-notice|complianz|gdpr-cookie-compliance|cookieyes|real-cookie-banner|borlabs-cookie|moove_gdpr|cookie-consent|cookieconsent|privacy-banner|tarteaucitron|klaro|cookie-banner)/i;

export async function blockConsent(context: BrowserContext): Promise<void> {
  await context.route(
    (url) => CONSENT_HOSTS.test(url.hostname) || CONSENT_PATHS.test(url.pathname),
    (route) => route.abort("blockedbyclient"),
  );
}

const BANNER_SELECTORS = [
  "#onetrust-banner-sdk", "#onetrust-consent-sdk", "#CybotCookiebotDialog", "#usercentrics-root", "#usercentrics-cmp-ui",
  ".cc-window", ".cc-banner", "#cc-main", ".cookie-banner", ".cookie-consent", ".cookie-notice", "#cookie-banner",
  "#cookie-notice", "#cookie-law-info-bar", ".cky-consent-container", "#didomi-host", ".qc-cmp2-container",
  "#truste-consent-track", "#cmplz-cookiebanner-container", ".cmplz-cookiebanner", "#moove_gdpr_cookie_info_bar",
  ".sqs-cookie-banner-v2", "#shopify-pc__banner", "[fs-cc='banner']", "#termly-code-snippet-support",
  ".osano-cm-window", "#iubenda-cs-banner", "#BorlabsCookieBox", "#tarteaucitronRoot", ".klaro",
  "[aria-label*='cookie' i][role='dialog']", "[aria-label*='consent' i][role='dialog']",
  "[class*='CookieBanner']", "[class*='cookie-banner']", "[id*='cookie-consent']", "[id*='cookie-banner']",
].join(",");

/**
 * Removes cookie banners from the page. Returns how many it removed, so a run can tell which
 * captures had one. With remove false it only counts them (to find old captures that show one).
 */
export async function hideBanners(page: Page, remove = true): Promise<number> {
  return page
    .evaluate(
      ({ selectors, remove }) => {
        // Cookie talk plus a way to answer it; "cookie cutter" or a bakery's cookie menu isn't enough.
        const words = /\b(cookies|cookie (policy|settings|preferences|notice|consent)|consent|gdpr|ccpa|privacy (settings|preferences|choices)|tracking technologies)\b/i;
        const answer =
          /\b(accept|agree|allow|reject|decline|deny|refus|got it|okay|ok\b|understand|preferences|settings|customi[sz]e|manage|continue|close|akzept|ablehn|einverstanden|acept|rechaz|accett|rifiut|aceit|recus|weiger|personnalis|paramètres|einstellungen)/i;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const onScreen = (el: Element) => {
          const s = getComputedStyle(el);
          if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) return false;
          const r = el.getBoundingClientRect();
          return r.width > 40 && r.height > 20 && r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw;
        };
        const found = new Set<Element>();
        for (const el of document.querySelectorAll(selectors)) if (onScreen(el)) found.add(el);
        // Any fixed box about cookies with a button or link to answer it. Page-sized wrappers
        // (smooth-scroll containers) carry the whole page's text, so long text rules a box out.
        for (const el of document.body?.querySelectorAll("*") ?? []) {
          const s = getComputedStyle(el);
          if (s.position !== "fixed" || [...found].some((f) => f.contains(el) || el.contains(f))) continue;
          const text = (el as HTMLElement).innerText ?? "";
          const consentFrame = [...el.querySelectorAll("iframe")].some((f) => /consent|cookie|privacy-mgmt|trustarc|sp_message/i.test(f.src + f.id + f.title));
          if (!consentFrame && (text.length > 1500 || !words.test(text) || !answer.test(text) || !el.querySelector("button, a, [role='button']"))) continue;
          if (onScreen(el)) found.add(el);
        }
        if (!found.size || !remove) return found.size;
        for (const el of found) el.remove();
        // The dimmed backdrop some banners add: a plain, see-through fixed layer over most of the screen.
        for (const el of document.body.querySelectorAll("*")) {
          const s = getComputedStyle(el);
          if (s.position !== "fixed" || (el as HTMLElement).innerText?.trim() || el.querySelector("canvas, video, img, svg, iframe")) continue;
          const r = el.getBoundingClientRect();
          const alpha = Number(s.backgroundColor.match(/rgba\(.*,\s*([\d.]+)\)/)?.[1] ?? 1);
          if (r.width * r.height > vw * vh * 0.5 && s.backgroundImage === "none" && alpha > 0.05 && alpha < 0.95) el.remove();
        }
        // And the scroll lock some add, so full-page captures still see the whole page.
        for (const el of [document.documentElement, document.body]) {
          if (/cookie|consent|cmp|gdpr|no-?scroll|modal-open|overflow-hidden/i.test(el.className) || el.style.overflow === "hidden") {
            el.style.setProperty("overflow", "visible", "important");
          }
        }
        return found.size;
      },
      { selectors: BANNER_SELECTORS, remove },
    )
    .catch(() => 0);
}
