// Two-factor auth (TOTP) helpers — used by the account/security API routes and
// (later) the auth login flow. Pure server-side; never expose the secret to the
// client beyond the one-time setup step.
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import bcrypt from "bcryptjs";

const ISSUER = "INKVERSE";

/**
 * Generate a fresh TOTP secret for a user.
 * @param label usually the username (shown in the authenticator app entry).
 * @returns base32 `secret` to persist, and the `otpauth://` provisioning `uri`.
 */
export function generateTotpSecret(label: string): { secret: string; uri: string } {
  const secret = new OTPAuth.Secret({ size: 20 });
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    label: label || "INKVERSE",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret,
  });
  return { secret: secret.base32, uri: totp.toString() };
}

/** Render an otpauth:// uri as a data: URL PNG for an <img> in setup UI. */
export function totpQrDataUrl(uri: string): Promise<string> {
  return QRCode.toDataURL(uri);
}

/**
 * Verify a 6-digit TOTP code against a stored base32 secret.
 * window:1 tolerates the adjacent 30s steps (clock skew). Returns true on match.
 */
export function verifyTotp(secret: string, code: string): boolean {
  if (!secret || !code) return false;
  const cleaned = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(cleaned)) return false;
  try {
    const totp = new OTPAuth.TOTP({
      issuer: ISSUER,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });
    const delta = totp.validate({ token: cleaned, window: 1 });
    return delta !== null;
  } catch {
    return false;
  }
}

const BACKUP_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/1/O/I ambiguity

function randomBackupCode(): string {
  // 8 chars from the unambiguous alphabet.
  const bytes = new Uint8Array(8);
  // crypto is available in the Node runtime; fall back to Math.random only if not.
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  let out = "";
  for (let i = 0; i < 8; i++) out += BACKUP_ALPHABET[bytes[i] % BACKUP_ALPHABET.length];
  return out;
}

/**
 * Generate 10 one-time backup codes. `plain` is shown ONCE to the user;
 * `hashed` (bcrypt) is what we persist (as JSON via JSON.stringify).
 */
export async function generateBackupCodes(): Promise<{ plain: string[]; hashed: string[] }> {
  const plain: string[] = [];
  for (let i = 0; i < 10; i++) plain.push(randomBackupCode());
  const hashed = await Promise.all(plain.map((p) => bcrypt.hash(p, 10)));
  return { plain, hashed };
}

/**
 * Check a backup code against the stored JSON array of bcrypt hashes.
 * On the first match the matching hash is removed (one-time use) and the
 * remaining hashes are returned as JSON for the caller to persist.
 */
export async function verifyBackupCode(
  hashedJson: string | null,
  code: string
): Promise<{ ok: boolean; remainingJson: string }> {
  const fallback = hashedJson ?? "[]";
  if (!hashedJson || !code) return { ok: false, remainingJson: fallback };
  let hashes: string[];
  try {
    const parsed = JSON.parse(hashedJson);
    if (!Array.isArray(parsed)) return { ok: false, remainingJson: fallback };
    hashes = parsed.filter((h): h is string => typeof h === "string");
  } catch {
    return { ok: false, remainingJson: fallback };
  }
  const cleaned = code.replace(/\s+/g, "").toUpperCase();
  for (let i = 0; i < hashes.length; i++) {
    if (await bcrypt.compare(cleaned, hashes[i])) {
      const remaining = hashes.filter((_, idx) => idx !== i);
      return { ok: true, remainingJson: JSON.stringify(remaining) };
    }
  }
  return { ok: false, remainingJson: JSON.stringify(hashes) };
}
