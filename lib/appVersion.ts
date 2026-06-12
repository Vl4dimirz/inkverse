// Single source of truth for the latest Android build. Bump both fields when you
// publish a new APK; the download page and the in-app update checker both read
// from here, and the API at /api/app/version exposes it to the installed app.
export const LATEST_APK = {
  version: "1.0.4",
  url: "/downloads/inkverse-1.0.4.apk",
};

// True when dotted version `a` is strictly older than `b` (e.g. "1.0.3" < "1.0.4").
export function isOlder(a: string, b: string): boolean {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x < y) return true;
    if (x > y) return false;
  }
  return false;
}
