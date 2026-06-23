import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/apiError";
import { rateLimit } from "@/lib/rate-limit";
import { verifyTotp, generateBackupCodes } from "@/lib/twoFactor";

// Confirm 2FA: verify the first code against the pending secret, then flip it on
// and mint one-time backup codes (shown once, stored hashed).
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

  const body = (await req.json().catch(() => null)) as { code?: unknown } | null;
  const code = typeof body?.code === "string" ? body.code : "";

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorSecret: true, twoFactorEnabled: true },
  });
  if (!user) return apiError("AUTH-007", 401);
  if (user.twoFactorEnabled)
    return apiError("VAL-003", 409, { message: "เปิดใช้งานยืนยันสองชั้นอยู่แล้ว" });
  if (!user.twoFactorSecret)
    return apiError("VAL-003", 400, { message: "ยังไม่ได้เริ่มตั้งค่ายืนยันสองชั้น" });

  if (!verifyTotp(user.twoFactorSecret, code))
    return apiError("VAL-001", 400, { message: "รหัสยืนยันไม่ถูกต้อง" });

  const { plain, hashed } = await generateBackupCodes();
  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorEnabled: true, twoFactorBackupCodes: JSON.stringify(hashed) },
  });

  return NextResponse.json({ ok: true, backupCodes: plain });
}
