import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// The Android app registers its FCM token here so we can push it new-chapter alerts.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const { token, platform } = await req.json().catch(() => ({}));
  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "token required" }, { status: 400 });
  }

  // A token is owned by one user at a time (re-assign if the device switches account).
  await prisma.pushToken.upsert({
    where: { token },
    create: { token, userId, platform: typeof platform === "string" ? platform : "android" },
    update: { userId },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { token } = await req.json().catch(() => ({}));
  if (typeof token === "string" && token) {
    await prisma.pushToken.deleteMany({ where: { token } });
  }
  return NextResponse.json({ ok: true });
}
