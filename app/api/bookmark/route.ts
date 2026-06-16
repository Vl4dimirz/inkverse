import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { apiError } from "@/lib/apiError";
import { syncMangaBookmarks } from "@/lib/mangaStats";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return apiError("AUTH-007", 401);
  }
  const userId = (session.user as { id: string }).id;
  const { mangaId } = await req.json();

  if (!mangaId) {
    return apiError("VAL-001", 400, { message: "ต้องระบุ mangaId" });
  }

  await prisma.bookmark.upsert({
    where: { userId_mangaId: { userId, mangaId } },
    create: { userId, mangaId },
    update: {},
  });

  await syncMangaBookmarks(mangaId);
  return NextResponse.json({ bookmarked: true });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return apiError("AUTH-007", 401);
  }
  const userId = (session.user as { id: string }).id;
  const { mangaId } = await req.json();

  await prisma.bookmark.deleteMany({ where: { userId, mangaId } });

  await syncMangaBookmarks(mangaId);
  return NextResponse.json({ bookmarked: false });
}
