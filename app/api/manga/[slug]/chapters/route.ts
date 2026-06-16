import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyNewChapter } from "@/lib/notifications";
import { renderNovel } from "@/lib/markdown";
import { isChapterLive } from "@/lib/chapters";
import { syncMangaLatestChapter } from "@/lib/mangaStats";
import { revalidateMangaCache } from "@/lib/revalidate";
import { decodeSlug } from "@/lib/slug";
import { apiError } from "@/lib/apiError";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return apiError("AUTH-007", 401);
  }

  const role = (session.user as { role?: string }).role;
  if (role !== "TRANSLATOR" && role !== "ADMIN") {
    return apiError("AUTH-008", 403);
  }

  const { slug: rawSlug } = await params;
  const slug = decodeSlug(rawSlug);
  const manga = await prisma.manga.findUnique({ where: { slug } });
  if (!manga) {
    return apiError("READ-004", 404);
  }

  if (role === "TRANSLATOR") {
    const userId = (session.user as { id: string }).id;
    const translator = await prisma.translator.findUnique({ where: { userId } });
    if (!translator || manga.translatorId !== translator.id) {
      return apiError("UP-004", 403);
    }
  }

  const body = await req.json();
  const { chapterNum, title, isPremium = false, coinCost = 0, content, status, publishAt, authorNote, freeAt } = body;

  if (typeof chapterNum !== "number" || isNaN(chapterNum)) {
    return apiError("VAL-001", 400, { message: "ต้องระบุเลขตอนที่ถูกต้อง" });
  }

  const existing = await prisma.chapter.findUnique({
    where: { mangaId_chapterNum: { mangaId: manga.id, chapterNum } },
  });
  if (existing) {
    return apiError("CREATE-002", 409);
  }

  const publishDate =
    typeof publishAt === "string" && !isNaN(new Date(publishAt).getTime()) ? new Date(publishAt) : null;

  const chapter = await prisma.chapter.create({
    data: {
      mangaId: manga.id,
      chapterNum,
      title: title || null,
      isPremium,
      coinCost: isPremium ? coinCost : 0,
      content: typeof content === "string" ? renderNovel(content.slice(0, 500000)) : null,
      status: status === "DRAFT" ? "DRAFT" : "PUBLISHED",
      publishAt: publishDate,
      freeAt: isPremium && typeof freeAt === "string" && !isNaN(new Date(freeAt).getTime()) ? new Date(freeAt) : null,
      authorNote: typeof authorNote === "string" ? authorNote.slice(0, 5000) || null : null,
    },
  });

  await prisma.manga.update({
    where: { id: manga.id },
    data: { updatedAt: new Date() },
  });
  await syncMangaLatestChapter(manga.id);

  // Show the new chapter right away (bust the cached story page + home feed).
  revalidateMangaCache(manga.slug);

  // Notify bookmarkers only if the chapter is live now (skip drafts/scheduled).
  if (isChapterLive(chapter)) {
    await notifyNewChapter({
      mangaId: manga.id,
      mangaTitle: manga.title,
      mangaSlug: manga.slug,
      chapterNum,
    });
  }

  return NextResponse.json(chapter, { status: 201 });
}
