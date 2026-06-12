import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import crypto from "crypto";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { grantSignupBonus, recordReferral } from "@/lib/coins";
import { sendEmail, verificationEmail } from "@/lib/email";

const BASE_URL = process.env.SITE_URL || process.env.NEXTAUTH_URL || "https://inkverse.com";

const schema = z.object({
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, "ใช้ได้เฉพาะตัวอักษร ตัวเลข และ _"),
  email: z.string().email(),
  password: z.string().min(8),
  ref: z.string().max(30).optional(),
});

export async function POST(req: NextRequest) {
  const rl = rateLimit(`register:${clientIp(req)}`, 5, 10 * 60_000);
  if (!rl.ok)
    return NextResponse.json(
      { error: "พยายามสมัครบ่อยเกินไป กรุณาลองใหม่ภายหลัง" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { username, email, password, ref } = parsed.data;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });

  if (existing) {
    return NextResponse.json(
      { error: existing.email === email ? "อีเมลนี้ถูกใช้แล้ว" : "ชื่อผู้ใช้นี้ถูกใช้แล้ว" },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: { username, email, passwordHash, role: "READER" },
    select: { id: true, username: true, email: true, role: true },
  });

  // Email verification gates the welcome bonus on a real, unique inbox — this
  // stops re-signup coin farming. Bonus is granted on verify, not here.
  const vToken = crypto.randomBytes(32).toString("hex");
  await prisma.emailVerificationToken.create({
    data: { token: vToken, userId: user.id, expires: new Date(Date.now() + 24 * 60 * 60_000) },
  });
  const sent = await sendEmail({
    to: email,
    subject: "ยืนยันอีเมล — INKVERSE",
    html: verificationEmail(`${BASE_URL}/api/auth/verify?token=${vToken}`),
  });
  if (!sent) {
    // Email isn't configured → can't verify; fall back to immediate bonus.
    await grantSignupBonus(user.id);
    await prisma.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } });
  }

  // Attribute the referral if they arrived via an invite link (best-effort).
  if (ref) await recordReferral(user.id, ref);

  return NextResponse.json({ ...user, needsVerification: sent }, { status: 201 });
}
