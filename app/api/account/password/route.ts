import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/apiError";
import { rateLimit } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError("AUTH-007", 401);
  const userId = (session.user as { id: string }).id;

  const rl = rateLimit(`pwchange:${userId}`, 5, 10 * 60_000);
  if (!rl.ok)
    return apiError("RATE-001", 429, {
      message: "เปลี่ยนรหัสผ่านบ่อยเกินไป กรุณาลองใหม่ภายหลัง",
      headers: { "Retry-After": String(rl.retryAfter) },
    });

  const body = (await req.json().catch(() => null)) as
    | { currentPassword?: unknown; newPassword?: unknown }
    | null;
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";

  if (newPassword.length < 8)
    return apiError("VAL-001", 400, { message: "รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร" });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!user) return apiError("AUTH-007", 401);

  if (!user.passwordHash)
    return apiError("AUTH-002", 400, {
      message:
        'บัญชีนี้เข้าสู่ระบบด้วย Google — กรุณาตั้งรหัสผ่านผ่าน "ลืมรหัสผ่าน"',
    });

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid)
    return apiError("AUTH-002", 400, { message: "รหัสผ่านปัจจุบันไม่ถูกต้อง" });

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  return NextResponse.json({ ok: true });
}
