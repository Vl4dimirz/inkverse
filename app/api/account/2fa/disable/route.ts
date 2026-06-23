import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/apiError";
import { rateLimit } from "@/lib/rate-limit";
import { verifyTotp } from "@/lib/twoFactor";
import bcrypt from "bcryptjs";

// Disable 2FA. Re-verify identity: password (if the account has one), otherwise
// a current TOTP code (Google-only accounts have no password).
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError("AUTH-007", 401);
  const userId = (session.user as { id: string }).id;

  const rl = rateLimit(`2fa:${userId}`, 6, 5 * 60_000);
  if (!rl.ok)
    return apiError("RATE-001", 429, {
      message: "ดำเนินการบ่อยเกินไป กรุณาลองใหม่",
      headers: { "Retry-After": String(rl.retryAfter) },
    });

  const body = (await req.json().catch(() => null)) as
    | { password?: unknown; code?: unknown }
    | null;
  const password = typeof body?.password === "string" ? body.password : "";
  const code = typeof body?.code === "string" ? body.code : "";

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true, twoFactorEnabled: true, twoFactorSecret: true },
  });
  if (!user) return apiError("AUTH-007", 401);
  if (!user.twoFactorEnabled)
    return apiError("VAL-003", 400, { message: "ยังไม่ได้เปิดใช้งานยืนยันสองชั้น" });

  let verified = false;
  if (user.passwordHash) {
    verified = await bcrypt.compare(password, user.passwordHash);
    if (!verified)
      return apiError("AUTH-002", 400, { message: "รหัสผ่านไม่ถูกต้อง" });
  } else {
    // Google-only account: accept a valid TOTP code instead of a password.
    verified = !!user.twoFactorSecret && verifyTotp(user.twoFactorSecret, code);
    if (!verified)
      return apiError("VAL-001", 400, { message: "รหัสยืนยันไม่ถูกต้อง" });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: null },
  });

  return NextResponse.json({ ok: true });
}
