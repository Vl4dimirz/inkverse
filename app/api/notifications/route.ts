import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/apiError";

export async function GET() {
  const session = await auth();
  // Anonymous visitors get an empty (non-error) payload — this endpoint is
  // polled globally by AchievementToaster/NotificationBell on every page, and a
  // 401 only spams the console + wastes requests for the logged-out majority.
  if (!session?.user) {
    return NextResponse.json(
      { notifications: [], unreadCount: 0 },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const userId = (session.user as { id: string }).id;

  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const unreadCount = await prisma.notification.count({
    where: { userId, isRead: false },
  });

  return NextResponse.json({ notifications, unreadCount });
}

export async function PATCH() {
  const session = await auth();
  if (!session?.user) return apiError("AUTH-007", 401);

  const userId = (session.user as { id: string }).id;

  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });

  return NextResponse.json({ ok: true });
}
