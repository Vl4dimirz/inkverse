import crypto from "crypto";

// Short-lived signed URLs for manga page images. The chapter reader (a server
// render that has already passed access control) signs each page; the image
// proxy verifies the signature + expiry before serving. A leaked URL stops
// working after the window, and URLs can't be forged without the secret.
const SECRET =
  process.env.IMAGE_SIGNING_SECRET ||
  process.env.AUTH_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  "dev-insecure-secret";

const TTL_MS = 60 * 60_000; // 60 minutes — generous for a full chapter read

function sign(pageId: string, exp: number, uid: string): string {
  return crypto.createHmac("sha256", SECRET).update(`${pageId}.${exp}.${uid}`).digest("base64url");
}

/**
 * Build the signed proxy path for a page image. Call at render time only.
 * The reader's id is bound into the signature (and carried in `u`) so the image
 * proxy can throttle per-user — a logged-in ripper's pulls are all attributable.
 */
export function signedImagePath(pageId: string, userId?: string | null): string {
  const exp = Date.now() + TTL_MS;
  const uid = userId || "anon";
  return `/api/img/${pageId}?e=${exp}&u=${encodeURIComponent(uid)}&s=${sign(pageId, exp, uid)}`;
}

/** Verify a signed image request: signature (over pageId+exp+uid) matches and not expired. */
export function verifyImageToken(
  pageId: string,
  e: string | null,
  u: string | null,
  s: string | null
): boolean {
  if (!e || !s) return false;
  const exp = Number(e);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = sign(pageId, exp, u || "anon");
  try {
    return crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected));
  } catch {
    return false; // length mismatch / malformed
  }
}
