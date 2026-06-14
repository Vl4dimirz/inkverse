// Lightweight client-side automation / headless-browser heuristics.
//
// Used to refuse painting manga page images for obvious bots (Selenium /
// Playwright / Puppeteer / HeadlessChrome) — a canvas that was never drawn can't
// be screenshotted. Deliberately CONSERVATIVE: only signals with a near-zero
// false-positive rate on real browsers, so genuine readers are never blocked.
// Determined attackers using stealth patches (e.g. playwright-stealth) will pass
// — this just raises the bar against the lazy majority.
export function isLikelyAutomated(): boolean {
  if (typeof navigator === "undefined") return false;
  try {
    // Set to true by webdriver-controlled browsers; a real browser never sets it.
    if (navigator.webdriver === true) return true;
    const ua = navigator.userAgent || "";
    if (/HeadlessChrome|PhantomJS|puppeteer|playwright|Electron\//i.test(ua)) return true;
  } catch {
    /* property access can throw in odd sandboxes — treat as human */
  }
  return false;
}
