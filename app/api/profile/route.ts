import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/apiError";
import { nameRequiresVerification, RESERVED_NAME_MESSAGE } from "@/lib/nameGuard";

// Basic email shape check (server-side; the client is never trusted).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Body = {
  name?: unknown;
  bio?: unknown;
  website?: unknown;
  location?: unknown;
  phone?: unknown;
  recoveryEmail?: unknown;
};

// Trim + hard-cap a string field. Returns undefined when the key wasn't sent
// (so we only update provided keys), or "" to explicitly clear a field.
function clean(v: unknown, max: number): string | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError("AUTH-007", 401);
  const userId = (session.user as { id: string }).id;

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body || typeof body !== "object")
    return apiError("VAL-001", 400);

  const name = clean(body.name, 60);
  const bio = clean(body.bio, 500);
  let website = clean(body.website, 200);
  const location = clean(body.location, 100);
  const phone = clean(body.phone, 30);
  const recoveryEmail = clean(body.recoveryEmail, 200);

  // recoveryEmail: if provided non-empty, must look like an email.
  if (recoveryEmail !== undefined && recoveryEmail !== "" && !EMAIL_RE.test(recoveryEmail))
    return apiError("VAL-001", 400, { message: "อีเมลสำรองไม่ถูกต้อง" });

  // website: prepend https:// when a bare domain was given.
  if (website !== undefined && website !== "" && !/^https?:\/\//i.test(website))
    website = `https://${website}`;

  // Reserved-name guard (official/admin/staff/inkverse) for unverified users.
  if (name !== undefined && name !== "" && nameRequiresVerification(name)) {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { verifiedAt: true },
    });
    if (!u?.verifiedAt)
      return apiError("AUTH-004", 400, { message: RESERVED_NAME_MESSAGE });
  }

  const data: Record<string, string | null> = {};
  if (name !== undefined) data.name = name || null;
  if (bio !== undefined) data.bio = bio || null;
  if (website !== undefined) data.website = website || null;
  if (location !== undefined) data.location = location || null;
  if (phone !== undefined) data.phone = phone || null;
  if (recoveryEmail !== undefined) data.recoveryEmail = recoveryEmail || null;

  if (Object.keys(data).length === 0) return NextResponse.json({ ok: true });

  await prisma.user.update({ where: { id: userId }, data });
  return NextResponse.json({ ok: true });
}
