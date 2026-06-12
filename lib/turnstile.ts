// Verify a Cloudflare Turnstile ("I am human") token server-side.
// Graceful: if TURNSTILE_SECRET_KEY isn't configured yet, it returns true so the
// flow keeps working before setup. Once the secret is set, it enforces.
export async function verifyTurnstile(token: string | undefined, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // not enabled yet
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = (await res.json()) as { success?: boolean };
    return !!data.success;
  } catch {
    return false; // fail closed while protection is on
  }
}
