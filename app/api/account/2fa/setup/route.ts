import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/apiError";
import { rateLimit } from "@/lib/rate-limit";
import { generateTotpSecret, totpQrDataUrl } from "@/lib/twoFactor";

// Begin 2FA setup: generate a secret + QR. 2FA stays DISABLED until the user
// confirms a code via /api/account/2fa/enable.
export async function POST(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError("AUTH-007", 401);
  const userId = (session.user as { id: string }).id;

  const rl = rateLimit(`2fa:${userId}`, 6, 5 * 60_000);
  if (!rl.ok)
    return apiError("RATE-001", 429, {
      message: "ดำเนินการบ่อยเกินไป กรุณาลองใหม่",
      headers: { "Retry-After": String(rl.retryAfter) },
    });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true, twoFactorEnabled: true },
  });
  if (!user) return apiError("AUTH-007", 401);
  if (user.twoFactorEnabled)
    return apiError("VAL-003", 409, { message: "เปิดใช้งานยืนยันสองชั้นอยู่แล้ว" });

  const { secret, uri } = generateTotpSecret(user.username);
  // Persist the pending secret; twoFactorEnabled stays false until confirmed.
  await prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: secret } });

  const qrDataUrl = await totpQrDataUrl(uri);
  return NextResponse.json({ secret, qrDataUrl });
}
