// Device/session tracking for the JWT auth strategy. Each login creates a
// UserSession row whose id (the "sid") is embedded in the JWT. The auth callback
// can reject a token whose sid row is gone → that powers "log out this device"
// and "log out everywhere". See prisma model UserSession.
import { prisma } from "@/lib/prisma";

/**
 * Friendly device label from a User-Agent string. Regex-only (no UA-parser dep).
 * The native app sets a UA marker; in-app sessions show "แอป INKVERSE".
 */
export function parseDevice(userAgent?: string | null): string {
  const ua = userAgent || "";
  if (!ua) return "อุปกรณ์ไม่ทราบชื่อ";

  // Native app marker (matches the x-inkverse-app header / custom WebView UA).
  if (/INKVERSE/i.test(ua)) return "แอป INKVERSE";

  // Browser.
  let browser = "";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/i.test(ua)) browser = "Opera";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = "Chrome";
  else if (/Safari\//i.test(ua) && /Version\//i.test(ua)) browser = "Safari";
  else if (/Chromium\//i.test(ua)) browser = "Chromium";

  // OS / device.
  let os = "";
  if (/iPhone/i.test(ua)) os = "iPhone";
  else if (/iPad/i.test(ua)) os = "iPad";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/Windows/i.test(ua)) os = "Windows";
  else if (/Macintosh|Mac OS X/i.test(ua)) os = "Mac";
  else if (/Linux/i.test(ua)) os = "Linux";

  if (browser && os) return `${browser} · ${os}`;
  if (browser) return browser;
  if (os) return os;
  return "อุปกรณ์ไม่ทราบชื่อ";
}

/** Create a session row for a login. Returns its id (the "sid" for the JWT). */
export async function createUserSession(
  userId: string,
  opts: { userAgent?: string | null; ip?: string | null }
): Promise<string> {
  const row = await prisma.userSession.create({
    data: {
      userId,
      userAgent: opts.userAgent ?? null,
      ip: opts.ip ?? null,
      device: parseDevice(opts.userAgent),
    },
    select: { id: true },
  });
  return row.id;
}

/** True if a UserSession with this id still exists (i.e. not revoked). */
export async function sessionValid(sid: string): Promise<boolean> {
  if (!sid) return false;
  const row = await prisma.userSession.findUnique({ where: { id: sid }, select: { id: true } });
  return !!row;
}

/** Best-effort bump of lastSeenAt; never throws (swallows errors). */
export async function touchSession(sid: string): Promise<void> {
  if (!sid) return;
  try {
    await prisma.userSession.update({ where: { id: sid }, data: { lastSeenAt: new Date() } });
  } catch {
    // session may have been revoked between checks — ignore.
  }
}

export interface SessionInfo {
  id: string;
  device: string | null;
  ip: string | null;
  lastSeenAt: Date;
  createdAt: Date;
}

/** All sessions for a user, most recently active first. */
export function listSessions(userId: string): Promise<SessionInfo[]> {
  return prisma.userSession.findMany({
    where: { userId },
    select: { id: true, device: true, ip: true, lastSeenAt: true, createdAt: true },
    orderBy: { lastSeenAt: "desc" },
  });
}

/** Revoke one session — scoped to the owner. Returns true if a row was deleted. */
export async function revokeSession(userId: string, sid: string): Promise<boolean> {
  const res = await prisma.userSession.deleteMany({ where: { id: sid, userId } });
  return res.count > 0;
}

/** Revoke every session for the user except `keepSid`. Returns the count removed. */
export async function revokeOthers(userId: string, keepSid: string): Promise<number> {
  const res = await prisma.userSession.deleteMany({
    where: { userId, id: { not: keepSid } },
  });
  return res.count;
}
